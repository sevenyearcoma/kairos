
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { ChatMessage, Event, Task, ChatSession, Personality, Language, MemoryItem } from '../types';
import ItemDetailModal from '../components/ItemDetailModal';
import { getT } from '../translations';

// Utility for Vector Similarity
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB) return 0;
  let dotProduct = 0;
  let mA = 0;
  let mB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    mA += vecA[i] * vecA[i];
    mB += vecB[i] * vecB[i];
  }
  const magnitude = Math.sqrt(mA) * Math.sqrt(mB);
  if (magnitude === 0) return 0;
  return dotProduct / magnitude;
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
  onAddTask: (title: string, category: string, date: string, description?: string, recurrence?: Task['recurrence'], estimatedMinutes?: number, daysOfWeek?: number[]) => void;
  onRescheduleTask: (taskId: string, newDate: string, isExternal: boolean) => void;
  onBulkReschedule: (taskIds: string[], eventIds: string[], newDate: string, isExternal: boolean) => void;
  onAddMemory: (item: MemoryItem) => void;
  onSetSynced: (chatId: string, messageId: string) => void;
}

const ChatView: React.FC<ChatViewProps> = ({ 
  activeChat, chats, personality, tasks, events, memory, language, onSetActiveChat, onNewChat, onDeleteChat,
  onUpdateMessages, onAddEvent, onAddTask, onRescheduleTask, onBulkReschedule, onAddMemory, onSetSynced
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
    return { model: 'gemini-3-flash-preview', search: false };
  };

  const handleSyncDraft = (msgId: string, type: 'event' | 'task', data: any) => {
    const msg = messages.find(m => m.id === msgId);
    if (msg?.isSynced) return;

    if (type === 'event') {
      onAddEvent(data);
    } else {
      onAddTask(
        data.title, 
        data.category || 'Personal', 
        data.date || TODAY, 
        undefined, 
        data.recurrence, 
        data.estimatedMinutes,
        data.daysOfWeek
      );
    }

    onSetSynced(activeChat.id, msgId);
  };

  const generateImage = async (prompt: string): Promise<string | null> => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: `Create a serene, high-quality, aesthetic 16:9 illustration of: ${prompt}. Professional soft lighting, minimal colors, Kairos assistant style.` }] }
      });
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    } catch (e) {
      console.error("Image generation failed", e);
    }
    return null;
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

      let retrievedMemories: string[] = [];
      if (memory.length > 0) {
        try {
          // Fix: Use 'gemini-embedding-001', property 'content', and response 'embedding'
          const queryEmbeddingResult = await ai.models.embedContent({
            model: 'gemini-embedding-001',
            content: { parts: [{ text: userText }] }
          });
          if (queryEmbeddingResult.embedding?.values) {
            const queryVector = queryEmbeddingResult.embedding.values;
            const scoredMemories = memory.map(item => ({
              text: item.text,
              score: cosineSimilarity(queryVector, item.embedding)
            })).sort((a, b) => b.score - a.score);
            retrievedMemories = scoredMemories.filter(m => m.score > 0.45).slice(0, 5).map(m => m.text);
          }
        } catch (embedError) {
          console.warn("Memory retrieval failed", embedError);
        }
      }

      const stats = `Burnout=${personality.burnoutRisk}%, Efficiency=${personality.efficiency}%`;
      const relevantFacts = retrievedMemories.length > 0 ? `Recalled: ${retrievedMemories.join('; ')}` : "No prior history.";
      const scheduleContext = `Today: ${TODAY}. 
      Tasks Today: ${tasks.filter(t => t.date === TODAY).map(t => t.title).join(', ')}.
      Active Routines: ${tasks.filter(t => t.recurrence !== 'none').map(t => `${t.title} (${t.recurrence})`).join(', ')}.`;

      const systemInstruction = `You are Kairos, a sophisticated scheduling assistant.
      Current Context: ${stats} | ${relevantFacts}
      Schedule Status: ${scheduleContext}
      Language: ${language}.
      
      STRICT RULES:
      1. OUTPUT MUST BE JSON.
      2. The 'reply' field is your response to the user.
      3. For RECURRING tasks, use intent="create_task".
      4. If user wants to see something or you want to visualize a goal/mood, use intent="generate_image" and provide 'imagePrompt'.
      5. Extract facts into 'newFact'.`;

      const response = await ai.models.generateContent({
        model: model as any,
        contents: [{ role: 'user', parts: [{ text: userText }] }],
        config: {
          systemInstruction,
          tools: search ? [{ googleSearch: {} }] : undefined,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: { type: Type.STRING },
              intent: { type: Type.STRING, enum: ["general", "create_event", "create_task", "generate_image"] },
              imagePrompt: { type: Type.STRING },
              newFact: { type: Type.STRING },
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
                  recurrence: { type: Type.STRING, enum: ["none", "daily", "weekly", "monthly", "weekdays", "specific_days"] },
                  daysOfWeek: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                  estimatedMinutes: { type: Type.NUMBER }
                }
              }
            },
            required: ["reply", "intent"]
          }
        }
      });

      const result = JSON.parse(response.text || "{}");
      
      let generatedImgUrl: string | undefined;
      if (result.intent === 'generate_image' && result.imagePrompt) {
        generatedImgUrl = await generateImage(result.imagePrompt) || undefined;
      }

      let finalContent = result.reply;
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks && chunks.length > 0) {
        const sources = chunks
          .filter(c => c.web)
          .map(c => `[${c.web.title}](${c.web.uri})`)
          .join('\n');
        if (sources) {
          finalContent += `\n\n**Sources:**\n${sources}`;
        }
      }

      if (result.newFact) {
        try {
          // Fix: Use 'gemini-embedding-001', property 'content', and response 'embedding'
          const embeddingResult = await ai.models.embedContent({
            model: 'gemini-embedding-001',
            content: { parts: [{ text: result.newFact }] }
          });
          if (embeddingResult.embedding?.values) {
            onAddMemory({
              text: result.newFact,
              embedding: embeddingResult.embedding.values,
              timestamp: Date.now()
            });
          }
        } catch (e) {
          console.warn("Indexing fact failed", e);
        }
      }

      const aiMsg: ChatMessage = { 
        id: Date.now().toString(), 
        role: 'assistant', 
        content: generatedImgUrl ? finalContent + `\n\n![Generated Image](${generatedImgUrl})` : finalContent,
        isSynced: false,
        kairosInsight: result.kairosInsight,
        draftEvent: result.intent === 'create_event' ? { ...result.details, type: 'work' } : undefined,
        draftTask: result.intent === 'create_task' ? { ...result.details } : undefined,
      };

      onUpdateMessages(activeChat.id, [...updatedMessages, aiMsg]);
    } catch (e) { 
      console.error("Gemini API Error:", e);
      onUpdateMessages(activeChat.id, [...updatedMessages, { 
        id: Date.now().toString(), 
        role: 'assistant', 
        content: language === 'ru' ? "Простите, мои системы временно недоступны. Пожалуйста, попробуйте снова." : "Apologies, my systems are temporarily unreachable. Please try again." 
      }]);
    } finally { 
      setIsTyping(false); 
      setActiveModel(null);
    }
  };

  const renderMarkdown = (text: string) => {
    const imgRegex = /!\[([^\]]*)\]\((data:image\/[^;]+;base64,[^)]+)\)/g;
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    
    return text.split('\n').map((line, i) => {
      const imgMatch = imgRegex.exec(line);
      if (imgMatch) {
        return (
          <div key={i} className="my-4 overflow-hidden rounded-2xl shadow-lg border border-charcoal/10 bg-cream group">
             <div className="px-4 py-2 bg-charcoal text-cream text-[9px] font-black uppercase tracking-widest flex items-center justify-between">
                <span>Kairos Vision</span>
                <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
             </div>
             <img src={imgMatch[2]} alt={imgMatch[1]} className="w-full object-cover aspect-video group-hover:scale-[1.02] transition-transform duration-500" />
          </div>
        );
      }

      const parts = line.split(linkRegex);
      if (parts.length === 1) return <p key={i} className="mb-1">{line}</p>;
      const elements = [];
      for (let j = 0; j < parts.length; j += 3) {
        elements.push(parts[j]);
        if (parts[j+1]) elements.push(<a key={`${i}-${j}`} href={parts[j+2]} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-bold">{parts[j+1]}</a>);
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
                    <button 
                      onClick={() => handleSyncDraft(msg.id, 'event', msg.draftEvent)} 
                      disabled={msg.isSynced}
                      className={`w-full py-2 text-[10px] font-black uppercase rounded-lg shadow-lg active:scale-95 transition-all ${msg.isSynced ? 'bg-charcoal/10 text-charcoal/30 cursor-not-allowed' : 'bg-primary text-charcoal'}`}
                    >
                      {msg.isSynced ? (language === 'ru' ? 'ДОБАВЛЕНО' : 'ADDED') : t.chat.syncNow}
                    </button>
                  </div>
                )}
                {msg.draftTask && (
                  <div className="mt-4 p-4 bg-primary text-charcoal rounded-2xl space-y-3 border border-charcoal/10 shadow-lg">
                    <div className="flex justify-between items-start">
                      <p className="text-[9px] font-black uppercase tracking-widest opacity-40">{t.calendar.task}</p>
                      {msg.draftTask.recurrence !== 'none' && <span className="material-symbols-outlined text-[14px]">sync</span>}
                    </div>
                    <h4 className="font-extrabold text-base leading-tight">{msg.draftTask.title}</h4>
                    <p className="text-[10px] font-bold opacity-60">
                      {msg.draftTask.recurrence === 'specific_days' ? (language === 'ru' ? 'Цикличное расписание' : 'Recurring Routine') : (msg.draftTask.date || TODAY)}
                    </p>
                    <button 
                      onClick={() => handleSyncDraft(msg.id, 'task', msg.draftTask)} 
                      disabled={msg.isSynced}
                      className={`w-full py-2.5 text-[10px] font-black uppercase rounded-xl shadow-2xl active:scale-95 transition-all ${msg.isSynced ? 'bg-charcoal/10 text-charcoal/30 cursor-not-allowed' : 'bg-charcoal text-cream'}`}
                    >
                      {msg.isSynced ? (language === 'ru' ? 'ДОБАВЛЕНО' : 'ADDED') : t.calendar.addSchedule}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex items-center gap-3 animate-pulse">
              <div className="size-2 bg-primary rounded-full"></div>
              <div className="text-[10px] uppercase font-black text-charcoal/30 tracking-widest">{t.chat.analyzing}</div>
            </div>
          )}
        </div>
        <div className="px-6 py-6 border-t border-charcoal/5 bg-white/60">
          <div className="flex items-center gap-2">
            <input className="flex-1 bg-white border border-charcoal/10 focus:ring-primary focus:border-primary rounded-2xl py-4 px-6 text-sm font-medium" placeholder={t.chat.placeholder} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()}/>
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
