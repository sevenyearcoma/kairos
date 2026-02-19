
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { ChatMessage, Event, Task, ChatSession, Personality, Language, MemoryItem, UserPreferences, TaskPriority, KnowledgeBase } from '../types';
import { isItemOnDate } from '../utils/dateUtils';
import { getT } from '../translations';

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

interface ChatViewProps {
  activeChat: ChatSession;
  chats: ChatSession[];
  personality: Personality;
  tasks: Task[];
  events: Event[];
  memory: MemoryItem[];
  knowledgeBase: KnowledgeBase;
  language: Language;
  prefs: UserPreferences;
  isAiThinking: boolean;
  setIsAiThinking: (val: boolean) => void;
  onSetActiveChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
  onUpdateMessages: (chatId: string, messages: ChatMessage[], newTitle?: string) => void;
  onAddEvent: (event: Partial<Event>) => void;
  onAddTask: (title: string, category: string, date: string, description?: string, recurrence?: Task['recurrence'], priority?: TaskPriority) => void;
  onRescheduleTask: (taskId: string, newDate: string, isExternal: boolean) => void;
  onBulkReschedule: (taskIds: string[], eventIds: string[], newDate: string, isExternal: boolean) => void;
  onAddMemory: (item: MemoryItem) => void;
  onUpdateKnowledgeBase: (kb: KnowledgeBase) => void;
  onSetSynced: (chatId: string, messageId: string) => void;
  onUpdatePrefs: (prefs: UserPreferences) => void;
}

