
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { ChatMessage, Event, Task, ChatSession, Personality, Language } from '../types';
import ItemDetailModal from '../components/ItemDetailModal';
import { getT } from '../translations';

interface ChatViewProps {
  activeChat: ChatSession;
  chats: ChatSession[];
  personality: Personality;
  tasks: Task[];
  events: Event[];
  memory: string[];
  language: Language;
  onSetActiveChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
  onUpdateMessages: (chatId: string, messages: ChatMessage[], newTitle?: string) => void;
  onAddEvent: (event: Partial<Event>) => void;
  onAddTask: (title: string, category: string, date: string, description?: string, recurrence?: Task['recurrence'], estimatedMinutes?: number) => void;
  onRescheduleTask: (taskId: string, newDate: string, isExternal: boolean) => void;
  onBulkReschedule: (taskIds: string[], eventIds: string[], newDate: string, isExternal: boolean) => void;
  onAddMemory: (fact: string) => void;
}

const ChatView: React.FC<ChatViewProps> = ({ 
  activeChat, chats, personality, tasks, events, memory, language, onSetActiveChat, onNewChat, onDeleteChat,
  onUpdateMessages, onAddEvent, onAddTask, onRescheduleTask, onBulkReschedule, onAddMemory
}) => {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedPreview, setSelectedPreview] = useState<Event | Task | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const t = useMemo(() => getT(language), [language]);
  const messages = activeChat?.messages || [];
  const TODAY = "2026-02-17";

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: input };
    const updatedMessages = [...messages, userMsg];
    onUpdateMessages(activeChat.id, updatedMessages);
    const userText = input;
    setInput('');
    setIsTyping(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const stats = `Current Stats: BurnoutRisk=${personality.burnoutRisk}%, Efficiency=${personality.efficiency}%, Memory=[${memory.join(', ')}]`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `${stats}
        User: "${userText}"
        TODAY: ${TODAY}
        LANGUAGE: ${language === 'ru' ? 'Russian' : 'English'}
        
        DIRECTIVE: 
        1. Act as a high-end personal wellness secretary (Kairos). 
        2. YOUR OUTPUT LANGUAGE MUST BE ${language === 'ru' ? 'RUSSIAN' : 'ENGLISH'}.
        3. If User adds too much, give a 'kairosInsight' of type 'warning'.
        4. Estimate 'estimatedMinutes' for new tasks based on common sense.
        5. If a task is repeated/rescheduled, comment on the pattern.
        6. Return JSON only.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: { type: Type.STRING },
              intent: { type: Type.STRING },
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
                  estimatedMinutes: { type: Type.NUMBER },
                  recurrence: { type: Type.STRING },
                  date: { type: Type.STRING }
                }
              }
            }
          }
        }
      });

      const result = JSON.parse(response.text || "{}");
      const aiMsg: ChatMessage = { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant', 
        content: result.reply,
        kairosInsight: result.kairosInsight,
        draftEvent: result.intent === 'create_event' ? result.details : undefined
      };

      onUpdateMessages(activeChat.id, [...updatedMessages, aiMsg]);
    } catch (e) { console.error(e); } finally { setIsTyping(false); }
  };

  return (
    <div className="flex flex-col h-full gap-8 max-w-4xl mx-auto">
      <ItemDetailModal item={selectedPreview} onClose={() => setSelectedPreview(null)} language={language} />
      
      <div className="flex-1 flex flex-col min-h-0 bg-white/40 border border-charcoal/5 rounded-[2.5rem] shadow-sm overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-8 space-y-6 scrollbar-hide">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] p-5 rounded-3xl text-[14px] leading-relaxed ${msg.role === 'user' ? 'bg-charcoal text-cream rounded-tr-none' : 'bg-white border border-charcoal/10 text-charcoal rounded-tl-none shadow-sm'}`}>
                {msg.content}
                
                {msg.kairosInsight && (
                  <div className={`mt-4 p-4 rounded-2xl flex items-start gap-3 border animate-in slide-in-from-left-4 ${
                    msg.kairosInsight.type === 'warning' ? 'bg-red-50 border-red-100' : 'bg-primary/5 border-primary/20'
                  }`}>
                    <span className={`material-symbols-outlined text-[18px] ${msg.kairosInsight.type === 'warning' ? 'text-red-400' : 'text-primary'}`}>
                      {msg.kairosInsight.type === 'warning' ? 'warning' : 'tips_and_updates'}
                    </span>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-charcoal/30 mb-1">{t.chat.insight}</p>
                      <p className="text-[11px] font-bold text-charcoal/80 leading-snug">{msg.kairosInsight.message}</p>
                    </div>
                  </div>
                )}

                {msg.draftEvent && (
                  <div className="mt-4 p-4 bg-charcoal text-cream rounded-2xl space-y-3 border border-primary/20">
                    <p className="text-[10px] font-bold text-primary uppercase">{t.chat.recommendation}</p>
                    <h4 className="font-bold">{msg.draftEvent.title}</h4>
                    <button onClick={() => onAddEvent(msg.draftEvent!)} className="w-full py-2 bg-primary text-charcoal text-[10px] font-black uppercase rounded-lg">{t.chat.syncNow}</button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isTyping && <div className="text-[10px] uppercase font-black text-charcoal/20 animate-pulse">{t.chat.analyzing}</div>}
        </div>

        <div className="px-6 py-6 border-t border-charcoal/5 bg-white/60">
          <div className="flex items-center gap-2">
            <input 
              className="flex-1 bg-white border border-charcoal/10 focus:ring-primary focus:border-primary rounded-2xl py-4 px-6 text-sm font-medium" 
              placeholder={t.chat.placeholder} 
              value={input} 
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <button onClick={handleSend} className="size-12 bg-charcoal text-cream rounded-2xl flex items-center justify-center shadow-lg active:scale-95 transition-all">
              <span className="material-symbols-outlined">send</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatView;
