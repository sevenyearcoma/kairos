import React, { useState, useMemo } from 'react';
import { useStore } from '@nanostores/react';
import type { Event, Task } from '../types';
import ItemDetailModal from '../components/ItemDetailModal';
import { isItemOnDate } from '../utils/dateUtils';
import { getT } from '../translations';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { $events, $tasks, $language, $isGoogleConnected, $lastSyncTime, $isSyncing, addEvent, addTask, deleteEvent, deleteTask, editEvent, editTask, requestGoogleSync, disconnectGoogle, getLocalDateStr } from '../stores/app';

// Hour height in pixels for the time-grid
const HOUR_HEIGHT = 80;

type ViewMode = 'month' | 'schedule' | 'week';

const CalendarView: React.FC = () => {
  const events = useStore($events);
  const tasks = useStore($tasks);
  const language = useStore($language);
  const isGoogleConnected = useStore($isGoogleConnected);
  const lastSyncTime = useStore($lastSyncTime);
  const isSyncing = useStore($isSyncing);

  const t = useMemo(() => getT(language), [language]);

  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState(() => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
  });
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof localStorage !== 'undefined') {
      return (localStorage.getItem('kairos_calendar_view') as ViewMode) || 'schedule';
    }
    return 'schedule';
  });

  const [selectedItem, setSelectedItem] = useState<Event | Task | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddType, setQuickAddType] = useState<'event' | 'task'>('event');
  const [quickAddTitle, setQuickAddTitle] = useState('');
  const [quickAddStartTime, setQuickAddStartTime] = useState('10:00');
  const [quickAddEndTime, setQuickAddEndTime] = useState('11:00');

  const { isListening, toggleListening } = useVoiceInput({
    onTranscript: setQuickAddTitle,
  });

  React.useEffect(() => {
    localStorage.setItem('kairos_calendar_view', viewMode);
  }, [viewMode]);

  const currentMonthIdx = viewDate.getMonth();
  const currentYear = viewDate.getFullYear();
  const currentMonthName = viewDate.toLocaleString(language === 'ru' ? 'ru-RU' : 'en-US', { month: 'long' });

  const weekStart = useMemo(() => {
    const d = new Date(viewDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
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
    return Math.max(endPos - startPos, 30);
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
    if (quickAddType === 'event') {
      addEvent({ title: quickAddTitle, date: selectedDateStr, startTime: quickAddStartTime, endTime: quickAddEndTime });
    } else {
      addTask(quickAddTitle, 'Personal', selectedDateStr);
    }
    setQuickAddTitle('');
  }

  function changeMonth(offset: number) {
    setViewDate(prev => { const d = new Date(prev); d.setMonth(d.getMonth() + offset); return d; });
  }

  const handleSyncGoogle = requestGoogleSync;

  const handleDeleteItem = (id: string) => {
    if (selectedItem && 'startTime' in selectedItem) {
      deleteEvent(id);
    } else {
      deleteTask(id);
    }
    setSelectedItem(null);
  };

  const selectedDateItems = useMemo(
    () => [
      ...events.filter(e => isItemOnDate(e, selectedDateStr)),
      ...tasks.filter(t => isItemOnDate(t, selectedDateStr) && !t.completed)
    ].sort((a, b) => {
      const timeA = 'startTime' in a ? a.startTime : ((a as Task).time || '23:59');
      const timeB = 'startTime' in b ? b.startTime : ((b as Task).time || '23:59');
      return timeA.localeCompare(timeB);
    }),
    [events, tasks, selectedDateStr]
  );

  const completedTodayTasks = useMemo(
    () => tasks.filter(task => isItemOnDate(task, getLocalDateStr()) && task.completed),
    [tasks, selectedDateStr]
  );

  const desktopTimelineItems = selectedDateItems.length
    ? selectedDateItems
    : scheduleData.flatMap(day => day.items).slice(0, 3);

  return (
    <div className="space-y-5 h-full flex flex-col relative overflow-hidden px-1">
      <ItemDetailModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onEdit={(id, updates) => {
          setSelectedItem(prev => prev ? { ...prev, ...updates } : null);
          if (selectedItem && 'startTime' in selectedItem) editEvent(id, updates);
          else editTask(id, updates);
        }}
        onDelete={handleDeleteItem}
        language={language}
      />

      {showQuickAdd && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-charcoal/30 backdrop-blur-md transition-opacity" onClick={() => setShowQuickAdd(false)}></div>
          <div className="relative w-full max-w-sm stitch-card rounded-3xl p-7 animate-in zoom-in-95 duration-200">
            <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-ink">{selectedDateStr}</p>
            <h3 className="mb-6 font-display text-[22px] italic leading-none text-charcoal">{t.calendar.quickAdd}</h3>

            <div className="mb-6 flex gap-2">
              {['event', 'task'].map(type => (
                <button
                  key={type}
                  onClick={() => setQuickAddType(type as any)}
                  className={`flex-1 rounded-full py-2 text-xs transition ${quickAddType === type ? 'bg-primary/25 text-charcoal' : 'bg-beige-soft/40 text-muted-ink hover:text-charcoal'}`}
                >
                  {t.calendar[type as keyof typeof t.calendar]}
                </button>
              ))}
            </div>

            <div className="mb-7 space-y-4">
              <div className="relative">
                <input
                  autoFocus
                  className="w-full rounded-xl border-none bg-beige-soft/60 py-3 pl-4 pr-12 text-sm text-charcoal placeholder-muted-ink/70 focus:ring-1 focus:ring-primary/30"
                  placeholder={isListening ? t.chat.listening : (quickAddType === 'event' ? t.calendar.eventTitle : t.calendar.taskDesc)}
                  value={quickAddTitle}
                  onChange={(e) => setQuickAddTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && quickAddTitle.trim() && (handleQuickAddSubmit(), setShowQuickAdd(false))}
                />
                <button
                  onClick={() => toggleListening(quickAddTitle)}
                  className={`absolute right-1.5 top-1/2 -translate-y-1/2 flex size-9 items-center justify-center rounded-lg transition ${isListening ? 'bg-[#c8695e] text-white' : 'text-muted-ink hover:text-sage-deep'}`}
                >
                  <span className="material-symbols-outlined text-[18px]">{isListening ? 'stop' : 'mic'}</span>
                </button>
              </div>

              {quickAddType === 'event' && (
                <div className="flex gap-3">
                  <div className="flex-1 space-y-1.5">
                    <label className="pl-1 font-display text-[11px] italic text-muted-ink">start</label>
                    <input
                      type="time"
                      value={quickAddStartTime}
                      onChange={(e) => setQuickAddStartTime(e.target.value)}
                      className="w-full rounded-xl border-none bg-beige-soft/60 px-3 py-2.5 text-sm text-charcoal focus:ring-1 focus:ring-primary/30"
                    />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <label className="pl-1 font-display text-[11px] italic text-muted-ink">end</label>
                    <input
                      type="time"
                      value={quickAddEndTime}
                      onChange={(e) => setQuickAddEndTime(e.target.value)}
                      className="w-full rounded-xl border-none bg-beige-soft/60 px-3 py-2.5 text-sm text-charcoal focus:ring-1 focus:ring-primary/30"
                    />
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => { handleQuickAddSubmit(); setShowQuickAdd(false); }}
              disabled={!quickAddTitle.trim()}
              className="w-full rounded-full bg-primary/25 py-3 text-sm text-charcoal transition hover:bg-primary/35 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t.calendar.addSchedule}
            </button>
          </div>
        </div>
      )}

      <div className="hidden h-full overflow-y-auto pb-10 pr-3 scrollbar-hide md:block">
        <section className="mx-auto max-w-7xl">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <h1 className="font-display text-[34px] font-normal capitalize leading-tight text-charcoal">
                {currentMonthName} {currentYear}
              </h1>
              <p className="mt-1 text-[14px] text-charcoal/52">
                week view - holding space for what matters
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => changeWeek(-1)} className="flex size-10 items-center justify-center rounded-lg border border-charcoal/[0.08] text-charcoal/35 transition hover:bg-white/30 hover:text-sage-deep">
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <button onClick={() => changeWeek(1)} className="flex size-10 items-center justify-center rounded-lg border border-charcoal/[0.08] text-charcoal/35 transition hover:bg-white/30 hover:text-sage-deep">
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          </div>

          <div className="mb-10 grid grid-cols-7 gap-4">
            {weekDays.map((day, i) => {
              const ds = day.toISOString().split('T')[0];
              const isSelected = ds === selectedDateStr;
              return (
                <button
                  key={ds}
                  onClick={() => setSelectedDateStr(ds)}
                  className={`rounded-lg border p-4 text-center transition ${isSelected ? 'border-primary/25 bg-primary/10 ring-1 ring-primary/10' : i > 4 ? 'border-charcoal/[0.04] bg-beige-soft/35 text-charcoal/35' : 'border-charcoal/[0.06] bg-white/35 hover:bg-white/50'}`}
                >
                  <span className={`block text-xs ${isSelected ? 'text-sage-deep' : 'text-charcoal/38'}`}>{t.common.shortWeekDays[i]?.toLowerCase()}</span>
                  <span className={`mt-1 block font-display text-[22px] ${isSelected ? 'text-sage-deep' : 'text-charcoal'}`}>{day.getDate()}</span>
                  {weekEvents[i]?.events.length || weekEvents[i]?.tasks.length ? <span className="mx-auto mt-1 block size-1 rounded-full bg-primary"></span> : null}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-12 gap-8">
            <div className="col-span-8">
              <div className="relative space-y-8 pl-12">
                <div className="absolute bottom-0 left-[23px] top-0 w-px bg-charcoal/[0.08]"></div>
                {desktopTimelineItems.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-primary/25 bg-primary/5 p-8 text-sage-deep">
                    <p className="font-display text-xl">open day</p>
                    <p className="mt-1 text-sm opacity-70">nothing scheduled yet. add only what earns its place.</p>
                  </div>
                ) : (
                  desktopTimelineItems.map((item, index) => {
                    const isEvent = 'startTime' in item;
                    const time = isEvent ? (item as Event).startTime : ((item as Task).time || 'free');
                    return (
                      <button key={item.id} onClick={() => setSelectedItem(item)} className="group relative block w-full text-left">
                        <span className={`absolute -left-[30px] top-3 size-4 rounded-full border-4 border-cream ${index % 2 === 1 ? 'bg-[#C7D7CD]' : 'bg-[#DED5C6]'}`}></span>
                        <span className="absolute -left-[112px] top-2 w-20 text-right text-xs font-medium text-charcoal/36">{time}</span>
                        <div className={`${index % 2 === 1 ? 'border-dashed border-primary/25 bg-primary/5' : 'border-charcoal/[0.06] bg-white/55'} rounded-lg border p-5 transition group-hover:bg-white/75`}>
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h3 className="font-display text-xl text-charcoal">{item.title}</h3>
                              <p className="mt-1 text-sm text-charcoal/48">{isEvent ? ((item as Event).location || 'scheduled space') : `${(item as Task).category || 'task'} - small win`}</p>
                            </div>
                            <span className="rounded-full bg-[#F2F5F3] px-3 py-1 text-xs text-sage-deep">{isEvent ? 'event' : 'task'}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <aside className="col-span-4 space-y-6">
              <div className="overflow-hidden rounded-lg bg-charcoal p-8 text-cream">
                <h2 className="font-display text-[22px]">how are you arriving?</h2>
                <p className="mt-2 text-sm leading-relaxed text-cream/62">take a moment to check in with your breath before the next task.</p>
                <div className="mt-6 flex flex-wrap gap-3">
                  {['peaceful', 'scattered', 'tired'].map(mood => (
                    <button key={mood} className="rounded-full bg-white/8 px-4 py-2 text-xs text-cream/78 transition hover:bg-white/12">{mood}</button>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-charcoal/[0.06] bg-white/35 p-6">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="font-display text-xl text-charcoal">small wins</h2>
                  <span className="text-xs text-charcoal/38">{completedTodayTasks.length} done</span>
                </div>
                <div className="space-y-4">
                  {(tasks.slice(0, 4).length ? tasks.slice(0, 4) : [{ id: 'hydrate', title: 'hydrate with water', completed: false }, { id: 'stretch', title: 'stretch for 5 minutes', completed: false }] as Task[]).map(task => (
                    <label key={task.id} className="flex cursor-pointer items-center gap-3 text-sm text-charcoal/65">
                      <input readOnly checked={!!task.completed} type="checkbox" className="size-5 rounded-full border-charcoal/20 text-primary" />
                      <span className={task.completed ? 'text-charcoal/35 line-through' : ''}>{task.title}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-primary/10 bg-[#F2F5F3]/45 p-6">
                <span className="material-symbols-outlined mb-3 text-3xl text-primary/45">format_quote</span>
                <p className="font-display text-xl italic leading-relaxed text-charcoal/65">nature does not hurry, yet everything is accomplished.</p>
                <p className="mt-4 text-xs tracking-[0.22em] text-charcoal/32">LAO TZU</p>
              </div>
            </aside>
          </div>
        </section>
        <button onClick={() => setShowQuickAdd(true)} className="fixed bottom-10 right-10 flex size-16 items-center justify-center rounded-full bg-sage-deep text-cream shadow-lg transition hover:bg-[#4f6658] active:scale-95">
          <span className="material-symbols-outlined text-3xl">add</span>
        </button>
      </div>

      <div className="contents md:hidden">
      <header className="flex flex-col gap-4 shrink-0 pt-1">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
              <h1 className="hidden text-xl font-display text-charcoal capitalize">
                {viewMode === 'month' ? `${currentMonthName} ${currentYear}` : viewMode === 'week' ? `${weekDays[0].toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short' })} — ${weekDays[6].toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short' })}` : t.calendar.upcoming}
              </h1>
              {viewMode !== 'schedule' && (
                <div className="flex gap-1">
                  <button onClick={() => viewMode === 'month' ? changeMonth(-1) : changeWeek(-1)} className="size-8 flex items-center justify-center hover:bg-white/50 rounded-full"><span className="material-symbols-outlined text-charcoal/40">chevron_left</span></button>
                  <button onClick={() => viewMode === 'month' ? changeMonth(1) : changeWeek(1)} className="size-8 flex items-center justify-center hover:bg-white/50 rounded-full"><span className="material-symbols-outlined text-charcoal/40">chevron_right</span></button>
                </div>
              )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-full border border-charcoal/[0.06] bg-white/45 p-0.5">
              {['month', 'week', 'schedule'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode as ViewMode)}
                  className={`px-3 py-1.5 rounded-full text-[9px] transition-all ${viewMode === mode ? 'bg-primary/25 text-charcoal' : 'text-charcoal/35 hover:text-charcoal'}`}
                >
                  {t.calendar[mode === 'month' ? 'viewMonth' : mode === 'week' ? 'viewWeek' : 'viewSchedule']}
                </button>
              ))}
            </div>
            <button onClick={() => setShowQuickAdd(true)} className="size-9 bg-white/60 text-charcoal/60 rounded-full flex items-center justify-center transition hover:text-charcoal shadow-sm active:scale-90"><span className="material-symbols-outlined text-[20px]">add</span></button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 border-y border-charcoal/[0.04] py-3">
          {weekDays.map((day, i) => {
            const isToday = day.toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
            return (
              <button
                key={i}
                onClick={() => setSelectedDateStr(day.toISOString().split('T')[0])}
                className={`flex flex-col items-center gap-1 rounded-full py-2 text-center transition ${isToday ? 'bg-primary/20 text-[#55705c]' : 'text-charcoal/35 hover:bg-white/35'}`}
              >
                <span className="text-[8px]">{t.common.shortWeekDays[i]}</span>
                <span className="text-[11px]">{day.getDate()}</span>
              </button>
            );
          })}
        </div>
      </header>

      <div className="flex-1 overflow-hidden relative">
        {viewMode === 'week' ? (
          <div className="h-full flex flex-col bg-white/50 border border-charcoal/5 rounded-[2.5rem] shadow-sm overflow-hidden">
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
            <div className="flex-1 overflow-y-auto scrollbar-hide relative bg-white">
              <div className="flex min-h-[1920px]">
                <div className="w-16 shrink-0 border-r border-charcoal/5 bg-beige-soft/30 sticky left-0 z-10">
                  {Array.from({ length: 24 }).map((_, h) => (
                    <div key={h} className="h-20 border-b border-charcoal/[0.03] px-2 py-1 flex justify-end">
                      <span className="text-[10px] font-black text-charcoal/20">{h}:00</span>
                    </div>
                  ))}
                </div>
                <div className="flex-1 flex relative">
                  {weekStart <= new Date() && new Date() < new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000) && (
                    <div className="absolute left-0 right-0 z-30 pointer-events-none flex items-center" style={{ top: timeIndicatorTop }}>
                      <div className="size-2 bg-red-500 rounded-full -ml-1"></div>
                      <div className="h-[1px] flex-1 bg-red-500/50"></div>
                    </div>
                  )}
                  {weekEvents.map((dayData, i) => (
                    <div key={i} className="flex-1 relative border-r border-charcoal/[0.03] last:border-r-0 h-full group">
                      {Array.from({ length: 24 }).map((_, h) => (
                        <div key={h} className="h-20 border-b border-charcoal/[0.03]"></div>
                      ))}
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
                {t.common.weekDays.map(d => (<div key={d} className="text-[10px] font-black text-charcoal/20 uppercase tracking-widest">{d}</div>))}
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
          <div className="mx-auto h-full space-y-8 overflow-y-auto scrollbar-hide pb-8">
            {scheduleData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center opacity-25">
                <span className="material-symbols-outlined text-6xl mb-4">calendar_today</span>
                <p className="font-display text-sm italic">{t.calendar.noPlans}</p>
              </div>
            ) : (
              scheduleData.map(day => (
                <div key={day.dateStr} className="space-y-3">
                  <h3 className="font-display text-[16px] text-charcoal border-b border-charcoal/[0.04] pb-2 capitalize">
                    {new Date(day.dateStr).toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </h3>
                  {day.items.map(item => (
                    <div key={item.id} onClick={() => setSelectedItem(item)} className="stitch-card flex cursor-pointer items-center gap-4 rounded-2xl p-4 transition hover:bg-white/75">
                      <span className="w-14 text-[10px] text-[#55705c]">{'startTime' in item ? (item as Event).startTime : '--:--'}</span>
                      <h4 className="flex-1 truncate text-[13px] text-charcoal">{item.title}</h4>
                      <span className="material-symbols-outlined text-[18px] text-charcoal/12">chevron_right</span>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default CalendarView;