const ChatView: React.FC<ChatViewProps> = ({ 
  activeChat, tasks, events, knowledgeBase, language, prefs, isAiThinking, setIsAiThinking, onUpdateMessages, onAddEvent, onAddTask, onAddMemory, onUpdateKnowledgeBase, onSetSynced, onUpdatePrefs
}) => {
  const [input, setInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [agentStatus, setAgentStatus] = useState<string>(''); 
  
  const [isListening, setIsListening] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recognitionRef = useRef<any>(null);
  const baseInputRef = useRef('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const t = useMemo(() => getT(language), [language]);

  const messages = (activeChat?.messages || []);

  const { todayStr, tomorrowStr, todayEventsCount, todayTasksCount } = useMemo(() => {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    const localDate = new Date(d.getTime() - offset);
    const tStr = localDate.toISOString().split('T')[0];
    const tmr = new Date(localDate);
    tmr.setDate(tmr.getDate() + 1);
    const tmrStr = tmr.toISOString().split('T')[0];
    return {
      todayStr: tStr,
      tomorrowStr: tmrStr,
      todayEventsCount: events.filter(e => isItemOnDate(e, tStr)).length,
      todayTasksCount: tasks.filter(t => isItemOnDate(t, tStr) && !t.completed).length
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

  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = language === 'ru' ? 'ru-RU' : 'en-US';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.onstart = () => { setIsListening(true); setRecordingTime(0); baseInputRef.current = input; };
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      let currentTranscript = '';
      for (let i = 0; i < event.results.length; ++i) currentTranscript += event.results[i][0].transcript;
      if (currentTranscript) {
        const separator = baseInputRef.current && !baseInputRef.current.endsWith(' ') ? ' ' : '';
        setInput(baseInputRef.current + separator + currentTranscript);
      }
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleClearChat = () => {
    if (messages.length <= 1 || isAiThinking) return;
    if (window.confirm(t.chat.clearConfirm)) {
      const initialMsgContent = t.chat.initialMsg(prefs.userName, prefs.assistantName);
      onUpdateMessages(activeChat.id, [{ id: Date.now().toString(), role: 'assistant', content: initialMsgContent }], language === 'en' ? 'New Conversation' : 'Новый разговор');
      setInput('');
      setAgentStatus('');
      setIsAiThinking(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isAiThinking) return;
    
    const userText = input;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: userText };
    const currentHistory = [...messages, userMsg];
    onUpdateMessages(activeChat.id, currentHistory);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setIsAiThinking(true);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      let currentKnowledge = knowledgeBase;

      setAgentStatus(t.chat.updatingMemory);
      const memorySystemInstruction = `Role: Kairos Memory Manager. Maintain Knowledge Base JSON. User Knowledge: ${JSON.stringify(knowledgeBase)}. User said: "${userText}". Output ONLY updated JSON.`;
      const memoryResponse = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: "Update memory based on the latest interaction.", config: { systemInstruction: memorySystemInstruction, responseMimeType: "application/json" } });
      try {
        const updatedKb = JSON.parse(memoryResponse.text || "{}");
        if (Object.keys(updatedKb).length > 0) {
          onUpdateKnowledgeBase(updatedKb);
          currentKnowledge = updatedKb;
        }
      } catch (err) { console.warn("Memory update failed", err); }

      const now = new Date();
      const offset = now.getTimezoneOffset() * 60000;
      const currentTimeStr = new Date(now.getTime() - offset).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
      const relevantEvents = events.filter(e => {
        const eDate = new Date(e.date);
        const diff = (eDate.getTime() - now.getTime()) / (1000 * 3600 * 24);
        return diff >= -1 && diff <= 7;
      });

      setAgentStatus(t.chat.thinking);
      const architectSystemInstruction = `
        You are the 'Architect' of Kairos. 
        DATE: ${todayStr}, TIME: ${currentTimeStr}.
        TOMORROW DATE: ${tomorrowStr}.
        SCHEDULE: ${JSON.stringify(relevantEvents)}.
        
        TASK:
        Parse intent: 'create_event', 'create_task', 'general'.
        
        STRICT RULES:
        - "Title" must be SHORT (1-4 words). Example: "Sync with Team", NOT a whole sentence.
        - Check for conflicts in the provided SCHEDULE. If busy at requested time, suggest the next free slot.
        - If conflict exists, describe it in kairosInsight.message.
        
        Output JSON ONLY.
      `;

      const architectResponse = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: userText,
        config: {
          systemInstruction: architectSystemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              intent: { type: Type.STRING, enum: ["general", "create_event", "create_task"] },
              kairosInsight: { 
                type: Type.OBJECT, 
                properties: { message: { type: Type.STRING } },
                nullable: true 
              },
              details: { 
                type: Type.OBJECT, 
                properties: { 
                  title: { type: Type.STRING }, 
                  date: { type: Type.STRING }, 
                  startTime: { type: Type.STRING }, 
                  endTime: { type: Type.STRING }, 
                  category: { type: Type.STRING }, 
                  description: { type: Type.STRING }, 
                  priority: { type: Type.STRING }
                }, 
                nullable: true 
              }
            },
            required: ["intent"]
          }
        }
      });

      const architectPlan = JSON.parse(architectResponse.text || "{}");
      
      setAgentStatus(t.chat.refining);
      const editorSystemInstruction = `
        Kairos Voice. Respond to: "${userText}". 
        Plan: ${JSON.stringify(architectPlan)}. 
        Language: ${language === 'ru' ? 'Russian' : 'English'}.
        Tone: ${currentKnowledge.preferences?.tone || "Warm and helpful"}.
        
        IMPORTANT: Your response is PLAIN TEXT only. Do not repeat the internal JSON fields. Just speak to the user.
      `;
      const editorResponse = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: "Speak to the user about this plan.", 
        config: { systemInstruction: editorSystemInstruction } 
      });
      const finalReply = editorResponse.text;

      const draftEventData = architectPlan.intent === 'create_event' && architectPlan.details ? { ...architectPlan.details, date: architectPlan.details.date || todayStr } : undefined;
      const draftTaskData = architectPlan.intent === 'create_task' && architectPlan.details ? { ...architectPlan.details, date: architectPlan.details.date || todayStr } : undefined;

      const aiMsg: ChatMessage = { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant', 
        content: finalReply, 
        isSynced: false, 
        kairosInsight: architectPlan.kairosInsight, 
        draftTask: draftTaskData, 
        draftEvent: draftEventData 
      };
      onUpdateMessages(activeChat.id, [...currentHistory, aiMsg]);
    } catch (e: any) { 
      onUpdateMessages(activeChat.id, [...currentHistory, { id: Date.now().toString(), role: 'assistant', content: t.chat.error }]);
    } finally { setIsAiThinking(false); setAgentStatus(''); }
  };

  const handleAcceptDraft = (msg: ChatMessage) => {
    if (msg.draftTask) onAddTask(msg.draftTask.title || 'Untitled', msg.draftTask.category || 'Personal', msg.draftTask.date || todayStr, msg.draftTask.description, msg.draftTask.recurrence as any || 'none', msg.draftTask.priority as any || 'normal');
    else if (msg.draftEvent) onAddEvent({ ...msg.draftEvent });
    onSetSynced(activeChat.id, msg.id);
  };

  return (
    <div className="flex flex-col h-full gap-8 max-w-4xl mx-auto">
      {showSettings && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-charcoal/40 backdrop-blur-md" onClick={() => setShowSettings(false)}></div>
          <div className="relative w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl space-y-6">
             <h2 className="text-xl font-display font-black text-charcoal">{t.settings.title}</h2>
             <div className="space-y-4">
                <div><label className="text-[10px] font-black uppercase text-charcoal/30 mb-1 block">{t.settings.userName}</label><input maxLength={50} className="w-full bg-beige-soft border-none rounded-xl py-3 px-4 font-bold" value={prefs.userName} onChange={(e) => onUpdatePrefs({...prefs, userName: e.target.value})} /></div>
                <div><label className="text-[10px] font-black uppercase text-charcoal/30 mb-1 block">{t.settings.assistantName}</label><input maxLength={30} className="w-full bg-beige-soft border-none rounded-xl py-3 px-4 font-bold" value={prefs.assistantName} onChange={(e) => onUpdatePrefs({...prefs, assistantName: e.target.value})} /></div>
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
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-8 space-y-8 scrollbar-hide">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] p-5 rounded-3xl text-[14px] leading-relaxed shadow-sm transition-all ${msg.role === 'user' ? 'bg-charcoal text-white rounded-tr-none' : 'bg-white border border-charcoal/10 text-charcoal rounded-tl-none'}`}>
                <div className="whitespace-pre-wrap">{msg.content}</div>
                {msg.kairosInsight && <div className="mt-4 p-4 rounded-2xl bg-primary/5 border border-primary/20 flex gap-3"><span className="material-symbols-outlined text-[18px] text-primary">tips_and_updates</span><p className="text-[11px] font-bold text-charcoal/80">{msg.kairosInsight.message}</p></div>}
                {(msg.draftTask || msg.draftEvent) && (
                  <div className="mt-5 bg-beige-soft border border-charcoal/5 text-charcoal rounded-2xl overflow-hidden shadow-sm">
                    <div className="p-5 space-y-4">
                      <div>
                        <p className="text-[9px] font-black uppercase opacity-40 mb-1">{msg.draftTask ? t.calendar.task : t.calendar.event}</p>
                        <h4 className="font-extrabold text-charcoal text-lg">{(msg.draftTask || msg.draftEvent)?.title}</h4>
                      </div>
                      <div className="flex items-center gap-4 text-[10px] font-bold text-charcoal/60">
                         <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">calendar_month</span>{(msg.draftTask || msg.draftEvent)?.date}</span>
                         {msg.draftEvent && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">schedule</span>{msg.draftEvent.startTime} — {msg.draftEvent.endTime}</span>}
                      </div>
                      <button onClick={() => handleAcceptDraft(msg)} disabled={msg.isSynced} className="w-full py-3.5 bg-charcoal text-cream text-[10px] font-black uppercase rounded-xl disabled:opacity-30 hover:bg-primary hover:text-charcoal transition-all shadow-md active:scale-95">{msg.isSynced ? t.chat.added : t.chat.accept}</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isAiThinking && <div className="flex items-center gap-3 animate-pulse-gentle"><div className="size-2 bg-primary rounded-full"></div><div className="text-[10px] uppercase font-black text-charcoal/30 tracking-widest">{agentStatus || t.chat.thinking}</div></div>}
        </div>
        <div className="px-6 py-6 border-t border-charcoal/5 bg-white/60">
          <div className="flex items-end gap-3">
            <div className="relative flex-1">
              <textarea ref={textareaRef} className={`w-full bg-white border border-charcoal/10 focus:ring-primary focus:border-primary rounded-2xl py-4 pl-6 pr-14 text-sm font-medium transition-all resize-none overflow-y-auto min-h-[56px] max-h-[200px] scrollbar-hide ${isListening ? 'ring-2 ring-red-500/20 shadow-lg' : ''}`} placeholder={isListening ? t.chat.listening : t.chat.placeholder} value={input} readOnly={isAiThinking} rows={1} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())} />
              <div className="absolute right-2 bottom-2">
                <button onClick={toggleListening} className={`h-10 w-10 flex items-center justify-center rounded-xl transition-all ${isListening ? 'bg-red-500 text-white shadow-lg scale-110' : 'text-charcoal/20 hover:text-charcoal'}`}>
                  <span className="material-symbols-outlined text-[20px]">{isListening ? 'stop' : 'mic'}</span>
                </button>
              </div>
            </div>
            <button onClick={handleSend} disabled={isAiThinking || !input.trim()} className="h-[56px] w-[56px] bg-charcoal text-cream rounded-2xl flex items-center justify-center shadow-lg hover:bg-primary hover:text-charcoal transition-all disabled:opacity-20 shrink-0 active:scale-90"><span className="material-symbols-outlined">send</span></button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatView;
