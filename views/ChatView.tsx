
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { ChatMessage, Event, Task, ChatSession, Personality, Language, MemoryItem, UserPreferences } from '../types';
import ItemDetailModal from '../components/ItemDetailModal';
import { getT } from '../translations';

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB) return 0;
  let dotProduct = 0, mA = 0, mB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    mA += vecA[i] * vecA[i];
    mB += vecB[i] * vecB[i];
  }
  const mag = Math.sqrt(mA) * Math.sqrt(mB);
  return mag === 0 ? 0 : dotProduct / mag;
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
  onKeyReset: () => void;
  onUpdatePrefs: (prefs: UserPreferences) => void;
}

const ChatView: React.FC<ChatViewProps> = ({ 
  activeChat, personality, tasks, events, memory, language, prefs, onUpdateMessages, onAddEvent, onAddTask, onAddMemory, onSetSynced, onKeyReset, onUpdatePrefs
}) => {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const t = useMemo(() => getT(language), [language]);
  const messages = activeChat?.messages || [];
  const TODAY = new Date().toISOString().split('T')[0];

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userText = input;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: userText };
    onUpdateMessages(activeChat.id, [...messages, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      let retrievedMemories: string[] = [];
      if (memory.length > 0) {
        try {
          const queryEmbeddingResult = await ai.models.embedContent({ model: 'gemini-embedding-001', contents: { parts: [{ text: userText }] } });
          if (queryEmbeddingResult.embedding?.values) {
            const queryVector = queryEmbeddingResult.embedding.values;
            const scoredMemories = memory.map(item => ({ text: item.text, score: cosineSimilarity(queryVector, item.embedding) })).sort((a, b) => b.score - a.score);
            retrievedMemories = scoredMemories.filter(m => m.score > 0.4).slice(0, 10).map(m => m.text);
          }
        } catch (e: any) { console.warn("Memory retrieval failed", e); }
      }

      const systemInstruction = `You are ${prefs.assistantName}, the personal scheduling secretary for ${prefs.userName}.
      User Stats: Burnout=${personality.burnoutRisk}%, Efficiency=${personality.efficiency}%.
      Your Goal: Be kind, hyper-efficient, and protective of ${prefs.userName}'s time.
      Knowledge about ${prefs.userName}: ${retrievedMemories.join('; ')}
      Schedule Context: Today is ${TODAY}. You have ${events.length} events and ${tasks.length} tasks recorded.
      OUTPUT ONLY RAW VALID JSON.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ role: 'user', parts: [{ text: userText }] }],
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: { type: Type.STRING },
              intent: { type: Type.STRING, enum: ["general", "create_event", "create_task", "update_prefs"] },
              newFact: { type: Type.STRING, description: "A new fact learned about the user to store in long-term memory." },
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
                  date: { type: Type.STRING },
                  category: { type: Type.STRING },
                  description: { type: Type.STRING }
                }
              }
            },
            required: ["reply", "intent"]
          }
        }
      });

      const result = JSON.parse(response.text || "{}");
      
      if (result.newFact) {
        try {
          const emb = await ai.models.embedContent({ model: 'gemini-embedding-001', contents: { parts: [{ text: result.newFact }] } });
          if (emb.embedding?.values) onAddMemory({ text: result.newFact, embedding: emb.embedding.values, timestamp: Date.now() });
        } catch (e) { console.warn("Index fail", e); }
      }

      const aiMsg: ChatMessage = { 
        id: Date.now().toString(), 
        role: 'assistant', 
        content: result.reply,
        isSynced: false,
        kairosInsight: result.kairosInsight,
        draftEvent: result.intent === 'create_event' ? { ...result.details, type: 'work' } : undefined,
        draftTask: result.intent === 'create_task' ? { ...result.details } : undefined,
      };
      onUpdateMessages(activeChat.id, [...messages, userMsg, aiMsg]);
    } catch (e: any) { 
      console.error("Gemini Error:", e);
      if (e.message?.includes("Requested entity was not found")) onKeyReset();
      else onUpdateMessages(activeChat.id, [...messages, userMsg, { id: Date.now().toString(), role: 'assistant', content: "Something went wrong with our connection. Please check your AI key." }]);
    } finally { setIsTyping(false); }
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
                <div className="pt-4 flex items-center justify-between border-t border-charcoal/5">
                   <span className="text-[10px] font-black uppercase text-charcoal/30">{t.settings.memoryCount}</span>
                   <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-black">{memory.length}</span>
                </div>
             </div>
             <button onClick={() => setShowSettings(false)} className="w-full py-4 bg-charcoal text-cream rounded-2xl font-black uppercase text-[10px] tracking-widest">{t.settings.save}</button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between px-6">
         <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-charcoal/20">Secured with Personal Gemini Key</h2>
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
                {msg.draftTask && (
                  <div className="mt-4 p-4 bg-primary text-charcoal rounded-2xl space-y-2">
                    <p className="text-[9px] font-black uppercase opacity-40">{t.calendar.task}</p>
                    <h4 className="font-extrabold">{msg.draftTask.title}</h4>
                    <button onClick={() => { onAddTask(msg.draftTask!.title!, 'Personal', msg.draftTask!.date || TODAY); onSetSynced(activeChat.id, msg.id); }} disabled={msg.isSynced} className="w-full py-2 bg-charcoal text-cream text-[9px] font-black uppercase rounded-lg disabled:opacity-30">{msg.isSynced ? 'ADDED' : 'ACCEPT'}</button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isTyping && <div className="flex items-center gap-3 animate-pulse"><div className="size-2 bg-primary rounded-full"></div><div className="text-[10px] uppercase font-black text-charcoal/30">{t.chat.analyzing}</div></div>}
        </div>
        <div className="px-6 py-6 border-t border-charcoal/5 bg-white/60">
          <div className="flex items-center gap-2">
            <input className="flex-1 bg-white border border-charcoal/10 focus:ring-primary focus:border-primary rounded-2xl py-4 px-6 text-sm font-medium" placeholder={t.chat.placeholder} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()}/>
            <button onClick={handleSend} className="size-12 bg-charcoal text-cream rounded-2xl flex items-center justify-center shadow-lg hover:bg-primary hover:text-charcoal transition-all group"><span className="material-symbols-outlined">send</span></button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatView;
