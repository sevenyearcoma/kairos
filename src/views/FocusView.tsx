import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '@nanostores/react';
import { isItemOnDate } from '../utils/dateUtils';
import { getT } from '../translations';
import { $tasks, $events, $language, editTask, getLocalDateStr } from '../stores/app';

type FocusTarget = { type: 'task' | 'event'; id: string };
type Duration = 15 | 25 | 0; // 0 = open-ended

const FocusView: React.FC = () => {
  const allTasks = useStore($tasks);
  const allEvents = useStore($events);
  const language = useStore($language);
  const t = useMemo(() => getT(language), [language]);

  const TODAY = useMemo(() => getLocalDateStr(), []);
  const tasks = useMemo(
    () => allTasks.filter(task => !task.completed && isItemOnDate(task, TODAY)),
    [allTasks, TODAY]
  );
  const events = useMemo(
    () => allEvents.filter(e => isItemOnDate(e, TODAY)),
    [allEvents, TODAY]
  );

  const [activeTarget, setActiveTarget] = useState<FocusTarget | null>(null);
  const [duration, setDuration] = useState<Duration>(25);
  const [elapsed, setElapsed] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [finished, setFinished] = useState(false);
  const [hideTimer, setHideTimer] = useState(false);

  const selectedItem = useMemo(() => {
    if (!activeTarget) return null;
    if (activeTarget.type === 'task') return tasks.find(task => task.id === activeTarget.id);
    return events.find(e => e.id === activeTarget.id);
  }, [activeTarget, tasks, events]);

  useEffect(() => {
    let timer: number;
    if (isActive) {
      timer = window.setInterval(() => {
        setElapsed(prev => {
          const next = prev + 1;
          if (duration > 0 && next >= duration * 60) {
            setIsActive(false);
            setFinished(true);
            return duration * 60;
          }
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isActive, duration]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const displayTime = duration > 0
    ? formatTime(Math.max(0, duration * 60 - elapsed))
    : formatTime(elapsed);

  const progress = duration > 0 ? (elapsed / (duration * 60)) * 100 : 0;

  const resetSession = () => {
    setActiveTarget(null);
    setElapsed(0);
    setIsActive(false);
    setFinished(false);
    setHideTimer(false);
  };

  const handleTouched = () => {
    if (activeTarget && activeTarget.type === 'task') {
      editTask(activeTarget.id, { touched: true });
    }
    resetSession();
  };

  const handleDone = () => {
    if (activeTarget && activeTarget.type === 'task') {
      editTask(activeTarget.id, { completed: true });
    }
    resetSession();
  };

  const focusChoices = [...events, ...tasks];
  const hasItems = focusChoices.length > 0;

  if (!activeTarget || !selectedItem) {
    return (
      <div className="h-full overflow-hidden">
        <section className="hidden h-full items-center justify-center md:flex">
          <div className="w-full max-w-4xl text-center">
            <p className="mb-4 text-xs tracking-[0.28em] text-charcoal/35">CURRENT INTENTION</p>
            <h1 className="mx-auto max-w-3xl font-display text-[44px] italic leading-tight text-charcoal">
              choose one thing to begin softly
            </h1>

            <div className="mx-auto mt-12 flex max-w-sm gap-2">
              {([15, 25, 0] as Duration[]).map(d => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`flex-1 rounded-full py-3 text-xs transition ${duration === d ? 'bg-primary/18 text-charcoal' : 'bg-white/35 text-charcoal/42 hover:bg-white/50'}`}
                >
                  {d === 0 ? t.focus.openEnded : `${d}m`}
                </button>
              ))}
            </div>

            <div className="mx-auto mt-12 grid max-w-3xl grid-cols-2 gap-4 text-left">
              {!hasItems ? (
                <div className="col-span-2 rounded-lg border border-dashed border-primary/25 bg-primary/5 p-8 text-center text-sage-deep">
                  <span className="material-symbols-outlined mb-3 text-4xl">spa</span>
                  <p className="font-display text-xl">{t.focus.clearAgenda}</p>
                </div>
              ) : (
                focusChoices.map(item => {
                  const isEv = 'startTime' in item;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTarget({ type: isEv ? 'event' : 'task', id: item.id });
                        setElapsed(0);
                      }}
                      className="group rounded-lg border border-charcoal/[0.06] bg-white/42 p-5 transition hover:bg-white/62"
                    >
                      <div className="mb-6 flex items-center justify-between text-charcoal/35">
                        <span className="material-symbols-outlined">{isEv ? 'calendar_today' : 'radio_button_unchecked'}</span>
                        <span className="material-symbols-outlined transition group-hover:translate-x-1">arrow_forward</span>
                      </div>
                      <h2 className="font-display text-xl text-charcoal">{item.title}</h2>
                      <p className="mt-2 text-sm text-charcoal/42">{isEv ? 'scheduled focus' : 'small focused step'}</p>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </section>

        <div className="flex h-full flex-col items-center justify-center p-6 md:hidden">
        <div className="max-w-md w-full space-y-10">
          <header className="text-center space-y-2">
            <h1 className="font-display text-[28px] text-charcoal">{t.focus.title}</h1>
            <p className="font-display text-charcoal/42 text-sm italic">{t.focus.bodyDoubleTagline}</p>
          </header>

          <div className="space-y-3">
            <p className="text-[9px] uppercase tracking-widest text-charcoal/30 text-center">{t.focus.duration}</p>
            <div className="flex gap-2">
              {([15, 25, 0] as Duration[]).map(d => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`flex-1 py-2.5 rounded-full text-xs transition-all ${duration === d ? 'bg-primary/25 text-charcoal' : 'bg-white/45 text-charcoal/45'}`}
                >
                  {d === 0 ? t.focus.openEnded : `${d}m`}
                </button>
              ))}
            </div>
          </div>

          {!hasItems ? (
            <div className="text-center py-12 opacity-20">
              <span className="material-symbols-outlined text-4xl mb-4">spa</span>
              <p className="text-sm font-medium">{t.focus.clearAgenda}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[9px] uppercase tracking-widest text-charcoal/30 text-center">{t.focus.pickOne}</p>
              {[...events, ...tasks].map(item => {
                const isEv = 'startTime' in item;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTarget({ type: isEv ? 'event' : 'task', id: item.id });
                      setElapsed(0);
                    }}
                    className="stitch-card w-full group flex items-center justify-between p-4 rounded-2xl hover:border-primary/20 transition-all duration-300"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <span className="material-symbols-outlined text-charcoal/10 group-hover:text-primary transition-colors">
                        {isEv ? 'calendar_today' : 'radio_button_unchecked'}
                      </span>
                      <span className="text-sm font-bold text-charcoal truncate">{item.title}</span>
                    </div>
                    <span className="material-symbols-outlined text-charcoal/5 group-hover:text-charcoal/20 transition-all group-hover:translate-x-1">arrow_forward</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col items-center justify-between overflow-hidden px-4 py-9 md:block md:px-0 md:py-0">
      {finished && (
        <div className="absolute inset-0 z-50 bg-cream/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-700">
          <span className="material-symbols-outlined text-5xl text-primary/60 mb-4">spa</span>
          <h2 className="font-display text-3xl italic text-charcoal mb-3">{t.focus.timeUp}</h2>
          <p className="text-charcoal/50 mb-10 text-sm max-w-xs">{t.focus.timeUpSub}</p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            {activeTarget.type === 'task' && (
              <>
                <button onClick={handleDone} className="w-full py-3.5 bg-primary/25 text-charcoal text-[12px] rounded-full transition hover:bg-primary/35">{t.focus.markDone}</button>
                <button onClick={handleTouched} className="stitch-card w-full py-3.5 text-charcoal/70 text-[12px] rounded-full transition hover:text-charcoal">{t.focus.markTouched}</button>
              </>
            )}
            <button onClick={resetSession} className="w-full py-3 text-charcoal/45 text-[12px] italic font-display hover:text-charcoal transition-all">{t.focus.stopHere}</button>
          </div>
        </div>
      )}

      <section className="hidden h-full items-center justify-center md:flex">
        <button onClick={resetSession} className="absolute left-0 top-0 p-3 text-charcoal/35 transition hover:text-charcoal">
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
        <div className="absolute right-0 top-1 flex items-center gap-2 text-charcoal/30">
          <span className="size-2 rounded-full bg-primary animate-pulse-gentle"></span>
          <span className="font-display text-[11px] italic">{t.focus.together}</span>
        </div>

        <div className="relative z-10 w-full max-w-5xl text-center">
          <div className="mb-16 space-y-4">
            <p className="text-xs tracking-[0.28em] text-charcoal/35">CURRENT INTENTION</p>
            <h1 className="mx-auto max-w-4xl font-display text-[40px] italic leading-tight text-charcoal">{selectedItem.title}</h1>
          </div>

          <button onClick={() => setIsActive(!isActive)} className="relative mx-auto flex size-[480px] items-center justify-center rounded-full outline-none">
            <div className={`absolute inset-0 rounded-full bg-sage-deep/5 blur-3xl transition ${isActive ? 'scale-105 opacity-100' : 'scale-95 opacity-70'}`}></div>
            <div className={`relative flex size-[420px] flex-col items-center justify-center rounded-full border border-charcoal/[0.06] bg-cream/80 shadow-sm transition ${isActive ? 'animate-breathe-slow' : ''}`}>
              {duration > 0 && !hideTimer && (
                <svg className="pointer-events-none absolute inset-0 size-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" fill="none" r="48" stroke="#7A9B86" strokeDasharray="301.59" strokeDashoffset={301.59 - (progress / 100) * 301.59} strokeWidth="0.6" opacity="0.34"></circle>
                </svg>
              )}
              {hideTimer ? (
                <span className="material-symbols-outlined text-[72px] text-charcoal/26">{isActive ? 'pause' : 'play_arrow'}</span>
              ) : (
                <>
                  <span className="font-display text-[110px] font-light leading-none text-charcoal">{displayTime}</span>
                  <span className="mt-3 text-sm text-charcoal/40">{duration > 0 ? 'minutes remaining' : 'open focus'}</span>
                </>
              )}
            </div>
          </button>

          <div className="mt-16 flex items-center justify-center gap-12">
            <button onClick={() => setIsActive(!isActive)} className="group flex flex-col items-center gap-2">
              <span className="flex size-14 items-center justify-center rounded-full bg-beige-soft text-charcoal/56 transition group-hover:bg-[#E6EEE9] group-hover:text-sage-deep">
                <span className="material-symbols-outlined">{isActive ? 'pause' : 'play_arrow'}</span>
              </span>
              <span className="text-xs text-charcoal/40">{isActive ? t.focus.pause : t.focus.commence}</span>
            </button>
            <button onClick={() => setHideTimer(!hideTimer)} className="group flex flex-col items-center gap-2">
              <span className="flex size-14 items-center justify-center rounded-full bg-beige-soft text-charcoal/56 transition group-hover:bg-[#E6EEE9] group-hover:text-sage-deep">
                <span className="material-symbols-outlined">{hideTimer ? 'visibility' : 'visibility_off'}</span>
              </span>
              <span className="text-xs text-charcoal/40">{hideTimer ? t.focus.showTimer : t.focus.hideTimer}</span>
            </button>
            {activeTarget.type === 'task' && (
              <button onClick={handleTouched} className="group flex flex-col items-center gap-2">
                <span className="flex size-14 items-center justify-center rounded-full border border-charcoal/[0.06] bg-beige-soft text-charcoal/56 transition group-hover:bg-[#C87C5E]/10 group-hover:text-[#C87C5E]">
                  <span className="material-symbols-outlined">pan_tool_alt</span>
                </span>
                <span className="text-xs text-charcoal/40">{t.focus.markTouched}</span>
              </button>
            )}
          </div>

          <p className="mx-auto mt-20 max-w-sm font-display text-lg italic leading-relaxed text-charcoal/40">
            "The secret of getting ahead is getting started."
          </p>
        </div>

        <div className="pointer-events-none absolute inset-0 -z-10 opacity-35 [background-image:radial-gradient(var(--color-muted-ink)_0.5px,transparent_0.5px)] [background-size:40px_40px]"></div>
      </section>

      <button onClick={resetSession} className="absolute top-4 left-1 p-3 text-charcoal/35 hover:text-charcoal transition-all md:hidden">
        <span className="material-symbols-outlined text-[18px]">close</span>
      </button>

      {/* Body-double presence indicator — soft breathing dot, always present */}
      <div className="absolute top-6 right-1 flex items-center gap-2 text-charcoal/30 md:hidden">
        <span className="size-2 rounded-full bg-primary animate-pulse-gentle"></span>
        <span className="font-display text-[11px] italic">{t.focus.together}</span>
      </div>

      <main className="flex flex-col items-center text-center space-y-9 md:hidden">
        {duration > 0 && !hideTimer && (
          <div className="w-full max-w-[150px]">
            <div className="w-full h-[2px] bg-charcoal/[0.05] rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all duration-1000" style={{ width: `${progress}%` }}></div>
            </div>
          </div>
        )}
        {(duration === 0 || hideTimer) && <div />}

        <div className="space-y-3">
          <p className="font-display text-[12px] italic text-charcoal/45">{t.focus.currentIntention}</p>
          <h1 className="text-[20px] font-display text-charcoal max-w-xs leading-snug">
            {selectedItem.title}
          </h1>
        </div>

        {/* Breathing circle — always visible, slower when idle, steady when active */}
        <div
          onClick={() => setIsActive(!isActive)}
          className="relative cursor-pointer select-none"
        >
          <div
            className={`size-64 rounded-full bg-primary/10 transition-all ${
              isActive ? 'animate-breathe-slow' : 'scale-90 opacity-60'
            }`}
          ></div>
          <div className="absolute inset-0 flex items-center justify-center">
            {hideTimer ? (
              <span className="material-symbols-outlined text-5xl text-charcoal/30">
                {isActive ? 'pause' : 'play_arrow'}
              </span>
            ) : (
              <span className={`text-[38px] font-display font-normal transition-all ${isActive ? 'text-charcoal' : 'text-charcoal/35'}`}>
                {displayTime}
              </span>
            )}
          </div>
        </div>
      </main>

      <footer className="w-full max-w-xs space-y-3 md:hidden">
        <div className="mb-5 hidden md:block">
          <p className="text-[9px] uppercase tracking-[0.22em] text-charcoal/30">{t.focus.pickOne}</p>
          <p className="mt-2 font-display text-[18px] italic text-charcoal">body double</p>
        </div>
        <button
          onClick={() => setIsActive(!isActive)}
          className={`mx-auto block w-28 py-3 rounded-full text-[11px] transition-all duration-500 ${
            isActive
              ? 'bg-primary/30 text-charcoal shadow-sm'
              : 'stitch-card text-charcoal/70'
          }`}
        >
          {isActive ? t.focus.pause : t.focus.commence}
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => setHideTimer(!hideTimer)}
            className="flex-1 py-3 rounded-xl text-[10px] text-charcoal/45 hover:text-charcoal transition-all"
          >
            <span className="material-symbols-outlined text-sm align-middle mr-1">
              {hideTimer ? 'visibility' : 'visibility_off'}
            </span>
            {hideTimer ? t.focus.showTimer : t.focus.hideTimer}
          </button>
          {activeTarget.type === 'task' && (
            <button
              onClick={handleTouched}
              className="flex-1 py-3 rounded-xl text-[10px] text-charcoal/45 hover:text-charcoal transition-all"
            >
              <span className="material-symbols-outlined text-sm align-middle mr-1">radio_button_checked</span>
              {t.focus.markTouched}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
};

export default FocusView;
