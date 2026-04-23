import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useStore } from '@nanostores/react';
import { GoogleGenAI, Type } from '@google/genai';
import type { ChatMessage, ChatSession } from '../types';
import { isItemOnDate } from '../utils/dateUtils';
import { getT } from '../translations';
import { $tasks, $events, $knowledgeBase, $language, $prefs, $isAiThinking, addEvent, addTask, addMemoryItem, updateChatMessages, setMessageSynced, getLocalDateStr } from '../stores/app';

declare global {
  interface Window { webkitSpeechRecognition: any; SpeechRecognition: any; }
}

const ChatView: React.FC<{ activeChat: ChatSession }> = ({ activeChat }) => {
  const tasks = useStore($tasks);
  const events = useStore($events);
  const knowledgeBase = useStore($knowledgeBase);
  const language = useStore($language);
  const prefs = useStore($prefs);
  const isAiThinking = useStore($isAiThinking);

  const [input, setInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [agentStatus, setAgentStatus] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recognitionRef = useRef<any>(null);
  const baseInputRef = useRef('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isAiThinking, agentStatus]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  useEffect(() => { return () => { if (recognitionRef.current) recognitionRef.current.stop(); }; }, []);

  useEffect(() => {
    let interval: number;
    if (isListening) {
      interval = window.setInterval(() => {
        setRecordingTime(prev => { if (prev >= 120) { stopListening(); return prev; } return prev + 1; });
      }, 1000);
    } else setRecordingTime(0);
    return () => clearInterval(interval);
  }, [isListening]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const stopListening = () => { if (recognitionRef.current) recognitionRef.current.stop(); setIsListening(false); };

  const toggleListening = () => {
    if (isListening) { stopListening(); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Voice input is not supported.'); return; }
    const recognition = new SR();
    recognition.lang = language === 'ru' ? 'ru-RU' : 'en-US';
    recognition.interimResults = true; recognition.maxAlternatives = 1; recognition.continuous = true;
    recognition.onstart = () => { setIsListening(true); setRecordingTime(0); baseInputRef.current = input; };
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      let tr = '';
      for (let i = 0; i < event.results.length; ++i) tr += event.results[i][0].transcript;
      if (tr) { const sep = baseInputRef.current && !baseInputRef.current.endsWith(' ') ? ' ' : ''; setInput(baseInputRef.current + sep + tr); }
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleClearChat = () => {
    if (messages.length <= 1 || isAiThinking) return;
    if (window.confirm(t.chat.clearConfirm)) {
      updateChatMessages(activeChat.id, [{ id: Date.now().toString(), role: 'assistant', content: t.chat.initialMsg(prefs.userName, prefs.assistantName) }], language === 'en' ? 'New Conversation' : 'Новый разговор');
      setInput(''); setAgentStatus(''); $isAiThinking.set(false);
    }
  };

  const handleSend = async () => {
    if (isListening) stopListening();
    if (!input.trim() || isAiThinking) return;
    const userText = input;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: userText };
    const currentHistory = [...messages, userMsg];
    updateChatMessages(activeChat.id, currentHistory);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    $isAiThinking.set(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      let currentKnowledge = knowledgeBase;

      setAgentStatus(t.chat.updatingMemory);
      const memSys = `Role: Kairos Memory Manager. TASK: Maintain Knowledge Base JSON. CONTEXT: ${JSON.stringify(knowledgeBase)}. USER: "${userText}". RULES: 1. Extract facts. 2. Merge points. 3. Limit ~15 pts. 4. Evict old. OUTPUT: Full Updated JSON.`;
      const memRes = await ai.models.generateContent({ model: 'gemini-2.0-flash', contents: 'Update Context.', config: { systemInstruction: memSys, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } } });
      try {
        const updatedKb = JSON.parse(memRes.text || '{}');
        if (Object.keys(updatedKb).length > 0) {
          $knowledgeBase.set(updatedKb); currentKnowledge = updatedKb;
          if (updatedKb.user_name && updatedKb.user_name !== prefs.userName) $prefs.set({ ...prefs, userName: updatedKb.user_name });
        }
      } catch (err) { console.warn('Memory Agent failed', err); }

      const now = new Date();
      const currentTimeStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const chatHistoryStr = currentHistory.slice(-6).map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

      setAgentStatus(t.chat.thinking);
      const archSys = `You are the 'Architect' module of Kairos.\nCONTEXT: ${JSON.stringify(currentKnowledge)}. DATE: ${todayStr} (${dayNames[now.getDay()]}). TIME: ${currentTimeStr}.\nEXISTING SCHEDULE (Avoid Overlaps!): ${JSON.stringify(events.filter(e => isItemOnDate(e, todayStr)))}\nREQUEST: "${userText}"\nHISTORY: ${chatHistoryStr}\nTASK: Determine intent ('create_event', 'create_task', 'general', 'update_prefs').\nTIME RULES:\n1. endTime MUST be after startTime.\n2. NO OVERLAP with existing schedule.\n3. Title < 6 words.\nOutput JSON ONLY.`;
      const archRes = await ai.models.generateContent({
        model: 'gemini-2.0-flash', contents: 'Analyze.',
        config: {
          systemInstruction: archSys, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 },
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              intent: { type: Type.STRING, enum: ['general', 'create_event', 'create_task', 'update_prefs'] },
              newFact: { type: Type.STRING, nullable: true },
              kairosInsight: { type: Type.OBJECT, properties: { type: { type: Type.STRING }, message: { type: Type.STRING } }, nullable: true },
              details: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, date: { type: Type.STRING }, startTime: { type: Type.STRING }, endTime: { type: Type.STRING }, category: { type: Type.STRING }, description: { type: Type.STRING }, priority: { type: Type.STRING }, recurrence: { type: Type.STRING } }, nullable: true }
            },
            required: ['intent']
          }
        }
      });
      const plan = JSON.parse(archRes.text || '{}');

      setAgentStatus(t.chat.refining);
      const editorSys = `Kairos Assistant. User Knowledge: ${JSON.stringify(currentKnowledge)}. Architect Plan: ${JSON.stringify(plan)}. Request: "${userText}". Language: ${language === 'ru' ? 'Russian' : 'English'}. Tone: ${currentKnowledge.preferences?.tone || 'Professional yet warm'}. Concisely respond to the user. Output PLAIN TEXT only.`;
      const editorRes = await ai.models.generateContent({ model: 'gemini-2.0-flash', contents: 'Generate response.', config: { systemInstruction: editorSys, responseMimeType: 'text/plain', thinkingConfig: { thinkingBudget: 0 } } });

      if (plan.newFact) addMemoryItem({ text: plan.newFact, timestamp: Date.now() });
      const draftEvent = plan.intent === 'create_event' && plan.details ? { ...plan.details, date: plan.details.date || todayStr, startTime: plan.details.startTime || '09:00', endTime: plan.details.endTime || '10:00' } : undefined;
      const draftTask = plan.intent === 'create_task' && plan.details ? { ...plan.details, date: plan.details.date || todayStr, priority: plan.details.priority || 'normal' } : undefined;

      const aiMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: editorRes.text, isSynced: false, kairosInsight: plan.kairosInsight, draftTask, draftEvent };
      updateChatMessages(activeChat.id, [...currentHistory, aiMsg]);
    } catch (e: any) {
      updateChatMessages(activeChat.id, [...messages, userMsg, { id: Date.now().toString(), role: 'assistant', content: t.chat.error }]);
    } finally { $isAiThinking.set(false); setAgentStatus(''); }
  };

  const handleAcceptDraft = (msg: ChatMessage) => {
    if (msg.draftTask) addTask(msg.draftTask.title || 'Untitled', msg.draftTask.category || 'Personal', msg.draftTask.date || todayStr, msg.draftTask.description, msg.draftTask.recurrence as any || 'none', msg.draftTask.priority as any || 'normal');
    else if (msg.draftEvent) addEvent({ ...msg.draftEvent });
    setMessageSynced(activeChat.id, msg.id);
  };

  const hasSpeechSupport = typeof window !== 'undefined' && (!!window.SpeechRecognition || !!window.webkitSpeechRecognition);

  return (
    <div className="flex flex-col h-full gap-8 max-w-4xl mx-auto">
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
      <div className="flex items-center justify-between px-6">
        <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-charcoal/20">{t.chat.capacity(todayEventsCount, todayTasksCount)}</h2>
        <div className="flex gap-2">
          <button onClick={handleClearChat} disabled={messages.length <= 1 || isAiThinking} className="size-10 bg-white border border-charcoal/5 rounded-xl flex items-center justify-center text-charcoal/40 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-30"><span className="material-symbols-outlined text-xl">sweep</span></button>
          <button onClick={() => setShowSettings(true)} className="size-10 bg-white border border-charcoal/5 rounded-xl flex items-center justify-center text-charcoal/40 hover:text-charcoal transition-all"><span className="material-symbols-outlined text-xl">settings</span></button>
        </div>
      </div>
      <div className="flex-1 flex flex-col min-h-0 bg-white/40 border border-charcoal/5 rounded-[2.5rem] shadow-sm overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-8 space-y-6 scrollbar-hide">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] p-5 rounded-3xl text-[14px] leading-relaxed ${msg.role === 'user' ? 'bg-charcoal text-white rounded-tr-none' : 'bg-white border border-charcoal/10 text-charcoal rounded-tl-none shadow-sm'}`}>
                <div className="whitespace-pre-wrap">{msg.content}</div>
                {msg.kairosInsight && <div className="mt-4 p-4 rounded-2xl bg-primary/5 border border-primary/20 flex gap-3"><span className="material-symbols-outlined text-[18px] text-primary">tips_and_updates</span><p className="text-[11px] font-bold text-charcoal/80">{msg.kairosInsight.message}</p></div>}
                {(msg.draftTask || msg.draftEvent) && (
                  <div className="mt-4 p-4 bg-beige-soft border border-charcoal/5 text-charcoal rounded-2xl space-y-3">
                    <p className="text-[9px] font-black uppercase opacity-40">{msg.draftTask ? t.calendar.task : t.calendar.event}</p>
                    <h4 className="font-extrabold text-charcoal">{(msg.draftTask || msg.draftEvent)?.title}</h4>
                    <button onClick={() => handleAcceptDraft(msg)} disabled={msg.isSynced} className="w-full py-2.5 bg-charcoal text-cream text-[9px] font-black uppercase rounded-xl disabled:opacity-30 transition-all">{msg.isSynced ? t.chat.added : t.chat.accept}</button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isAiThinking && <div className="flex items-center gap-3 animate-pulse-gentle"><div className="size-2 bg-primary rounded-full"></div><div className="text-[10px] uppercase font-black text-charcoal/30">{agentStatus || t.chat.thinking}</div></div>}
        </div>
        <div className="px-6 py-6 border-t border-charcoal/5 bg-white/60">
          <div className="flex items-end gap-3">
            <div className="relative flex-1">
              {isListening && <div className="absolute inset-0 rounded-2xl bg-red-500/10 animate-pulse pointer-events-none"></div>}
              <textarea ref={textareaRef} className={`w-full bg-white border border-charcoal/10 focus:ring-primary focus:border-primary rounded-2xl py-4 pl-6 pr-14 text-sm font-medium transition-all resize-none overflow-y-auto min-h-[56px] max-h-[200px] scrollbar-hide ${isListening ? 'ring-2 ring-red-500/20' : ''}`} placeholder={isListening ? t.chat.listening : t.chat.placeholder} value={input} readOnly={isAiThinking || isListening} rows={1} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())} />
              {hasSpeechSupport && <div className="absolute right-2 bottom-2"><button onClick={toggleListening} className={`h-10 w-10 flex items-center justify-center rounded-xl transition-all ${isListening ? 'bg-red-500 text-white' : 'text-charcoal/20 hover:text-charcoal'}`}><span className="material-symbols-outlined text-[20px]">{isListening ? 'stop' : 'mic'}</span></button></div>}
            </div>
            <button onClick={handleSend} disabled={isAiThinking || !input.trim()} className="h-[56px] w-[56px] bg-charcoal text-cream rounded-2xl flex items-center justify-center shadow-lg hover:bg-primary hover:text-charcoal transition-all disabled:opacity-20 shrink-0"><span className="material-symbols-outlined">send</span></button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatView;
