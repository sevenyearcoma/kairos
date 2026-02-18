
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Event, Task, Language, KnowledgeBase } from '../types';
import ItemDetailModal from '../components/ItemDetailModal';
import { isItemOnDate } from '../utils/dateUtils';
import { getT } from '../translations';

// Extend Window interface for Web Speech API support
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

interface CalendarViewProps {
  events: Event[];
  tasks: Task[];
  language: Language;
  knowledgeBase: KnowledgeBase;
  onUpdateKnowledgeBase: (kb: KnowledgeBase) => void;
  onDeleteEvent: (id: string) => void;
  onAddEvent: (event: Partial<Event>) => void;
  onAddTask: (title: string, category: string, date: string) => void;
  onEditEvent: (id: string, updates: any) => void;
  onSyncGoogle: () => void;
  onDisconnectGoogle: () => void;
  isGoogleConnected: boolean;
  lastSyncTime?: string | null;
  isSyncing?: boolean;
}

const CalendarView: React.FC<CalendarViewProps> = ({ 
  events, tasks, language, knowledgeBase, onUpdateKnowledgeBase, onDeleteEvent, onAddEvent, onAddTask, onEditEvent, onSyncGoogle, onDisconnectGoogle, isGoogleConnected, lastSyncTime, isSyncing = false 
}) => {
  const t = useMemo(() => getT(language), [language]);
  const [viewDate, setViewDate] = useState(new Date()); 
  const [selectedDateStr, setSelectedDateStr] = useState(new Date().toISOString().split('T')[0]);
  const [selectedItem, setSelectedItem] = useState<Event | Task | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  
  const [quickAddType, setQuickAddType] = useState<'event' | 'task'>('event');
  const [quickAddTitle, setQuickAddTitle] = useState('');

  // Voice Input State
  const [isListening, setIsListening] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recognitionRef = useRef<any>(null);
  const baseInputRef = useRef(''); // Stores text present before recording started

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
          if (prev >= 120) { // 120 seconds limit
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
    recognition.interimResults = true; // Crucial for Russian feedback
    recognition.maxAlternatives = 1;
    recognition.continuous = true;

    recognition.onstart = () => {
      setIsListening(true);
      setRecordingTime(0);
      baseInputRef.current = quickAddTitle; // Capture existing text
    };
    recognition.onend = () => setIsListening(false);
    
    recognition.onresult = (event: any) => {
      let currentTranscript = '';
      for (let i = 0; i < event.results.length; ++i) {
        currentTranscript += event.results[i][0].transcript;
      }
      
      if (currentTranscript) {
        const separator = baseInputRef.current && !baseInputRef.current.endsWith(' ') ? ' ' : '';
        setQuickAddTitle(baseInputRef.current + separator + currentTranscript);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const currentMonthIdx = viewDate.getMonth();
  const currentYear = viewDate.getFullYear();
  const currentMonthName = viewDate.toLocaleString(language === 'ru' ? 'ru-RU' : 'en-US', { month: 'long' });

  const daysInMonth = useMemo(() => {
    return new Date(currentYear, currentMonthIdx + 1, 0).getDate();
  }, [currentYear, currentMonthIdx]);

  const firstDayOfMonth = useMemo(() => {
    const day = new Date(currentYear, currentMonthIdx, 1).getDay();
    // Monday start: Sun(0) -> 6, Mon(1) -> 0, etc.
    return day === 0 ? 6 : day - 1;
  }, [currentYear, currentMonthIdx]);

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const paddingDays = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  const filteredItems = useMemo(() => {
    const dayEvents = events.filter(e => isItemOnDate(e, selectedDateStr));
    const dayTasks = tasks.filter(t => isItemOnDate(t, selectedDateStr) && !t.completed && !t.failed);
    return { events: dayEvents, tasks: dayTasks };
  }, [events, tasks, selectedDateStr]);

  const updateKnowledgeBaseBackground = async (itemTitle: string, itemType: string) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const memorySystemInstruction = `
        Role: Kairos Memory Manager.
        Task: Maintain a curated "User Knowledge Base" in JSON format.
        
        Current Knowledge Context:
        ${JSON.stringify(knowledgeBase)}

        User Action: Created ${itemType} "${itemTitle}".

        RULES:
        1. EXTRACT: Identify new facts about the user (e.g., job, tech stack, habits, goals).
        2. MERGE: Combine related facts into a single point.
           Example: "React Developer" + "Uses Next.js" -> "Frontend Stack: React, Next.js".
        3. LIMIT: The knowledge base should contain approx 15 distinct high-level "knowledge points" (keys or array items).
        4. EVICT: If the limit is reached, remove the least relevant or oldest fact to make room for new, more important info.
        5. OUTPUT: Return the FULL updated JSON object. Structure it as a flat object or categorical object.
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
      
      const updatedKb = JSON.parse(memoryResponse.text || "{}");
      if (Object.keys(updatedKb).length > 0) {
        onUpdateKnowledgeBase(updatedKb);
      }
    } catch (err) {
      console.warn("Background Memory Update failed", err);
    }
  };

  const handleQuickAddSubmit = () => {
    if (!quickAddTitle.trim()) return;
    if (isListening) stopListening();
    
    if (quickAddType === 'event') {
      onAddEvent({
        title: quickAddTitle,
        date: selectedDateStr,
        startTime: '10:00',
        endTime: '11:00',
        type: 'work',
        location: 'Office'
      });
      updateKnowledgeBaseBackground(quickAddTitle, 'Event');
    } else {
      onAddTask(quickAddTitle, 'Personal', selectedDateStr);
      updateKnowledgeBaseBackground(quickAddTitle, 'Task');
    }
    
    setQuickAddTitle('');
    setShowQuickAdd(false);
  };

  const changeMonth = (offset: number) => {
    setViewDate(prev => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + offset);
      return d;
    });
  };

  const handleDayClick = (d: number) => {
    const month = (currentMonthIdx + 1).toString().padStart(2, '0');
    const day = d.toString().padStart(2, '0');
    setSelectedDateStr(`${currentYear}-${month}-${day}`);
  };

  const totalItemsCount = filteredItems.events.length + filteredItems.tasks.length;
  
  return (
    <div className="space-y-12 pb-32 md:pb-0 h-full relative">
      <ItemDetailModal 
        item={selectedItem} 
        onClose={() => setSelectedItem(null)} 
        onEdit={onEditEvent} 
        language={language}
      />

      {showQuickAdd && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-charcoal/20 backdrop-blur-sm" onClick={() => setShowQuickAdd(false)}></div>
          <div className="relative w-full max-w-sm bg-white rounded-[2rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-charcoal/20 mb-6">{t.calendar.quickAdd} — {selectedDateStr}</h3>
            <div className="flex bg-beige-soft p-1 rounded-xl mb-6">
              <button 
                onClick={() => setQuickAddType('event')}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${quickAddType === 'event' ? 'bg-charcoal text-cream shadow-md' : 'text-charcoal/40 hover:text-charcoal'}`}
              >
                {t.calendar.event}
              </button>
              <button 
                onClick={() => setQuickAddType('task')}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${quickAddType === 'task' ? 'bg-charcoal text-cream shadow-md' : 'text-charcoal/40 hover:text-charcoal'}`}
              >
                {t.calendar.task}
              </button>
            </div>
            <div className="relative mb-6">
              {isListening && (
                <div className="absolute inset-0 rounded-xl bg-red-500/5 animate-pulse pointer-events-none"></div>
              )}
              <input 
                autoFocus
                className={`
                   w-full bg-beige-soft border-none rounded-xl py-4 pl-6 pr-20 text-sm font-bold placeholder:text-charcoal/10 focus:ring-2 focus:ring-primary transition-all 
                   ${isListening ? 'text-red-600 ring-2 ring-red-500/20' : ''}
                `}
                placeholder={isListening ? t.chat.listening : (quickAddType === 'event' ? t.calendar.eventTitle : t.calendar.taskDesc)}
                value={quickAddTitle}
                readOnly={isListening} // Prevent typing while recording
                onChange={(e) => setQuickAddTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleQuickAddSubmit()}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`
                    size-10 flex items-center justify-center rounded-xl transition-all 
                    ${isListening 
                      ? 'bg-red-500 text-white shadow-lg scale-105' 
                      : 'text-charcoal/20 hover:text-charcoal hover:bg-charcoal/5'
                    }
                  `}
                  title={isListening ? "Stop Recording" : "Start Voice Input"}
                >
                  {isListening ? (
                       <div className="flex items-center gap-[2px]">
                         <span className="w-0.5 h-2 bg-white rounded-full animate-bounce"></span>
                         <span className="w-0.5 h-4 bg-white rounded-full animate-bounce [animation-delay:0.1s]"></span>
                         <span className="w-0.5 h-2 bg-white rounded-full animate-bounce [animation-delay:0.2s]"></span>
                       </div>
                  ) : (
                    <span className="material-symbols-outlined text-[20px]">mic</span>
                  )}
                </button>
              </div>
              {isListening && (
                 <div className="absolute -top-3 right-0 bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full animate-in fade-in slide-in-from-bottom-1">
                    {formatTime(recordingTime)}
                 </div>
              )}
            </div>
            <button 
              onClick={handleQuickAddSubmit}
              disabled={!quickAddTitle.trim()}
              className="w-full py-4 bg-primary text-charcoal font-black uppercase tracking-widest text-[10px] rounded-xl shadow-lg active:scale-95 transition-all disabled:opacity-20"
            >
              {t.calendar.addSchedule}
            </button>
          </div>
        </div>
      )}

      <header className="flex flex-col md:flex-row md:items-end justify-between px-4 md:px-0 gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-4">
            <h1 className="text-5xl font-display font-black tracking-tight text-charcoal capitalize">{currentMonthName} {currentYear}</h1>
            <div className="flex gap-2">
              <button onClick={() => changeMonth(-1)} className="size-10 flex items-center justify-center hover:bg-charcoal/5 rounded-xl transition-all border border-charcoal/5">
                <span className="material-symbols-outlined text-charcoal/40">chevron_left</span>
              </button>
              <button onClick={() => changeMonth(1)} className="size-10 flex items-center justify-center hover:bg-charcoal/5 rounded-xl transition-all border border-charcoal/5">
                <span className="material-symbols-outlined text-charcoal/40">chevron_right</span>
              </button>
            </div>
          </div>
          {isGoogleConnected && lastSyncTime && (
            <p className="text-[9px] font-black text-primary uppercase tracking-widest flex items-center gap-1.5 ml-1">
              <span className={`material-symbols-outlined text-[12px] ${isSyncing ? 'animate-spin' : ''}`}>{isSyncing ? 'sync' : 'done_all'}</span>
              {isSyncing ? t.common.syncing : `${t.common.syncedAt} ${lastSyncTime}`}
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <div className="flex items-center bg-beige-soft border border-charcoal/5 rounded-2xl p-1 shadow-sm">
            <button 
              onClick={onSyncGoogle}
              disabled={isSyncing}
              className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                isGoogleConnected 
                  ? 'bg-primary/10 text-primary' 
                  : 'text-charcoal/40 hover:text-charcoal hover:bg-white'
              }`}
            >
              <span className={`material-symbols-outlined text-[18px] ${isSyncing ? 'animate-spin' : ''}`}>
                {isGoogleConnected ? 'sync' : 'cloud_off'}
              </span>
              {isGoogleConnected ? t.common.syncNow : t.calendar.linkGoogle}
            </button>
            {isGoogleConnected && (
              <button 
                onClick={onDisconnectGoogle}
                title={t.common.disconnect}
                className="size-10 flex items-center justify-center text-charcoal/20 hover:text-red-500 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
              </button>
            )}
          </div>
          <button 
            onClick={() => setShowQuickAdd(true)}
            className="size-12 bg-charcoal text-cream rounded-2xl flex items-center justify-center hover:bg-primary transition-all shadow-xl active:scale-90"
          >
            <span className="material-symbols-outlined text-[24px]">add</span>
          </button>
        </div>
      </header>

      <div className="grid lg:grid-cols-12 gap-12 items-start">
        <div className="lg:col-span-7 bg-white p-10 rounded-[3rem] shadow-[0_10px_50px_rgba(0,0,0,0.03)] border border-charcoal/[0.03]">
          <div className="grid grid-cols-7 text-center mb-10">
            {t.common.weekDays.map(d => (
              <div key={d} className="text-[10px] font-black text-charcoal/20 uppercase tracking-widest">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-6 gap-x-2">
            {paddingDays.map(p => <div key={`p-${p}`}></div>)}
            {days.map(d => {
              const month = (currentMonthIdx + 1).toString().padStart(2, '0');
              const dateStr = `${currentYear}-${month}-${d.toString().padStart(2, '0')}`;
              
              const dayItems = [...events.filter(e => isItemOnDate(e, dateStr)), ...tasks.filter(t => isItemOnDate(t, dateStr) && !t.completed && !t.failed)];
              
              const hasOneTime = dayItems.some(i => !i.recurrence || i.recurrence === 'none');
              const hasRecurringOnly = dayItems.length > 0 && dayItems.every(i => i.recurrence && i.recurrence !== 'none');
              
              const isSelected = selectedDateStr === dateStr;
              
              return (
                <div 
                  key={d} 
                  onClick={() => handleDayClick(d)}
                  className="relative group cursor-pointer aspect-square flex items-center justify-center transition-all duration-300"
                >
                  <div className={`size-12 rounded-2xl flex items-center justify-center text-[15px] font-bold transition-all group-hover:bg-primary group-hover:text-white ${
                    isSelected ? 'bg-charcoal text-cream shadow-2xl scale-110' : 'text-charcoal'
                  }`}>
                    {d}
                  </div>
                  {!isSelected && (
                    <div className="absolute bottom-0 flex gap-1">
                       {hasOneTime && <div className="size-1.5 rounded-full bg-primary shadow-[0_0_5px_rgba(17,212,180,0.8)]"></div>}
                       {hasRecurringOnly && <div className="size-1 rounded-full bg-charcoal/10"></div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-5 space-y-8 h-full flex flex-col">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-charcoal/20">
              {new Date(selectedDateStr).toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long' })}
            </h2>
            <span className="text-[10px] bg-beige-soft border border-charcoal/5 text-charcoal/60 px-3 py-1 rounded-full font-black uppercase tracking-tighter">
              {totalItemsCount} {t.calendar.objectives}
            </span>
          </div>

          <div className="space-y-6 flex-1 overflow-y-auto scrollbar-hide pr-2">
            {totalItemsCount > 0 ? (
              <>
                {filteredItems.events.length > 0 && (
                  <div className="space-y-4">
                    {filteredItems.events.map((event) => (
                      <div 
                        key={event.id} 
                        onClick={() => setSelectedItem(event)}
                        className="group relative pl-8 py-5 bg-white border border-charcoal/5 rounded-[2.5rem] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer"
                      >
                        <div className={`absolute left-0 top-8 bottom-8 w-[3px] rounded-r-full transition-all ${
                          event.source === 'google' ? 'bg-primary' : (event.type === 'personal' ? 'bg-charcoal/5' : 'bg-primary')
                        }`}></div>
                        <div className="flex justify-between items-start pr-6">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                                {event.startTime}
                              </p>
                              {event.recurrence && event.recurrence !== 'none' && (
                                <span className="material-symbols-outlined text-[14px] text-charcoal/20">sync</span>
                              )}
                              {event.source === 'google' && (
                                <div className="flex items-center gap-1 bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                                  <span className="material-symbols-outlined text-[11px]">cloud</span>
                                  <span className="text-[8px] font-black uppercase tracking-tighter">{t.common.google}</span>
                                </div>
                              )}
                            </div>
                            <h3 className="text-lg font-display font-bold text-charcoal leading-tight">{event.title}</h3>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); onDeleteEvent(event.id); }} className="opacity-0 group-hover:opacity-100 p-2 text-charcoal/10 hover:text-red-500 transition-all"><span className="material-symbols-outlined text-xl">delete</span></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {filteredItems.tasks.length > 0 && (
                  <div className="space-y-4 pt-2">
                    {filteredItems.tasks.map((task) => (
                      <div 
                        key={task.id} 
                        onClick={() => setSelectedItem(task)}
                        className="group flex items-center gap-5 p-6 bg-white border border-charcoal/5 rounded-[2.5rem] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer"
                      >
                        <div className="size-10 bg-beige-soft rounded-xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
                          <span className="material-symbols-outlined text-[20px]">{task.source === 'google' ? 'cloud' : (task.recurrence && task.recurrence !== 'none' ? 'sync' : 'task_alt')}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-base font-bold text-charcoal truncate mb-1">{task.title}</h4>
                          <span className="text-[10px] font-black uppercase text-charcoal/20 tracking-[0.2em]">{task.category} {task.source === 'google' ? `• ${t.common.google}` : ''}</span>
                        </div>
                        <span className="material-symbols-outlined text-charcoal/10 group-hover:text-charcoal/30 transition-colors">chevron_right</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="py-20 flex flex-col items-center justify-center bg-white/40 border-2 border-dashed border-charcoal/5 rounded-[3rem] text-center px-10">
                 <div className="size-16 bg-beige-soft rounded-full flex items-center justify-center mb-6">
                   <span className="material-symbols-outlined text-charcoal/10 text-4xl">event_busy</span>
                 </div>
                 <p className="text-[10px] text-charcoal/20 font-black uppercase tracking-widest">{t.calendar.noPlans}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarView;
