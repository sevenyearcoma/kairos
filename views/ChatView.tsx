
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { ChatMessage, Event, Task, ChatSession, Personality, Language, MemoryItem, UserPreferences } from '../types';
import { isItemOnDate } from '../utils/dateUtils';
import { getT } from '../translations';

/**
 * Robustly extracts and parses JSON from a potentially messy AI response string.
 */
function extractAndParseJson(text: string): any {
  if (!text) return { reply: "I'm sorry, I couldn't process that.", intent: "general" };
  
  let jsonStr = text.trim();
  
  // Try to find a JSON block in markdown backticks
  const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch) {
    jsonStr = jsonBlockMatch[1].trim();
  } else {
    // If no markdown block, try to find the first '{' and last '}'
    const startIndex = text.indexOf('{');
    const endIndex = text.lastIndexOf('}') + 1;
    if (startIndex >= 0 && endIndex > startIndex) {
      jsonStr = text.substring(startIndex, endIndex).trim();
    }
  }

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("Failed to parse JSON from AI response", e, text);
    // Return a safe fallback instead of crashing
    return { 
      reply: text.substring(0, 200) || "I encountered a formatting error, but I'm still here to help.", 
      intent: "general" 
    };
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
  onAddTask: (title: string, category: string, date: string, description?: string) => void;
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
  const [refining, setRefining] = useState(false);
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
  }, [messages, isAiThinking]);

  const handleSend = async () => {
    if (!input.trim() || isAiThinking) return;
    
    const userText = input;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: userText };
    
    // Protect against stale messages prop by building the new history locally
    const currentHistory = [...messages, userMsg];
    onUpdateMessages(activeChat.id, currentHistory);
    
    setInput('');
    setIsAiThinking(true);
    setRefining(false);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const retrievedMemories = memory.slice(0, 15).map(m => m.text);

      // --- Context Construction ---
      const now = new Date();
      const offset = now.getTimezoneOffset() * 60000;
      // Use 24h format for context
      const currentTimeStr = new Date(now.getTime() - offset).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const currentDayName = dayNames[now.getDay()];

      // Convert recent chat history to string for context
      const chatHistoryStr = currentHistory.slice(-10).map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

      // --- STAGE 1: PLANNER (Strategic Reasoning with History) ---
      const plannerPrompt = `
        You are "Kairos", an intelligent, proactive scheduling assistant.
        
        CONTEXT:
        - User: ${prefs.userName}
        - Current Date: ${todayStr} (${currentDayName})
        - Tomorrow's Date: ${tomorrowStr}
        - Current Time: ${currentTimeStr}
        - Memories: ${retrievedMemories.join('; ')}

        RECENT CONVERSATION HISTORY (Use this to resolve "it", "that", or missing titles):
        ${chatHistoryStr}

        CURRENT USER REQUEST: "${userText}"

        YOUR GOAL: Satisfy the user's request immediately.
        
        CRITICAL RULES FOR INTERACTION:
        1. **CONTEXT IS KING**: If the user says "7pm" or "same time", look at the HISTORY to find what event they are talking about (e.g., Gym, Meeting). 
        2. **GUESS & ANTICIPATE**: Do NOT ask clarifying questions for minor details.
           - If Time is missing -> Guess a reasonable time (e.g., 09:00 for work, 18:00 for gym) or use the current time.
           - If Title is missing -> Infer it from context (e.g., "Gym", "Call", "Task").
           - If Duration is missing -> Assume 1 hour.
           - If Date is missing -> Assume Today (if time is future) or Tomorrow.
           - **USE 24-HOUR FORMAT** (e.g. 13:00, 20:30) for all times.
        3. **ONLY ASK IF IMPOSSIBLE**: Only ask a question if the request is completely gibberish or you absolutely cannot infer the intent from History.
        
        OUTPUT STRATEGY:
        - State clearly what you are going to schedule based on your guesses.
        - Merge the history info with the current info.
      `;

      const planResponse = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: plannerPrompt,
      });

      const plannerResult = planResponse.text || "Proceed with best guess.";

      // --- STAGE 2: EXECUTOR (Strict Formatting) ---
      setRefining(true);
      
      const executorSystemInstruction = `
        You are the "Executor" for Kairos. Generate the final JSON.

        INPUTS:
        - Chat History (for context)
        - Planner Strategy (Logic)

        INTENT RULES:
        - 'create_event': Use this if there is ANY implication of a specific time or a calendar block (e.g. "Gym", "Meeting").
        - 'create_task': Use this for to-do items without strict times.
        - 'general': Only if it's pure chit-chat.

        FIELD FILLING RULES (BE AGGRESSIVE):
        - If the Planner inferred a title/time/date, USE IT.
        - **recurrence**: Detect "every tuesday", "weekly", "daily". 
        - **daysOfWeek**: If "every Tuesday and Thursday", output [2, 4]. (0=Sun, 1=Mon...).
        - **date**: Must be YYYY-MM-DD. Calculate the *next* occurrence of the day mentioned relative to ${todayStr}.
        - **TIMES**: MUST be 24-hour format (e.g. "14:00", "09:30"). Do NOT use AM/PM.
        
        OUTPUT SCHEMA (JSON Only):
        {
          "reply": "Confirmation message. Be brief. State what you scheduled (e.g. 'Added Gym for Tuesdays at 19:00').",
          "intent": "create_event" | "create_task" | "general" | "update_prefs",
          "details": { ...event/task fields... },
          "kairosInsight": { "type": "tip/encouragement", "message": "Short wise thought" } (Optional)
        }
        
        Language: ${language === 'ru' ? 'Russian' : 'English'}.
      `;

      const executorPrompt = `
        HISTORY:
        ${chatHistoryStr}

        PLANNER STRATEGY: "${plannerResult}"
        
        Generate final JSON.
      `;

      const finalResponse = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: executorPrompt,
        config: {
          systemInstruction: executorSystemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: { type: Type.STRING },
              intent: { type: Type.STRING, enum: ["general", "create_event", "create_task", "update_prefs"] },
              newFact: { type: Type.STRING, description: "Extract any new personal fact to remember about the user" },
              kairosInsight: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, enum: ["warning", "encouragement", "tip"] },
                  message: { type: Type.STRING }
                }
              },
              details: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  date: { type: Type.STRING, description: "YYYY-MM-DD" },
                  startTime: { type: Type.STRING, description: "HH:MM (24h)" },
                  endTime: { type: Type.STRING, description: "HH:MM (24h)" },
                  category: { type: Type.STRING },
                  description: { type: Type.STRING },
                  recurrence: { type: Type.STRING, enum: ["none", "daily", "weekly", "weekdays", "specific_days", "monthly"] },
                  daysOfWeek: { type: Type.ARRAY, items: { type: Type.INTEGER }, description: "0=Sun...6=Sat" },
                  dayOfMonth: { type: Type.INTEGER }
                }
              }
            },
            required: ["reply", "intent"]
          }
        }
      });

      const result = extractAndParseJson(finalResponse.text || "{}");
      
      if (result.newFact) {
        onAddMemory({ text: result.newFact, timestamp: Date.now() });
      }

      // Ensure drafts have fallback data if model missed something
      let draftEventData = undefined;
      let draftTaskData = undefined;

      if (result.intent === 'create_event' && result.details) {
        draftEventData = {
          ...result.details,
          date: result.details.date || todayStr,
          startTime: result.details.startTime || '09:00',
          endTime: result.details.endTime || '10:00',
          title: result.details.title || 'New Event'
        };
      } else if (result.intent === 'create_task' && result.details) {
        draftTaskData = {
          ...result.details,
          date: result.details.date || todayStr,
          title: result.details.title || 'New Task'
        };
      }

      const aiMsg: ChatMessage = { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant', 
        content: result.reply || (language === 'ru' ? "Простите, я не смог сформулировать ответ." : "I'm sorry, I couldn't formulate a response."),
        isSynced: false,
        kairosInsight: result.kairosInsight,
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
      setRefining(false);
    }
  };

  const handleAcceptDraft = (msg: ChatMessage) => {
    if (msg.draftTask) {
      onAddTask(
        msg.draftTask.title || 'Untitled Task', 
        msg.draftTask.category || 'Personal', 
        msg.draftTask.date || todayStr, 
        msg.draftTask.description
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
                      {((msg.draftEvent?.recurrence && msg.draftEvent.recurrence !== 'none') || (msg.draftTask?.recurrence && msg.draftTask.recurrence !== 'none')) && (
                        <span className="text-[8px] font-black bg-primary/20 text-primary px-1.5 py-0.5 rounded-full uppercase">
                          {(msg.draftEvent?.recurrence || msg.draftTask?.recurrence || '').replace('_', ' ')}
                        </span>
                      )}
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
                {refining ? t.chat.refining : t.chat.thinking}
              </div>
            </div>
          )}
        </div>
        <div className="px-6 py-6 border-t border-charcoal/5 bg-white/60">
          <div className="flex items-center gap-2">
            <input 
              className="flex-1 bg-white border border-charcoal/10 focus:ring-primary focus:border-primary rounded-2xl py-4 px-6 text-sm font-medium" 
              placeholder={t.chat.placeholder} 
              value={input} 
              disabled={isAiThinking}
              onChange={(e) => setInput(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <button onClick={handleSend} disabled={isAiThinking || !input.trim()} className="size-12 bg-charcoal text-cream rounded-2xl flex items-center justify-center shadow-lg hover:bg-primary hover:text-charcoal transition-all group disabled:opacity-20">
              <span className="material-symbols-outlined">send</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatView;
