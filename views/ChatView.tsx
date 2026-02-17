
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { ChatMessage, Event, Task, ChatSession, Personality, Language, MemoryItem } from '../types';
import ItemDetailModal from '../components/ItemDetailModal';
import { getT } from '../translations';

// Utility for Vector Similarity
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let mA = 0;
  let mB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    mA += vecA[i] * vecA[i];
    mB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(mA) * Math.sqrt(mB));
}

interface ChatViewProps {
  activeChat: ChatSession;
  chats: ChatSession[];
  personality: Personality;
  tasks: Task[];
  events: Event[];
  memory: MemoryItem[];
  language: Language;
  onSetActiveChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
  onUpdateMessages: (chatId: string, messages: ChatMessage[], newTitle?: string) => void;
  onAddEvent: (event: Partial<Event>) => void;
  onAddTask: (title: string, category: string, date: string, description?: string, recurrence?: Task['recurrence'], estimatedMinutes?: number) => void;
  onRescheduleTask: (taskId: string, newDate: string, isExternal: boolean) => void;
  onBulkReschedule: (taskIds: string[], eventIds: string[], newDate: string, isExternal: boolean) => void;
  onAddMemory: (item: MemoryItem) => void;
}

const ChatView: React.FC<ChatViewProps> = ({ 
  activeChat, chats, personality, tasks, events, memory, language, onSetActiveChat, onNewChat, onDeleteChat,
  onUpdateMessages, onAddEvent, onAddTask, onRescheduleTask, onBulkReschedule, onAddMemory
}) => {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<Event | Task | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const t = useMemo(() => getT(language), [language]);
  const messages = activeChat?.messages || [];
  const TODAY = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isTyping]);

  const detectIntentAndRoute = (text: string): { model: string, search: boolean } => {
    const lowercase = text.toLowerCase();
    const searchKeywords = ['news', 'weather', 'latest', 'today', 'price', 'who is', 'current', 'новости', 'погода', 'цена', 'кто такой'];
    const proKeywords = ['advice', 'think', 'explain', 'philosophy', 'complex', 'how to', 'совет', 'подумай', 'объясни', 'почему'];
    
    if (searchKeywords.some(k => lowercase.includes(k))) return { model: 'gemini-3-flash-preview', search: true };
    if (proKeywords.some(k => lowercase.includes(k))) return { model: 'gemini-3-pro-preview', search: false };
    return { model: 'gemini-2.5-flash-lite-latest', search: false };
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const userText = input;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: userText };
    const updatedMessages = [...messages, userMsg];
    onUpdateMessages(activeChat.id, updatedMessages);
    
    setInput('');
    setIsTyping(true);

    const { model, search } = detectIntentAndRoute(userText);
    setActiveModel(model);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      // 1. Semantic Retrieval Step (Long-term Vector Memory)
      let retrievedMemories: string[] = [];
      if (memory.length > 0) {
        try {
          const queryEmbeddingResult = await ai.models.embedContent({
            model: 'text-embedding-004',
            content: { parts: [{ text: userText }] }
          });
          const queryVector = queryEmbeddingResult.embedding.values;

          const scoredMemories = memory.map(item => ({
            text: item.text,
            score: cosineSimilarity(queryVector, item.embedding)
          })).sort((a, b) => b.score - a.score);

          retrievedMemories = scoredMemories
            .filter(m => m.score > 0.45) 
            .slice(0, 5)
            .map(m => m.text);
        } catch (embedError) {
          retrievedMemories = memory.slice(0, 5).map(m => m.text);
        }
      }

      const stats = `Burnout=${personality.burnoutRisk}%, Efficiency=${personality.efficiency}%`;
      const relevantFacts = retrievedMemories.length > 0 
        ? `Recalled context: ${retrievedMemories.join('; ')}` 
        : "No specific prior history found.";
      
      const scheduleContext = `Today: ${TODAY}. 
      Completed Today: ${tasks.filter(t => t.completed && t.date === TODAY).map(t => t.title).join(', ')}.
      Pending Today: ${tasks.filter(t => !t.completed && t.date === TODAY).map(t => t.title).join(', ')}.
      Upcoming Events: ${events.filter(e => e.date >= TODAY).slice(0, 5).map(e => `${e.title} (${e.date})`).join(', ')}.`;

      const systemInstruction = `You are Kairos, a minimalist and sophisticated assistant.
      Current Stats: ${stats}
      Long-term Memory: ${relevantFacts}
      Real-time Schedule: ${scheduleContext}
      Language: ${language}.
      
      Output MUST be valid JSON.
      RULES:
      - pro-actively store important life updates, preferences, or project milestones in 'newFact'.
      - help users optimize their energy based on burnout risk.
      - if search is used, cite sources naturally.`;

      const response = await ai.models.generateContent({
        model: model as any,
        contents: `${userText}`,
        config: {
          systemInstruction,
          tools: search ? [{ googleSearch: {} }] : undefined,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: { type: Type.STRING },
              intent: { type: Type.STRING, enum: ["general", "create_event", "create_task"] },
              newFact: { type: Type.STRING, description: "Extract key user info or patterns for long-term memory" },
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
                  date: { type: Type.STRING }
                }
              }
            }
          }
        }
      });

      const result = JSON.parse(response.text || "{}");
      
      if (result.newFact) {
        try {
          const embeddingResult = await ai.models.embedContent({
            model: 'text-embedding-004',
            content: { parts: [{ text: result.newFact }] }
          });
          onAddMemory({
            text: result.newFact,
            embedding: embeddingResult.embedding.values,
            timestamp: Date.now()
          });
        } catch (e) {}
      }

      // Grounding citations
      let content = result.reply;
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks && chunks.length > 0) {
        const sources = chunks.map((c: any) => c.web).filter(Boolean);
        if (sources.length > 0) {
          content += `\n\n**Sources:**\n` + sources.slice(0, 3).map((s: any) => `• [${s.title}](${s.uri})`).join('\n');
        }
      }

      const aiMsg: ChatMessage = { 
        id: Date.now().toString(), 
        role: 'assistant', 
        content: content,
        kairosInsight: result.kairosInsight,
        draftEvent: result.intent === 'create_event' ? { ...result.details, type: 'work' } : undefined
      };

      onUpdateMessages(activeChat.id, [...updatedMessages, aiMsg]);
    } catch (e) { 
      onUpdateMessages(activeChat.id, [...updatedMessages, { id: Date.now().toString(), role: 'assistant', content: "I encountered an error connecting to my cognitive cores." }]);
    } finally { 
      setIsTyping(false); 
      setActiveModel(null);
    }
  };

  const renderMarkdown = (text: string) => {
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    return text.split('\n').map((line, i) => {
      const parts = line.split(linkRegex);
      if (parts.length === 1) return <p key={i} className="mb-1">{line}</p>;
      const elements = [];
      for (let j = 0; j < parts.length; j += 3) {
        elements.push(parts[j]);
        if (parts[j+1]) {
          elements.push(<a key={`${i}-${j}`} href={parts[j+2]} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-bold">{parts[j+1]}</a>);
        }
      }
      return <p key={i} className="mb-1">{elements}</p>;
    });
  };

  return (
    <div className="flex flex-col h-full gap-8 max-w-4xl mx-auto">
      <ItemDetailModal item={selectedPreview} onClose={() => setSelectedPreview(null)} language={language} />
      <div className="flex-1 flex flex-col min-h-0 bg-white/40 border border-charcoal/5 rounded-[2.5rem] shadow-sm overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-8 space-y-6 scrollbar-hide">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] p-5 rounded-3xl text-[14px] leading-relaxed ${msg.role === 'user' ? 'bg-charcoal text-white rounded-tr-none' : 'bg-white border border-charcoal/10 text-charcoal rounded-tl-none shadow-sm'}`}>
                <div className="whitespace-pre-wrap">
                  {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
                </div>
                {msg.kairosInsight && (
                  <div className={`mt-4 p-4 rounded-2xl flex items-start gap-3 border animate-in slide-in-from-left-4 ${msg.kairosInsight.type === 'warning' ? 'bg-red-50 border-red-100' : 'bg-primary/5 border-primary/20'}`}>
                    <span className={`material-symbols-outlined text-[18px] ${msg.kairosInsight.type === 'warning' ? 'text-red-400' : 'text-primary'}`}>{msg.kairosInsight.type === 'warning' ? 'warning' : 'tips_and_updates'}</span>
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
                    <p className="text-[10px] text-white/50">{msg.draftEvent.date}</p>
                    <button onClick={() => onAddEvent(msg.draftEvent!)} className="w-full py-2 bg-primary text-charcoal text-[10px] font-black uppercase rounded-lg shadow-lg active:scale-95 transition-all">{t.chat.syncNow}</button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex items-center gap-3 animate-pulse">
              <div className="size-2 bg-primary rounded-full"></div>
              <div className="text-[10px] uppercase font-black text-charcoal/30 tracking-widest">
                {t.chat.analyzing} {activeModel?.includes('flash-preview') ? '(Searching Grounding + Vector Retrieval)' : '(Semantic Retrieval Active)'}
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
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <button onClick={handleSend} className="size-12 bg-charcoal text-cream rounded-2xl flex items-center justify-center shadow-lg active:scale-95 transition-all hover:bg-primary hover:text-charcoal group">
              <span className="material-symbols-outlined group-hover:scale-110 transition-transform">send</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatView;
