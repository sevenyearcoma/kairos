
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Event, Task, Language, KnowledgeBase } from '../types';
import ItemDetailModal from '../components/ItemDetailModal';
import { isItemOnDate } from '../utils/dateUtils';
import { getT } from '../translations';

// Hour height in pixels for the time-grid
const HOUR_HEIGHT = 80;

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
  onEditTask: (id: string, updates: any) => void;
  onSyncGoogle: () => void;
  onDisconnectGoogle: () => void;
  isGoogleConnected: boolean;
  lastSyncTime?: string | null;
  isSyncing?: boolean;
}

type ViewMode = 'month' | 'schedule' | 'week';

const CalendarView: React.FC<CalendarViewProps> = ({ 
  events, tasks, language, knowledgeBase, onUpdateKnowledgeBase, onDeleteEvent, onAddEvent, onAddTask, onEditEvent, onEditTask, onSyncGoogle, onDisconnectGoogle, isGoogleConnected, lastSyncTime, isSyncing = false 
}) => {
  const t = useMemo(() => getT(language), [language]);
  const [viewDate, setViewDate] = useState(new Date()); 
  const [selectedDateStr, setSelectedDateStr] = useState(new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('kairos_calendar_view') as ViewMode) || 'month';
  });
  
  const [selectedItem, setSelectedItem] = useState<Event | Task | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  
  const [quickAddType, setQuickAddType] = useState<'event' | 'task'>('event');
  const [quickAddTitle, setQuickAddTitle] = useState('');

  // Voice Input State
  const [isListening, setIsListening] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recognitionRef = useRef<any>(null);
  const baseInputRef = useRef('');

  useEffect(() => {
    localStorage.setItem('kairos_calendar_view', viewMode);
  }, [viewMode]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  useEffect(() => {
    let interval: number;
    if (isListening) {
      interval = window.setInterval(() => {
        setRecordingTime(prev => (prev >= 120 ? prev : prev + 1));
      }, 1000);
    } else {
      setRecordingTime(0);
    }
    return () => clearInterval(interval);
  }, [isListening]);

  const stopListening = () => {
    if (recognitionRef.current) recognitionRef.current.stop();
    setIsListening(false);
  };

  const toggleListening = () => {
    if (isListening) { stopListening(); return; }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Voice input is not supported."); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = language === 'ru' ? 'ru-RU' : 'en-US';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = true;
    recognition.onstart = () => { setIsListening(true); setRecordingTime(0); baseInputRef.current = quickAddTitle; };
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; ++i) transcript += event.results[i][0].transcript;
      if (transcript) setQuickAddTitle(baseInputRef.current + (baseInputRef.current && !baseInputRef.current.endsWith(' ') ? ' ' : '') + transcript);
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const currentMonthIdx = viewDate.getMonth();
  const currentYear = viewDate.getFullYear();
  const currentMonthName = viewDate.toLocaleString(language === 'ru' ? 'ru-RU' : 'en-US', { month: 'long' });

  // Week View Logic
  const weekStart = useMemo(() => {
    const d = new Date(viewDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [viewDate]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const weekEvents = useMemo(() => {
    return weekDays.map(day => {
      const ds = day.toISOString().split('T')[0];
      const dayEvents = events.filter(e => isItemOnDate(e, ds));
      const dayTasks = tasks.filter(t => isItemOnDate(t, ds) && !t.completed);
      return { date: ds, events: dayEvents, tasks: dayTasks };
    });
  }, [weekDays, events, tasks]);

  // Agenda / Schedule Data logic (replaces previous external fixed array)
  const scheduleData = useMemo(() => {
    const agenda: { dateStr: string; items: (Event | Task)[] }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const ds = d.toISOString().split('T')[0];
      const items = [
        ...events.filter(e => isItemOnDate(e, ds)),
        ...tasks.filter(t => isItemOnDate(t, ds) && !t.completed)
      ];
      if (items.length) {
        // Sort items by time for the day if they are events
        items.sort((a, b) => {
          const timeA = 'startTime' in a ? a.startTime : '00:00';
          const timeB = 'startTime' in b ? b.startTime : '00:00';
          return timeA.localeCompare(timeB);
        });
        agenda.push({ dateStr: ds, items });
      }
    }
    return agenda;
  }, [events, tasks]);

  const calculatePosition = (timeStr: string) => {
    if (!timeStr || timeStr === 'All Day') return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h + m / 60) * HOUR_HEIGHT;
  };

  const calculateHeight = (start: string, end: string) => {
    if (!start || !end || start === 'All Day') return HOUR_HEIGHT;
    const startPos = calculatePosition(start);
    const endPos = calculatePosition(end);
    return Math.max(endPos - startPos, 30); // Min height 30px
  };

  const timeIndicatorTop = useMemo(() => {
    const now = new Date();
    return (now.getHours() + now.getMinutes() / 60) * HOUR_HEIGHT;
  }, []);

  const changeWeek = (offset: number) => {
    setViewDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + offset * 7);
      return d;
    });
  };

  function handleQuickAddSubmit() {
    if (!quickAddTitle.trim()) return;
    if (quickAddType === 'event') onAddEvent({ title: quickAddTitle, date: selectedDateStr, startTime: '10:00', endTime: '11:00' });
    else onAddTask(quickAddTitle, 'Personal', selectedDateStr);
    setQuickAddTitle('');
  }

  function changeMonth(offset: number) {
    setViewDate(prev => { const d = new Date(prev); d.setMonth(d.getMonth() + offset); return d; });
  }

  return (
    <div className="space-y-8 md:space-y-12 h-full flex flex-col relative pb-20 md:pb-4 overflow-hidden">
      <ItemDetailModal 
        item={selectedItem} 
        onClose={() => setSelectedItem(null)} 
        onEdit={(id, updates) => { setSelectedItem(prev => prev ? { ...prev, ...updates } : null); onEditEvent(id, updates); }} 
        language={language}
      />

      {showQuickAdd && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-charcoal/20 backdrop-blur-sm" onClick={() => setShowQuickAdd(false)}></div>
          <div className="relative w-full max-w-sm bg-white rounded-[2rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-charcoal/20 mb-6">{t.calendar.quickAdd} — {selectedDateStr}</h3>
            <div className="flex bg-beige-soft p-1 rounded-xl mb-6">
              {['event', 'task'].map(type => (
                <button 
                  key={type} 
                  onClick={() => setQuickAddType(type as any)}
                  className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${quickAddType === type ? 'bg-charcoal text-cream shadow-md' : 'text-charcoal/40 hover:text-charcoal'}`}
                >
                  {t.calendar[type as keyof typeof t.calendar]}
                </button>
              ))}
            </div>
            <div className="relative mb-6">
              <input autoFocus className="w-full bg-beige-soft border-none rounded-xl py-4 pl-6 pr-14 text-sm font-bold" placeholder={isListening ? t.chat.listening : (quickAddType === 'event' ? t.calendar.eventTitle : t.calendar.taskDesc)} value={quickAddTitle} onChange={(e) => setQuickAddTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (handleQuickAddSubmit(), setShowQuickAdd(false))} />
              <button onClick={toggleListening} className={`absolute right-3 top-1/2 -translate-y-1/2 size-10 flex items-center justify-center rounded-xl transition-all ${isListening ? 'bg-red-500 text-white' : 'text-charcoal/20 hover:text-charcoal'}`}><span className="material-symbols-outlined">{isListening ? 'mic' : 'mic'}</span></button>
            </div>
            <button onClick={() => { handleQuickAddSubmit(); setShowQuickAdd(false); }} disabled={!quickAddTitle.trim()} className="w-full py-4 bg-primary text-charcoal font-black uppercase tracking-widest text-[10px] rounded-xl shadow-lg"> {t.calendar.addSchedule} </button>
          </div>
        </div>
      )}

      <header className="flex flex-col gap-6 px-4 md:px-0 shrink-0">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-4">
              <h1 className="text-4xl md:text-5xl font-display font-black tracking-tight text-charcoal capitalize">
                {viewMode === 'month' ? `${currentMonthName} ${currentYear}` : viewMode === 'week' ? `${weekDays[0].toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short' })} — ${weekDays[6].toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short' })}` : t.calendar.upcoming}
              </h1>
              {viewMode !== 'schedule' && (
                <div className="flex gap-2">
                  <button onClick={() => viewMode === 'month' ? changeMonth(-1) : changeWeek(-1)} className="size-10 flex items-center justify-center hover:bg-charcoal/5 rounded-xl border border-charcoal/5"><span className="material-symbols-outlined text-charcoal/40">chevron_left</span></button>
                  <button onClick={() => viewMode === 'month' ? changeMonth(1) : changeWeek(1)} className="size-10 flex items-center justify-center hover:bg-charcoal/5 rounded-xl border border-charcoal/5"><span className="material-symbols-outlined text-charcoal/40">chevron_right</span></button>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
             <div className="flex bg-beige-soft border border-charcoal/5 rounded-2xl p-1 shadow-sm">
               {['month', 'week', 'schedule'].map((mode) => (
                 <button 
                    key={mode}
                    onClick={() => setViewMode(mode as ViewMode)}
                    className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === mode ? 'bg-charcoal text-cream shadow-xl' : 'text-charcoal/30 hover:text-charcoal'}`}
                 >
                   {t.calendar[mode === 'month' ? 'viewMonth' : mode === 'week' ? 'viewWeek' : 'viewSchedule']}
                 </button>
               ))}
             </div>
             <button onClick={() => setShowQuickAdd(true)} className="size-12 bg-charcoal text-cream rounded-2xl flex items-center justify-center hover:bg-primary transition-all shadow-xl active:scale-90"><span className="material-symbols-outlined">add</span></button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden relative">
        {viewMode === 'week' ? (
          <div className="h-full flex flex-col bg-white/50 border border-charcoal/5 rounded-[2.5rem] shadow-sm overflow-hidden">
            {/* Week Headers */}
            <div className="flex border-b border-charcoal/5 bg-white/80 backdrop-blur-md z-20 shrink-0">
              <div className="w-16 shrink-0 border-r border-charcoal/5"></div>
              {weekDays.map((day, i) => {
                const isToday = day.toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
                return (
                  <div key={i} className="flex-1 py-4 text-center border-r border-charcoal/5 last:border-r-0">
                    <p className={`text-[10px] font-black uppercase tracking-widest ${isToday ? 'text-primary' : 'text-charcoal/30'}`}>{t.common.shortWeekDays[i]}</p>
                    <p className={`text-xl font-display font-black ${isToday ? 'text-primary' : 'text-charcoal'}`}>{day.getDate()}</p>
                  </div>
                );
              })}
            </div>
            {/* Week Grid Content */}
            <div className="flex-1 overflow-y-auto scrollbar-hide relative bg-white">
              <div className="flex min-h-[1920px]"> {/* 24 hours * 80px */}
                {/* Time Scale */}
                <div className="w-16 shrink-0 border-r border-charcoal/5 bg-beige-soft/30 sticky left-0 z-10">
                  {Array.from({ length: 24 }).map((_, h) => (
                    <div key={h} className="h-20 border-b border-charcoal/[0.03] px-2 py-1 flex justify-end">
                      <span className="text-[10px] font-black text-charcoal/20">{h}:00</span>
                    </div>
                  ))}
                </div>
                {/* Days Columns */}
                <div className="flex-1 flex relative">
                  {/* Current Time Indicator */}
                  {weekStart <= new Date() && new Date() < new Date(weekStart.getTime() + 7*24*60*60*1000) && (
                    <div className="absolute left-0 right-0 z-30 pointer-events-none flex items-center" style={{ top: timeIndicatorTop }}>
                      <div className="size-2 bg-red-500 rounded-full -ml-1"></div>
                      <div className="h-[1px] flex-1 bg-red-500/50"></div>
                    </div>
                  )}
                  {weekEvents.map((dayData, i) => (
                    <div key={i} className="flex-1 relative border-r border-charcoal/[0.03] last:border-r-0 h-full group">
                      {/* Hour lines within columns */}
                      {Array.from({ length: 24 }).map((_, h) => (
                        <div key={h} className="h-20 border-b border-charcoal/[0.03]"></div>
                      ))}
                      {/* Event Blocks */}
                      {dayData.events.map(event => (
                        <div 
                          key={event.id}
                          onClick={() => setSelectedItem(event)}
                          className={`absolute left-1 right-1 rounded-xl p-2 text-xs font-bold shadow-sm transition-all hover:shadow-xl hover:-translate-y-0.5 cursor-pointer overflow-hidden z-20 ${event.source === 'google' ? 'bg-primary/10 border-l-4 border-primary text-primary' : 'bg-charcoal text-white'}`}
                          style={{ top: calculatePosition(event.startTime), height: calculateHeight(event.startTime, event.endTime) }}
                        >
                          <div className="flex items-center gap-1 mb-0.5">
                            <span className="text-[8px] font-black opacity-60">{event.startTime}</span>
                            {event.source === 'google' && <span className="material-symbols-outlined text-[10px]">cloud</span>}
                          </div>
                          <p className="line-clamp-2 leading-tight tracking-tight">{event.title}</p>
                        </div>
                      ))}
                      {/* Tasks as small dots or thin strips if no time */}
                      {dayData.tasks.map(task => (
                        <div 
                          key={task.id}
                          onClick={() => setSelectedItem(task)}
                          className="absolute left-1 right-1 h-8 rounded-lg border border-primary/20 bg-primary/5 p-1 text-[9px] font-black uppercase text-primary/60 hover:bg-primary/20 transition-all z-10 overflow-hidden flex items-center gap-1"
                          style={{ top: calculatePosition(task.time || '09:00') }}
                        >
                           <span className="material-symbols-outlined text-[12px]">task_alt</span>
                           <span className="truncate">{task.title}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : viewMode === 'month' ? (
          <div className="grid lg:grid-cols-12 gap-12 items-start h-full px-4 md:px-0 overflow-y-auto scrollbar-hide">
            <div className="lg:col-span-7 bg-white p-6 md:p-10 rounded-[3rem] border border-charcoal/[0.03] shadow-sm">
              <div className="grid grid-cols-7 text-center mb-10">
                {t.common.weekDays.map(d => ( <div key={d} className="text-[10px] font-black text-charcoal/20 uppercase tracking-widest">{d}</div> ))}
              </div>
              <div className="grid grid-cols-7 gap-y-6 gap-x-2">
                {Array.from({ length: (new Date(currentYear, currentMonthIdx, 1).getDay() || 7) - 1 }).map((_, i) => <div key={`p-${i}`}></div>)}
                {Array.from({ length: new Date(currentYear, currentMonthIdx + 1, 0).getDate() }).map((_, i) => {
                  const d = i + 1;
                  const ds = `${currentYear}-${(currentMonthIdx + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
                  const hasItems = events.some(e => isItemOnDate(e, ds)) || tasks.some(t => isItemOnDate(t, ds) && !t.completed);
                  const isSelected = selectedDateStr === ds;
                  return (
                    <div key={d} onClick={() => setSelectedDateStr(ds)} className="relative group cursor-pointer aspect-square flex items-center justify-center transition-all">
                      <div className={`size-12 rounded-2xl flex items-center justify-center text-sm font-bold transition-all ${isSelected ? 'bg-charcoal text-cream shadow-2xl scale-110' : 'text-charcoal group-hover:bg-primary/10'}`}>{d}</div>
                      {hasItems && !isSelected && <div className="absolute bottom-1 size-1.5 rounded-full bg-primary"></div>}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="lg:col-span-5 flex flex-col gap-6">
               <h2 className="text-[11px] font-black uppercase tracking-widest text-charcoal/20">
                 {new Date(selectedDateStr).toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long' })}
               </h2>
               <div className="space-y-4">
                 {[...events.filter(e => isItemOnDate(e, selectedDateStr)), ...tasks.filter(t => isItemOnDate(t, selectedDateStr) && !t.completed)].map(item => (
                   <div key={item.id} onClick={() => setSelectedItem(item)} className="p-6 bg-white border border-charcoal/5 rounded-[2.5rem] hover:shadow-xl transition-all cursor-pointer">
                      <p className="text-[10px] font-black uppercase text-primary mb-2">{'startTime' in item ? (item as Event).startTime : (item as Task).category}</p>
                      <h4 className="font-bold text-charcoal">{item.title}</h4>
                   </div>
                 ))}
               </div>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto px-4 md:px-0 space-y-10 overflow-y-auto h-full scrollbar-hide pb-20">
            {scheduleData.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-20 text-center opacity-20">
                 <span className="material-symbols-outlined text-6xl mb-4">calendar_today</span>
                 <p className="text-sm font-bold uppercase tracking-widest">{t.calendar.noPlans}</p>
               </div>
            ) : (
              scheduleData.map(day => (
                <div key={day.dateStr} className="space-y-4">
                  <h3 className="text-lg font-display font-black text-charcoal border-b border-charcoal/5 pb-2 capitalize">
                    {new Date(day.dateStr).toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </h3>
                  {day.items.map(item => (
                    <div key={item.id} onClick={() => setSelectedItem(item)} className="flex items-center gap-6 p-6 bg-white/50 border border-charcoal/5 rounded-[2rem] hover:bg-white transition-all cursor-pointer shadow-sm">
                      <span className="w-16 text-[11px] font-black text-primary uppercase">{'startTime' in item ? (item as Event).startTime : '--:--'}</span>
                      <h4 className="font-bold text-charcoal flex-1 truncate">{item.title}</h4>
                      <span className="material-symbols-outlined text-charcoal/10">chevron_right</span>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarView;
