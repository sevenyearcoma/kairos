import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useStore } from '@nanostores/react';
import { GoogleGenAI, Type } from '@google/genai';
import type { ChatMessage, ChatSession, Task, Event } from '../types';

import { isItemOnDate } from '../utils/dateUtils';
import { getT } from '../translations';
import { $tasks, $events, $knowledgeBase, $language, $prefs, $isAiThinking, addEvent, addTask, addMemoryItem, updateChatMessages, setMessageSynced, getLocalDateStr } from '../stores/app';

declare global {
  interface Window { webkitSpeechRecognition: any; SpeechRecognition: any; }
}

const MAX_SECONDS = 180;

const ChatView: React.FC<{ activeChat: ChatSession }> = ({ activeChat }) => {
  const tasks = useStore($tasks);
  const events = useStore($events);
  const knowledgeBase = useStore($knowledgeBase);
  const language = useStore($language);
  const prefs = useStore($prefs);
  const isAiThinking = useStore($isAiThinking);

  const [showSettings, setShowSettings] = useState(false);
  const [agentStatus, setAgentStatus] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [error, setError] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const liveTranscriptRef = useRef('');

  const t = useMemo(() => getT(language), [language]);
  const messages = activeChat?.messages || [];

  const { todayStr, todayEventsCount, todayTasksCount } = useMemo(() => {
    const tStr = getLocalDateStr();
    return {
      todayStr: tStr,
      todayEventsCount: events.filter(e => isItemOnDate(e, tStr)).length,
      todayTasksCount: tasks.filter(task => isItemOnDate(task, tStr) && !task.completed).length,
    };
  }, [events, tasks]);

  // Unaccepted drafts (pending action) — show most recent first
  const pendingDrafts = useMemo(() => {
    return messages
      .filter(m => m.role === 'assistant' && !m.isSynced && (m.draftTask || m.draftEvent))
      .reverse();
  }, [messages]);

  // Recent user captures for history
  const recentCaptures = useMemo(() => {
    return messages
      .filter(m => m.role === 'user')
      .slice(-3)
      .reverse();
  }, [messages]);

  useEffect(() => {
    return () => {
      stopEverything();
    };
  }, []);

  useEffect(() => {
    let interval: number;
    if (isRecording) {
      interval = window.setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= MAX_SECONDS) { stopRecording(); return prev; }
          return prev + 1;
        });
      }, 1000);
    } else setRecordingTime(0);
    return () => clearInterval(interval);
  }, [isRecording]);

  const stopEverything = () => {
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} recognitionRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(tr => tr.stop());
      streamRef.current = null;
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const startRecording = async () => {
    if (isRecording || isAiThinking) return;
    setError('');
    setLiveTranscript('');
    setFinalTranscript('');
    liveTranscriptRef.current = '';

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || 'audio/webm' });
        if (streamRef.current) { streamRef.current.getTracks().forEach(tr => tr.stop()); streamRef.current = null; }
        await processCapture(blob, mr.mimeType || 'audio/webm');
      };
      mediaRecorderRef.current = mr;
      mr.start();

      // Live Speech Recognition for visual feedback only
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SR) {
        const recognition = new SR();
        recognition.lang = language === 'ru' ? 'ru-RU' : 'en-US';
        recognition.interimResults = true;
        recognition.continuous = true;
        recognition.onresult = (event: any) => {
          let tr = '';
          for (let i = 0; i < event.results.length; ++i) tr += event.results[i][0].transcript;
          liveTranscriptRef.current = tr;
          setLiveTranscript(tr);
        };
        recognition.onerror = () => {};
        recognitionRef.current = recognition;
        try { recognition.start(); } catch {}
      }

      setIsRecording(true);
    } catch (e: any) {
      setError(t.chat.micError);
      console.error(e);
    }
  };

  const stopRecording = () => {
    if (!isRecording) return;
    setIsRecording(false);
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} recognitionRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch {}
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] || '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const processCapture = async (audioBlob: Blob, mimeType: string) => {
    $isAiThinking.set(true);
    setAgentStatus(t.chat.transcribing);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      // Step 1: Transcribe accurately via Gemini audio input
      let transcript = '';
      try {
        const audioB64 = await blobToBase64(audioBlob);
        const transcriptRes = await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: [{
            role: 'user',
            parts: [
              { text: `Transcribe this audio exactly as spoken. Clean filler words (um, uh) but keep meaning. Language: ${language === 'ru' ? 'Russian' : 'English'}. Output only the transcript text, no extra commentary.` },
              { inlineData: { mimeType, data: audioB64 } }
            ]
          }],
          config: { responseMimeType: 'text/plain', thinkingConfig: { thinkingBudget: 0 } }
        });
        transcript = (transcriptRes.text || '').trim();
      } catch (err) {
        console.warn('Gemini transcription failed, using Web Speech fallback', err);
        transcript = liveTranscriptRef.current.trim();
      }

      if (!transcript) transcript = liveTranscriptRef.current.trim();
      if (!transcript) {
        setError(t.chat.emptyTranscript);
        $isAiThinking.set(false);
        setAgentStatus('');
        return;
      }

      setFinalTranscript(transcript);

      // Save user message
      const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: transcript };
      const currentHistory = [...messages, userMsg];
      updateChatMessages(activeChat.id, currentHistory);

      // Step 2: Extract any number of tasks/events from the ramble
      setAgentStatus(t.chat.thinking);
      const now = new Date();
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const extractSys = `You are a gentle capture agent for a user with ADHD/CPTSD. They ramble; you extract.
CONTEXT: ${JSON.stringify(knowledgeBase)}
DATE: ${todayStr} (${dayNames[now.getDay()]})
EXISTING SCHEDULE: ${JSON.stringify(events.filter(e => isItemOnDate(e, todayStr)))}
TRANSCRIPT: "${transcript}"

Extract 0 or more tasks/events. Be generous — capture everything actionable. Do NOT invent things not said.
For each item: decide if it has a specific time (→ event) or is just a thing to do (→ task).
For tasks: infer bucket ("today" if they sound like it's on their mind now, else "later") and energy ("low" / "ok" / "sharp").
If they just vented emotions with nothing actionable, return empty arrays.
Also extract any stable new fact about the user (preference, identity) as newFact — null otherwise.`;

      const extractRes = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: 'Extract items.',
        config: {
          systemInstruction: extractSys,
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: 0 },
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: { type: Type.STRING },
              newFact: { type: Type.STRING, nullable: true },
              tasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING, nullable: true },
                    bucket: { type: Type.STRING },
                    energy: { type: Type.STRING, nullable: true },
                    category: { type: Type.STRING, nullable: true }
                  },
                  required: ['title']
                }
              },
              events: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    date: { type: Type.STRING, nullable: true },
                    startTime: { type: Type.STRING },
                    endTime: { type: Type.STRING },
                    category: { type: Type.STRING, nullable: true },
                    description: { type: Type.STRING, nullable: true }
                  },
                  required: ['title', 'startTime', 'endTime']
                }
              }
            },
            required: ['reply']
          }
        }
      });

      const plan = JSON.parse(extractRes.text || '{}');
      if (plan.newFact) addMemoryItem({ text: plan.newFact, timestamp: Date.now() });

      // Create one assistant message per extracted item so each has its own accept button
      const newMessages: ChatMessage[] = [];
      const replyText = plan.reply || t.chat.gotIt;

      if ((!plan.tasks || plan.tasks.length === 0) && (!plan.events || plan.events.length === 0)) {
        newMessages.push({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: replyText,
          isSynced: true,
        });
      } else {
        let idx = 1;
        for (const tk of (plan.tasks || [])) {
          newMessages.push({
            id: (Date.now() + idx++).toString(),
            role: 'assistant',
            content: idx === 2 ? replyText : '',
            isSynced: false,
            draftTask: {
              title: tk.title,
              description: tk.description || undefined,
              category: tk.category || 'Personal',
              bucket: tk.bucket === 'later' ? 'later' : 'today',
              energy: ['low', 'ok', 'sharp'].includes(tk.energy) ? tk.energy : undefined,
            } as Partial<Task>
          });
        }
        for (const ev of (plan.events || [])) {
          newMessages.push({
            id: (Date.now() + idx++).toString(),
            role: 'assistant',
            content: idx === 2 ? replyText : '',
            isSynced: false,
            draftEvent: {
              title: ev.title,
              date: ev.date || todayStr,
              startTime: ev.startTime,
              endTime: ev.endTime,
              description: ev.description || undefined,
            } as Partial<Event>
          });
        }
      }

      updateChatMessages(activeChat.id, [...currentHistory, ...newMessages]);
    } catch (e: any) {
      console.error(e);
      setError(t.chat.error);
    } finally {
      $isAiThinking.set(false);
      setAgentStatus('');
    }
  };

  const handleAcceptDraft = (msg: ChatMessage) => {
    if (msg.draftTask) {
      const dt = msg.draftTask;
      addTask(
        dt.title || 'Untitled',
        dt.category || 'Personal',
        dt.date || '',
        dt.description,
        (dt.recurrence as any) || 'none',
        undefined,
        dt.bucket || 'today',
        dt.energy
      );
    } else if (msg.draftEvent) {
      addEvent({ ...msg.draftEvent });
    }
    setMessageSynced(activeChat.id, msg.id);
  };

  const handleDiscardDraft = (msg: ChatMessage) => {
    setMessageSynced(activeChat.id, msg.id);
  };

  const handleClearHistory = () => {
    if (messages.length <= 1 || isAiThinking) return;
    if (window.confirm(t.chat.clearConfirm)) {
      updateChatMessages(
        activeChat.id,
        [{ id: Date.now().toString(), role: 'assistant', content: t.chat.initialMsg(prefs.userName, prefs.assistantName) }],
        language === 'en' ? 'New Conversation' : 'Новый разговор'
      );
      setFinalTranscript('');
      setLiveTranscript('');
      setAgentStatus('');
      $isAiThinking.set(false);
    }
  };

  const renderDraftCard = (msg: ChatMessage) => {
    const isTask = !!msg.draftTask;
    const draft = (msg.draftTask || msg.draftEvent) as any;
    return (
      <div key={msg.id} className="stitch-card rounded-2xl p-4 space-y-3 animate-in slide-in-from-bottom-2">
        <div className="flex items-center justify-between">
          <span className="text-[9px] uppercase tracking-widest text-charcoal/40">
            {isTask ? t.calendar.task : t.calendar.event}
          </span>
          {isTask && draft.bucket && (
            <span className="text-[9px] uppercase text-charcoal/30">{draft.bucket === 'later' ? t.tasks.later : t.tasks.today}</span>
          )}
        </div>
        <h4 className="text-[14px] text-charcoal">{draft.title}</h4>
        {!isTask && (
          <p className="text-xs text-charcoal/50">{draft.date} · {draft.startTime}–{draft.endTime}</p>
        )}
        {draft.description && <p className="text-xs text-charcoal/50 whitespace-pre-wrap">{draft.description}</p>}
        <div className="flex gap-2 pt-2">
          <button onClick={() => handleAcceptDraft(msg)} className="flex-1 py-2.5 bg-primary/30 text-charcoal text-[10px] rounded-full">{t.chat.accept}</button>
          <button onClick={() => handleDiscardDraft(msg)} className="px-4 py-2.5 bg-charcoal/[0.04] text-charcoal/50 text-[10px] rounded-full">{t.chat.discard}</button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col gap-6">
      {showSettings && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-charcoal/40 backdrop-blur-md" onClick={() => setShowSettings(false)}></div>
          <div className="relative w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl space-y-6">
            <h2 className="text-xl font-display font-black text-charcoal">{t.settings.title}</h2>
            <div className="space-y-4">
              <div><label className="text-[10px] font-black uppercase text-charcoal/30 mb-1 block">{t.settings.userName}</label><input maxLength={50} className="w-full bg-beige-soft border-none rounded-xl py-3 px-4 font-bold" value={prefs.userName} onChange={(e) => $prefs.set({ ...prefs, userName: e.target.value })} /></div>
              <div><label className="text-[10px] font-black uppercase text-charcoal/30 mb-1 block">{t.settings.assistantName}</label><input maxLength={30} className="w-full bg-beige-soft border-none rounded-xl py-3 px-4 font-bold" value={prefs.assistantName} onChange={(e) => $prefs.set({ ...prefs, assistantName: e.target.value })} /></div>
            </div>
            <button onClick={() => setShowSettings(false)} className="w-full py-4 bg-charcoal text-cream rounded-2xl font-black uppercase text-[10px] tracking-widest">{t.settings.save}</button>
          </div>
        </div>
      )}

      <div className="hidden h-full overflow-y-auto pb-10 scrollbar-hide md:block">
        <section className="mx-auto max-w-5xl space-y-16 py-8">
          <div className="flex flex-col items-center justify-center text-center">
            <h1 className="font-display text-[38px] font-normal text-charcoal">speak your mind.</h1>
            <p className="mt-4 text-[16px] text-muted-ink">tap once to capture a thought, a task, or a feeling.</p>
            <div className="relative mt-12 flex size-60 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-primary/10 [animation-duration:4s]" />
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isAiThinking}
                className={`relative flex size-48 items-center justify-center rounded-full border border-primary/20 transition duration-700 active:scale-95 ${isRecording ? 'bg-[#C87C5E]/20' : 'bg-primary/10 hover:bg-primary/15'}`}
              >
                <span className="flex size-40 items-center justify-center rounded-full border border-primary/10 stitch-card">
                  <span className="material-symbols-outlined text-[64px] text-primary">{isRecording ? 'stop' : 'mic'}</span>
                </span>
              </button>
            </div>
            <p className="mt-5 text-sm text-muted-ink">{isRecording ? `${t.chat.listening} · ${formatTime(recordingTime)}` : t.chat.micPrompt}</p>
          </div>

          <div className="grid grid-cols-12 gap-8">
            <div className="col-span-7 space-y-6">
              <div className="flex items-center justify-between px-2">
                <h2 className="font-display text-[24px]">recent thoughts</h2>
                <button className="text-xs text-muted-ink">view journal</button>
              </div>
              <div className="space-y-4">
                {(recentCaptures.length ? recentCaptures : [
                  { id: 'sample-1', content: 'The way the light hit the oak tree this morning reminded me of that summer in Maine. I want to try painting with more desaturated greens.' },
                  { id: 'sample-2', content: 'remember to breathe when the noise gets too loud. the silence is still there, just underneath.' },
                ]).map((m, index) => (
                  <div key={m.id} className="stitch-card rounded-xl p-7">
                    <div className="mb-5 flex items-center justify-between">
                      <span className="text-[10px] font-medium text-primary/70">{index === 0 ? '10:14 am · reflection' : 'yesterday · note'}</span>
                      <span className="material-symbols-outlined text-sm text-muted-ink">more_horiz</span>
                    </div>
                    <p className="font-display text-[22px] leading-relaxed text-charcoal/85">{m.content}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="col-span-5 space-y-6">
              <div className="px-2">
                <h2 className="font-display text-[24px]">process queue</h2>
                <p className="mt-1 text-[12px] text-muted-ink">captured snippets waiting for a home.</p>
              </div>
              <div className="space-y-4">
                {pendingDrafts.map((msg: ChatMessage) => {
                  const isTask = !!msg.draftTask;
                  const draft = (msg.draftTask || msg.draftEvent) as any;
                  return (
                    <div key={msg.id} className="stitch-card rounded-xl p-5">
                      <div className="flex items-start gap-4">
                        <span className="mt-2 size-2 rounded-full bg-primary/45" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-charcoal">"{draft.title}"</p>
                          <p className="mt-2 text-xs text-muted-ink">captured via voice</p>
                        </div>
                      </div>
                      <div className="mt-5 flex items-center gap-2">
                        <button onClick={() => handleAcceptDraft(msg)} className="flex-1 rounded-lg bg-primary/10 px-3 py-2 text-xs font-medium text-sage-deep hover:bg-primary/20 transition">
                          {isTask ? '✓ keep as task' : 'add to calendar'}
                        </button>
                        <button onClick={() => handleDiscardDraft(msg)} className="p-2 text-muted-ink hover:text-[#c8695e] transition">
                          <span className="material-symbols-outlined text-[18px]">delete_outline</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
                {pendingDrafts.length === 0 && (
                  <div className="rounded-xl border border-dashed border-paper-edge/60 p-8 text-center">
                    <span className="material-symbols-outlined text-paper-edge">auto_awesome</span>
                    <p className="mx-auto mt-3 max-w-[220px] text-[12px] leading-relaxed text-muted-ink">your mind is for having ideas, not for holding them.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="flex items-center justify-between px-2 pt-1 md:hidden">
        <h2 className="text-[9px] tracking-[0.22em] text-charcoal/28">{t.chat.capacity(todayEventsCount, todayTasksCount)}</h2>
        <div className="flex gap-2">
          <button onClick={handleClearHistory} disabled={messages.length <= 1 || isAiThinking} className="flex size-8 items-center justify-center rounded-full text-charcoal/25 transition hover:bg-white/60 hover:text-red-500 disabled:opacity-30"><span className="material-symbols-outlined text-[18px]">sweep</span></button>
          <button onClick={() => setShowSettings(true)} className="flex size-8 items-center justify-center rounded-full text-charcoal/25 transition hover:bg-white/60 hover:text-charcoal"><span className="material-symbols-outlined text-[18px]">settings</span></button>
        </div>
      </div>

      {/* Mic stage */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-2 min-h-0 overflow-y-auto scrollbar-hide pb-8 md:hidden">
        <div className="relative flex size-48 items-center justify-center">
          <span className="absolute inset-0 rounded-full border border-charcoal/[0.05]" />
          <span className="absolute inset-4 rounded-full border border-charcoal/[0.045]" />
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isAiThinking}
            className={`relative size-32 rounded-full flex items-center justify-center transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_18px_45px_rgba(91,112,92,0.16)] ${
            isRecording
              ? 'bg-[#c8695e] scale-105'
              : isAiThinking
              ? 'bg-charcoal/15 cursor-wait'
              : 'bg-primary/35 hover:scale-105 active:scale-95'
          }`}
          >
            {isRecording && <span className="absolute inset-0 rounded-full bg-[#c8695e]/30 animate-ping"></span>}
            <span className={`material-symbols-outlined ${isRecording ? 'text-white text-[42px]' : 'text-charcoal text-[42px]'}`}>
              {isAiThinking ? 'sync' : isRecording ? 'stop' : 'mic'}
            </span>
            {isAiThinking && <span className="absolute inset-0 rounded-full border-2 border-charcoal/15 border-t-charcoal/45 animate-spin"></span>}
          </button>
        </div>

        <div className="text-center min-h-[3rem]">
          {isRecording && (
            <p className="text-[10px] tracking-[0.26em] text-[#b65d54] mb-2">{t.chat.listening} · {formatTime(recordingTime)}</p>
          )}
          {!isRecording && !isAiThinking && !finalTranscript && (
            <p className="font-display text-[15px] italic text-charcoal/55 max-w-sm">{t.chat.micPrompt}</p>
          )}
          {isAiThinking && agentStatus && (
            <p className="text-[10px] tracking-[0.26em] text-charcoal/40 animate-pulse">{agentStatus}</p>
          )}
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        </div>

        {/* Live or final transcript */}
        {(liveTranscript || finalTranscript) && (
          <div className="stitch-card w-full rounded-2xl p-5 max-h-48 overflow-y-auto scrollbar-hide">
            <p className="text-[9px] uppercase tracking-widest text-charcoal/30 mb-2">
              {isRecording ? t.chat.listening : t.chat.youSaid}
            </p>
            <p className="text-sm text-charcoal/80 leading-relaxed whitespace-pre-wrap">
              {isRecording ? liveTranscript : finalTranscript}
            </p>
          </div>
        )}

        <div className="w-full space-y-3 md:hidden">
          {pendingDrafts.length > 0 && (
            <>
              <p className="text-[9px] uppercase tracking-widest text-charcoal/30">{t.chat.drafts}</p>
              {pendingDrafts.map(renderDraftCard)}
            </>
          )}
          {recentCaptures.length > 0 && !isRecording && (
            <div className="w-full pt-4 border-t border-charcoal/[0.05] space-y-2">
              <p className="text-[9px] uppercase tracking-widest text-charcoal/30">{t.chat.recent}</p>
              {recentCaptures.map(m => (
                <p key={m.id} className="font-display text-xs italic text-charcoal/40 leading-relaxed line-clamp-2">{m.content}</p>
              ))}
            </div>
          )}
        </div>
      </div>

      <aside className="hidden min-h-0 flex-col gap-5 overflow-y-auto rounded-[2rem] border border-charcoal/[0.05] bg-white/[0.16] p-6 scrollbar-hide">
        <div>
          <p className="text-[9px] uppercase tracking-[0.22em] text-charcoal/30">{t.chat.drafts}</p>
          <p className="mt-2 font-display text-[18px] italic text-charcoal">keep or discard</p>
        </div>
        <div className="space-y-3">
          {pendingDrafts.length ? pendingDrafts.map(renderDraftCard) : (
            <div className="stitch-card rounded-2xl p-5">
              <p className="font-display text-sm italic text-charcoal/38">captured items will wait here.</p>
            </div>
          )}
        </div>

        <div className="mt-auto border-t border-charcoal/[0.05] pt-5">
          <p className="text-[9px] uppercase tracking-[0.22em] text-charcoal/30">{t.chat.recent}</p>
          <div className="mt-3 space-y-3">
            {recentCaptures.length ? recentCaptures.map(m => (
              <p key={m.id} className="font-display text-sm italic leading-relaxed text-charcoal/45">{m.content}</p>
            )) : (
              <p className="font-display text-sm italic text-charcoal/35">no recent captures yet.</p>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
};

export default ChatView;
