
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { ChatMessage, Event, Task, ChatSession, Personality, Language, MemoryItem, UserPreferences, TaskPriority } from '../types';
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
  onSetSynced: (chatId: string, messageId: string) => void;
  onUpdatePrefs: (prefs: UserPreferences) => void;
}

const ChatView: React.FC<ChatViewProps> = ({ 
  activeChat, personality, tasks, events, memory, language, prefs, isAiThinking, setIsAiThinking, onUpdateMessages, onAddEvent, onAddTask, onAddMemory, onSetSynced, onUpdatePrefs
}) => {
  const [input, setInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [agentStatus, setAgentStatus] = useState<string>(''); // For UI feedback on double-agent steps
  
  // Voice Input State
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
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

  // Clean up speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = language === 'ru' ? 'ru-RU' : 'en-US';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    
    recognition.onend = () => setIsListening(false);
    
    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      const currentResultIndex = event.results.length - 1;
      const transcript = event.results[currentResultIndex][0].transcript;
      
      if (event.results[currentResultIndex].isFinal) {
        setInput(prev => {
          const separator = prev.length > 0 && !prev.endsWith(' ') ? ' ' : '';
          return prev + separator + transcript;
        });
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleSend = async () => {
    if (!input.trim() || isAiThinking) return;
    
    const userText = input;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: userText };
    
    // Protect against stale messages prop by building the new history locally
    const currentHistory = [...messages, userMsg];
    onUpdateMessages(activeChat.id, currentHistory);
    
    setInput('');
    setIsAiThinking(true);
    setAgentStatus(t.chat.thinking); // "Kairos is planning..."

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const retrievedMemories = memory.slice(0, 15).map(m => m.text);

      // --- Context Construction ---
      const now = new Date();
      const offset = now.getTimezoneOffset() * 60000;
      const currentTimeStr = new Date(now.getTime() - offset).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const currentDayName = dayNames[now.getDay()];

      const chatHistoryStr = currentHistory.slice(-6).map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

      // --- STEP 1: ARCHITECT (Structural Logic) ---
      // Focused solely on data extraction and scheduling logic.
      const architectSystemInstruction = `
        You are the 'Architect' module of Kairos.
        User: ${prefs.userName}. Date: ${todayStr} (${currentDayName}). Time: ${currentTimeStr}.
        Memories: ${retrievedMemories.join('; ')}

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
      // Focused on kindness, tone, and final user response.
      setAgentStatus(t.chat.refining); // "Refining details..."

      const editorSystemInstruction = `
        You are Kairos, a kind, efficient, and responsible assistant.
        Refine the Architect's plan into a warm, concise response to ${prefs.userName}.
        
        Architect's Plan: ${JSON.stringify(architectPlan)}
        User Request: "${userText}"
        
        Language: ${language === 'ru' ? 'Russian' : 'English'}.
        Tone: Professional yet warm. Be concise.
        
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
                  <input className="w-full bg-beige-soft border-none rounded-xl py-3 px-4 font-bold" value={prefs.userName} onChange={(e) => onUpdatePrefs({...prefs, userName: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-charcoal/30 mb-1 block">{t.settings.assistantName}</label>
                  <input className="w-full bg-beige-soft border-none rounded-xl py-3 px-4 font-bold" value={prefs.assistantName} onChange={(e) => onUpdatePrefs({...prefs, assistantName: e.target.value})} />
                </div>
             </div>
             <button onClick={() => setShowSettings(false)} className="w-full py-4 bg-charcoal text-cream rounded-2xl font-black uppercase text-[10px] tracking-widest">{t.settings.save}</button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between px-6">
         <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-charcoal/20">Capacity: {todayEventsCount} Events, {todayTasksCount} Tasks Today</h2>
         <button onClick={() => setShowSettings(true)} className="size-10 bg-white border border-charcoal/5 rounded-xl flex items-center justify-center text-charcoal/40 hover:text-charcoal transition-all">
           <span className="material-symbols-outlined text-xl">settings</span>
         </button>
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
                            {(msg.draftEvent?.recurrence || msg.draftTask?.recurrence || '').replace('_', ' ')}
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
                            ` • ${msg.draftEvent.daysOfWeek.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}`
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
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <input 
                className={`w-full bg-white border border-charcoal/10 focus:ring-primary focus:border-primary rounded-2xl py-4 pl-6 pr-12 text-sm font-medium transition-all ${isListening ? 'ring-2 ring-primary/50' : ''}`}
                placeholder={isListening ? t.chat.listening : t.chat.placeholder} 
                value={input} 
                disabled={isAiThinking}
                onChange={(e) => setInput(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              />
              {hasSpeechSupport && (
                <button
                  onClick={toggleListening}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 size-8 flex items-center justify-center rounded-xl transition-all ${
                    isListening 
                      ? 'bg-red-50 text-red-500 animate-pulse' 
                      : 'text-charcoal/20 hover:text-charcoal hover:bg-charcoal/5'
                  }`}
                  title="Voice Input"
                >
                  <span className="material-symbols-outlined text-[20px]">{isListening ? 'mic' : 'mic_none'}</span>
                </button>
              )}
            </div>

            <button onClick={handleSend} disabled={isAiThinking || !input.trim()} className="size-12 bg-charcoal text-cream rounded-2xl flex items-center justify-center shadow-lg hover:bg-primary hover:text-charcoal transition-all group disabled:opacity-20 shrink-0">
              <span className="material-symbols-outlined">send</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatView;
