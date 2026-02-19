
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { ChatMessage, Event, Task, ChatSession, Personality, Language, MemoryItem, UserPreferences, TaskPriority, KnowledgeBase } from '../types';
import { isItemOnDate } from '../utils/dateUtils';
import { getT } from '../translations';

// Extend Window interface for Web Speech API support
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
  activeChat, personality, tasks, events, memory, knowledgeBase, language, prefs, isAiThinking, setIsAiThinking, onUpdateMessages, onAddEvent, onAddTask, onAddMemory, onUpdateKnowledgeBase, onSetSynced, onUpdatePrefs
}) => {
  const [input, setInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [agentStatus, setAgentStatus] = useState<string>(''); // For UI feedback on double-agent steps
  
  // Voice Input State
  const [isListening, setIsListening] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recognitionRef = useRef<any>(null);
  const baseInputRef = useRef(''); // Stores text present before recording started

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const t = useMemo(() => getT(language), [language]);

  const messages = (activeChat?.messages || []);

  // Compute local date logic once per render for display stats
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

  // Auto-resize Textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  // Clean up speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Timer for recording
  useEffect(() => {
    let interval: number;
    if (isListening) {
      interval = window.setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 120) { // 120 seconds = 2 minutes limit
            stopListening();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      setRecordingTime(0);
    }
    return () => clearInterval(interval);
  }, [isListening]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = language === 'ru' ? 'ru-RU' : 'en-US';
    recognition.interimResults = true; // Crucial for Russian
    recognition.maxAlternatives = 1;
    recognition.continuous = true;

    recognition.onstart = () => {
      setIsListening(true);
      setRecordingTime(0);
      baseInputRef.current = input; // Capture existing text
    };
    
    recognition.onend = () => {
      setIsListening(false); 
    };
    
    recognition.onresult = (event: any) => {
      let currentTranscript = '';
      
      // Reconstruct transcript from all results (final + interim)
      // This is vital for Russian where 'isFinal' is delayed
      for (let i = 0; i < event.results.length; ++i) {
        currentTranscript += event.results[i][0].transcript;
      }

      if (currentTranscript) {
        // Append current session transcript to what was there before recording started
        const separator = baseInputRef.current && !baseInputRef.current.endsWith(' ') ? ' ' : '';
        setInput(baseInputRef.current + separator + currentTranscript);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleClearChat = () => {
    if (messages.length <= 1) return;
    if (window.confirm(t.chat.clearConfirm)) {
      // Keep only the first message (the welcome message)
      const firstMsg = messages[0];
      onUpdateMessages(activeChat.id, [firstMsg]);
    }
  };

  const handleSend = async () => {
    if (isListening) stopListening();
    if (!input.trim() || isAiThinking) return;
    
    const userText = input;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: userText };
    
    // Protect against stale messages prop by building the new history locally
    const currentHistory = [...messages, userMsg];
    onUpdateMessages(activeChat.id, currentHistory);
    
    setInput('');
    // Reset height immediately
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    setIsAiThinking(true);
    
    // START AI PIPELINE
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      let currentKnowledge = knowledgeBase;

      // --- STEP 0: MEMORY MANAGER AGENT ---
      setAgentStatus(t.chat.updatingMemory); // "Updating context..."
      
      const memorySystemInstruction = `
        Role: Kairos Memory Manager.
        Task: Maintain a curated "User Knowledge Base" in JSON format.
        
        Current Knowledge Context:
        ${JSON.stringify(knowledgeBase)}

        User Input: "${userText}"

        RULES:
        1. EXTRACT: Identify new facts about the user (e.g., job, tech stack, habits, goals, aesthetics).
        2. MERGE: Combine related facts into a single point. 
           Example: "React Developer" + "Uses Next.js" -> "Frontend Stack: React, Next.js".
        3. LIMIT: The knowledge base should contain approx 15 distinct high-level "knowledge points" (keys or array items).
        4. EVICT: If the limit is reached, remove the least relevant or oldest fact to make room for new, more important info.
        5. OUTPUT: Return the FULL updated JSON object. Structure it as a flat object or categorical object.
        
        Focus on: user_name, background, current_projects, interests, preferences.
      `;

      const memoryResponse = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: "Update Context.",
        config: {
          systemInstruction: memorySystemInstruction,
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: 0 },
        }
      });
      
      try {
        const updatedKb = JSON.parse(memoryResponse.text || "{}");
        if (Object.keys(updatedKb).length > 0) {
          onUpdateKnowledgeBase(updatedKb);
          currentKnowledge = updatedKb;
          
          // Sync name if changed
          if (updatedKb.user_name && updatedKb.user_name !== prefs.userName) {
            onUpdatePrefs({ ...prefs, userName: updatedKb.user_name });
          }
        }
      } catch (err) {
        console.warn("Memory Agent failed to parse JSON, using old context", err);
      }

      // --- CONTEXT CONSTRUCTION ---
      const now = new Date();
      const offset = now.getTimezoneOffset() * 60000;
      const currentTimeStr = new Date(now.getTime() - offset).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const currentDayName = dayNames[now.getDay()];

      const chatHistoryStr = currentHistory.slice(-6).map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

      // --- STEP 1: ARCHITECT (Structural Logic) ---
      setAgentStatus(t.chat.thinking); // "Kairos is planning..."

      const architectSystemInstruction = `
        You are the 'Architect' module of Kairos.
        User Context (Memory Agent Output): ${JSON.stringify(currentKnowledge)}
        Date: ${todayStr} (${currentDayName}). Time: ${currentTimeStr}.

        Analyze the Request: "${userText}"
        History:
        ${chatHistoryStr}

        Task: Extract intent and structured data.
        1. Intent: 'create_event' (timed), 'create_task' (untimed/todo), 'general' (chat), 'update_prefs'.
        2. Extract any new user facts to 'newFact'.
        3. Determine 'kairosInsight' (warning/tip) if needed.
        4. Draft 'details' for events/tasks. Title must be <6 words.
        
        Output JSON ONLY.
      `;

      const architectResponse = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: "Analyze.",
        config: {
          systemInstruction: architectSystemInstruction,
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: 0 }, // Speed optimization
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              intent: { type: Type.STRING, enum: ["general", "create_event", "create_task", "update_prefs"] },
              newFact: { type: Type.STRING, nullable: true },
              kairosInsight: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, enum: ["warning", "encouragement", "tip"] },
                  message: { type: Type.STRING }
                },
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
                  priority: { type: Type.STRING, enum: ["urgent", "high", "normal", "low"] },
                  recurrence: { type: Type.STRING, enum: ["none", "daily", "weekly", "weekdays", "specific_days", "monthly"] },
                  daysOfWeek: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                  dayOfMonth: { type: Type.INTEGER }
                },
                nullable: true
              },
              architectNote: { type: Type.STRING, description: "Brief note to the Editor about what was decided." }
            },
            required: ["intent", "architectNote"]
          }
        }
      });

      const architectPlan = JSON.parse(architectResponse.text || "{}");

      // --- STEP 2: EDITOR (Personality & Phrasing) ---
      setAgentStatus(t.chat.refining); // "Refining details..."

      const editorSystemInstruction = `
        You are Kairos, a kind, efficient, and responsible assistant.
        Refine the Architect's plan into a warm, concise response to ${currentKnowledge.user_name || prefs.userName}.
        
        User Knowledge: ${JSON.stringify(currentKnowledge)}
        Architect's Plan: ${JSON.stringify(architectPlan)}
        User Request: "${userText}"
        
        Language: ${language === 'ru' ? 'Russian' : 'English'}.
        Tone: ${currentKnowledge.preferences?.tone || "Professional yet warm"}. Be concise.
        
        Output PLAIN TEXT response only.
      `;

      const editorResponse = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: "Generate response.",
        config: {
          systemInstruction: editorSystemInstruction,
          responseMimeType: "text/plain",
          thinkingConfig: { thinkingBudget: 0 } // Speed optimization
        }
      });

      const finalReply = editorResponse.text;

      // Process results
      if (architectPlan.newFact) {
        onAddMemory({ text: architectPlan.newFact, timestamp: Date.now() });
      }

      let draftEventData = undefined;
      let draftTaskData = undefined;

      if (architectPlan.intent === 'create_event' && architectPlan.details) {
        draftEventData = {
          ...architectPlan.details,
          date: architectPlan.details.date || todayStr,
          startTime: architectPlan.details.startTime || '09:00',
          endTime: architectPlan.details.endTime || '10:00',
          title: architectPlan.details.title || 'New Event'
        };
      } else if (architectPlan.intent === 'create_task' && architectPlan.details) {
        draftTaskData = {
          ...architectPlan.details,
          date: architectPlan.details.date || todayStr,
          title: architectPlan.details.title || 'New Task',
          priority: architectPlan.details.priority || 'normal',
          category: architectPlan.details.category || 'Personal'
        };
      }

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
      console.error("Gemini Error:", e);
      onUpdateMessages(activeChat.id, [...currentHistory, { 
        id: Date.now().toString(), 
        role: 'assistant', 
        content: t.chat.error 
      }]);
    } finally { 
      setIsAiThinking(false);
      setAgentStatus('');
    }
  };

  const handleAcceptDraft = (msg: ChatMessage) => {
    if (msg.draftTask) {
      onAddTask(
        msg.draftTask.title || 'Untitled Task', 
        msg.draftTask.category || 'Personal', 
        msg.draftTask.date || todayStr, 
        msg.draftTask.description,
        msg.draftTask.recurrence as any || 'none',
        msg.draftTask.priority as any || 'normal'
      );
    } else if (msg.draftEvent) {
      onAddEvent({
        title: msg.draftEvent.title || 'Untitled Event',
        date: msg.draftEvent.date || todayStr,
        startTime: msg.draftEvent.startTime || '09:00',
        endTime: msg.draftEvent.endTime || '10:00',
        description: msg.draftEvent.description,
        recurrence: msg.draftEvent.recurrence as any || 'none',
        daysOfWeek: msg.draftEvent.daysOfWeek,
        dayOfMonth: msg.draftEvent.dayOfMonth
      });
    }
    onSetSynced(activeChat.id, msg.id);
  };

  const hasSpeechSupport = typeof window !== 'undefined' && (!!window.SpeechRecognition || !!window.webkitSpeechRecognition);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full gap-8 max-w-4xl mx-auto">
      {showSettings && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-charcoal/40 backdrop-blur-md" onClick={() => setShowSettings(false)}></div>
          <div className="relative w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl space-y-6">
             <h2 className="text-xl font-display font-black text-charcoal">{t.settings.title}</h2>
             <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-charcoal/30 mb-1 block">{t.settings.userName}</label>
                  <input maxLength={50} className="w-full bg-beige-soft border-none rounded-xl py-3 px-4 font-bold" value={prefs.userName} onChange={(e) => onUpdatePrefs({...prefs, userName: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-charcoal/30 mb-1 block">{t.settings.assistantName}</label>
                  <input maxLength={30} className="w-full bg-beige-soft border-none rounded-xl py-3 px-4 font-bold" value={prefs.assistantName} onChange={(e) => onUpdatePrefs({...prefs, assistantName: e.target.value})} />
                </div>
             </div>
             <button onClick={() => setShowSettings(false)} className="w-full py-4 bg-charcoal text-cream rounded-2xl font-black uppercase text-[10px] tracking-widest">{t.settings.save}</button>
             
             <a href="/privacy" target="_blank" rel="noopener noreferrer" className="block text-center text-[10px] font-bold text-charcoal/30 hover:text-charcoal mt-4 uppercase tracking-widest transition-colors">
               {language === 'ru' ? 'Политика конфиденциальности' : 'Privacy Policy'}
             </a>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between px-6">
         <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-charcoal/20">{t.chat.capacity(todayEventsCount, todayTasksCount)}</h2>
         <div className="flex gap-2">
            <button 
              onClick={handleClearChat}
              disabled={messages.length <= 1}
              className="size-10 bg-white border border-charcoal/5 rounded-xl flex items-center justify-center text-charcoal/40 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-30 disabled:hover:text-charcoal/40 disabled:hover:bg-white"
              title={t.chat.clearChat}
            >
              <span className="material-symbols-outlined text-xl">sweep</span>
            </button>
            <button onClick={() => setShowSettings(true)} className="size-10 bg-white border border-charcoal/5 rounded-xl flex items-center justify-center text-charcoal/40 hover:text-charcoal transition-all">
              <span className="material-symbols-outlined text-xl">settings</span>
            </button>
         </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 bg-white/40 border border-charcoal/5 rounded-[2.5rem] shadow-sm overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-8 space-y-6 scrollbar-hide">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] p-5 rounded-3xl text-[14px] leading-relaxed ${msg.role === 'user' ? 'bg-charcoal text-white rounded-tr-none' : 'bg-white border border-charcoal/10 text-charcoal rounded-tl-none shadow-sm'}`}>
                <div className="whitespace-pre-wrap">{msg.content}</div>
                
                {msg.kairosInsight && (
                  <div className="mt-4 p-4 rounded-2xl bg-primary/5 border border-primary/20 flex gap-3">
                    <span className="material-symbols-outlined text-[18px] text-primary">tips_and_updates</span>
                    <p className="text-[11px] font-bold text-charcoal/80">{msg.kairosInsight.message}</p>
                  </div>
                )}

                {(msg.draftTask || msg.draftEvent) && (
                  <div className="mt-4 p-4 bg-beige-soft border border-charcoal/5 text-charcoal rounded-2xl space-y-3">
                    <div className="flex justify-between items-center">
                      <p className="text-[9px] font-black uppercase opacity-40">{msg.draftTask ? t.calendar.task : t.calendar.event}</p>
                      <div className="flex gap-1">
                        {((msg.draftEvent?.recurrence && msg.draftEvent.recurrence !== 'none') || (msg.draftTask?.recurrence && msg.draftTask.recurrence !== 'none')) && (
                          <span className="text-[8px] font-black bg-primary/20 text-primary px-1.5 py-0.5 rounded-full uppercase">
                            {t.recurrence[(msg.draftEvent?.recurrence || msg.draftTask?.recurrence || 'none') as Exclude<keyof typeof t.recurrence, 'weeklyLabel'>]}
                          </span>
                        )}
                        {msg.draftTask?.priority && (
                           <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase ${
                             msg.draftTask.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                             msg.draftTask.priority === 'high' ? 'bg-blue-100 text-blue-700' :
                             msg.draftTask.priority === 'low' ? 'bg-charcoal/5 text-charcoal/50' :
                             'bg-emerald-100 text-emerald-700'
                           }`}>
                             {msg.draftTask.priority}
                           </span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-extrabold text-charcoal">{(msg.draftTask || msg.draftEvent)?.title}</h4>
                      {msg.draftEvent && (
                        <p className="text-[10px] text-charcoal/50 font-medium">
                          {msg.draftEvent.date} • {msg.draftEvent.startTime}
                          {msg.draftEvent.daysOfWeek && msg.draftEvent.daysOfWeek.length > 0 && 
                            ` • ${msg.draftEvent.daysOfWeek.map(d => t.common.shortWeekDays[d === 0 ? 6 : d - 1]).join(', ')}`
                          }
                        </p>
                      )}
                      {msg.draftTask && (
                        <p className="text-[10px] text-charcoal/50 font-medium">
                          {msg.draftTask.category} • {msg.draftTask.date}
                        </p>
                      )}
                    </div>
                    <button 
                      onClick={() => handleAcceptDraft(msg)} 
                      disabled={msg.isSynced} 
                      className="w-full py-2.5 bg-charcoal text-cream text-[9px] font-black uppercase rounded-xl disabled:opacity-30 disabled:bg-emerald-muted transition-all"
                    >
                      {msg.isSynced ? t.chat.added : t.chat.accept}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isAiThinking && (
            <div className="flex items-center gap-3 animate-pulse-gentle">
              <div className="size-2 bg-primary rounded-full"></div>
              <div className="text-[10px] uppercase font-black text-charcoal/30">
                {agentStatus || t.chat.thinking}
              </div>
            </div>
          )}
        </div>
        <div className="px-6 py-6 border-t border-charcoal/5 bg-white/60">
          <div className="flex items-end gap-3">
            <div className="relative flex-1">
              {/* Active Voice Indicator Background */}
              {isListening && (
                <div className="absolute inset-0 rounded-2xl bg-red-500/10 animate-pulse pointer-events-none"></div>
              )}
              
              <textarea 
                ref={textareaRef}
                maxLength={2000}
                className={`
                  w-full bg-white border border-charcoal/10 focus:ring-primary focus:border-primary rounded-2xl py-4 pl-6 pr-14 text-sm font-medium transition-all resize-none overflow-y-auto min-h-[56px] max-h-[200px] scrollbar-hide
                  ${isListening ? 'ring-2 ring-red-500/20 border-red-500/30' : ''}
                `}
                placeholder={isListening ? t.chat.listening : t.chat.placeholder} 
                value={input} 
                readOnly={isAiThinking || isListening} // Prevent typing conflict while speaking
                rows={1}
                onChange={(e) => setInput(e.target.value)} 
                onKeyDown={handleKeyDown}
              />
              
              {hasSpeechSupport && (
                <div className="absolute right-2 bottom-2 flex items-center justify-center">
                  <button
                    onClick={toggleListening}
                    className={`
                      h-10 w-10 flex items-center justify-center rounded-xl transition-all duration-300
                      ${isListening 
                        ? 'bg-red-500 text-white shadow-lg scale-105' 
                        : 'text-charcoal/20 hover:text-charcoal hover:bg-charcoal/5'
                      }
                    `}
                    title={isListening ? "Stop Recording" : "Start Voice Input"}
                  >
                    {isListening ? (
                       <div className="flex items-center justify-center gap-[2px]">
                         <span className="w-1 h-3 bg-white rounded-full animate-[pulse_0.5s_ease-in-out_infinite]"></span>
                         <span className="w-1 h-5 bg-white rounded-full animate-[pulse_0.5s_ease-in-out_0.1s_infinite]"></span>
                         <span className="w-1 h-3 bg-white rounded-full animate-[pulse_0.5s_ease-in-out_0.2s_infinite]"></span>
                       </div>
                    ) : (
                      <span className="material-symbols-outlined text-[20px]">mic</span>
                    )}
                  </button>
                  
                  {isListening && (
                    <div className="absolute -top-6 right-0 bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full animate-in fade-in slide-in-from-bottom-2">
                       {formatTime(recordingTime)}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button 
              onClick={handleSend} 
              disabled={isAiThinking || !input.trim()} 
              className="h-[56px] w-[56px] bg-charcoal text-cream rounded-2xl flex items-center justify-center shadow-lg hover:bg-primary hover:text-charcoal transition-all group disabled:opacity-20 shrink-0"
            >
              <span className="material-symbols-outlined">send</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatView;
