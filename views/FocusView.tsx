
import React, { useState, useEffect, useMemo } from 'react';
import { Task, Event, Language } from '../types';
import { getT } from '../translations';

interface FocusViewProps {
  tasks: Task[];
  events: Event[];
  language: Language;
  onComplete: (id: string) => void;
}

type FocusTarget = {
  type: 'task' | 'event';
  id: string;
};

const FocusView: React.FC<FocusViewProps> = ({ tasks, events, language, onComplete }) => {
  const t = useMemo(() => getT(language), [language]);
  const [activeTarget, setActiveTarget] = useState<FocusTarget | null>(null);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [finished, setFinished] = useState(false);

  const selectedItem = useMemo(() => {
    if (!activeTarget) return null;
    if (activeTarget.type === 'task') return tasks.find(t => t.id === activeTarget.id);
    return events.find(e => e.id === activeTarget.id);
  }, [activeTarget, tasks, events]);

  useEffect(() => {
    let timer: number;
    if (isActive && timeLeft > 0) {
      timer = window.setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      setIsActive(false);
      setFinished(true);
    }
    return () => clearInterval(timer);
  }, [isActive, timeLeft]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progress = ((25 * 60 - timeLeft) / (25 * 60)) * 100;

  const handleFinish = () => {
    if (activeTarget && activeTarget.type === 'task') {
      onComplete(activeTarget.id);
    }
    resetSession();
  };

  const resetSession = () => {
    setActiveTarget(null);
    setTimeLeft(25 * 60);
    setIsActive(false);
    setFinished(false);
  };

  if (!activeTarget || !selectedItem) {
    const hasItems = tasks.length > 0 || events.length > 0;
    return (
      <div className="flex flex-col h-full items-center justify-center p-6 md:p-12">
        <div className="max-w-md w-full space-y-12">
          <header className="text-center space-y-2">
            <h1 className="text-3xl font-display font-black text-charcoal">{t.focus.title}</h1>
            <p className="text-charcoal/30 text-xs font-bold uppercase tracking-widest">{t.focus.selectObjective}</p>
          </header>

          {!hasItems ? (
            <div className="text-center py-12 opacity-20">
              <span className="material-symbols-outlined text-4xl mb-4">spa</span>
              <p className="text-sm font-medium">{t.focus.clearAgenda}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {[...events, ...tasks].map(item => {
                const isEv = 'startTime' in item;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTarget({ type: isEv ? 'event' : 'task', id: item.id });
                      setTimeLeft(25 * 60);
                    }}
                    className="w-full group flex items-center justify-between p-6 bg-white border border-charcoal/[0.03] rounded-[2rem] hover:shadow-xl hover:border-primary/20 transition-all duration-500"
                  >
                    <div className="flex items-center gap-4">
                      <span className="material-symbols-outlined text-charcoal/10 group-hover:text-primary transition-colors">
                        {isEv ? 'calendar_today' : 'radio_button_unchecked'}
                      </span>
                      <span className="text-sm font-bold text-charcoal truncate max-w-[200px]">{item.title}</span>
                    </div>
                    <span className="material-symbols-outlined text-charcoal/5 group-hover:text-charcoal/20 transition-all group-hover:translate-x-1">arrow_forward</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full items-center justify-between py-16 px-6 relative overflow-hidden">
      {finished && (
        <div className="absolute inset-0 z-50 bg-cream/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-700">
           <h2 className="text-4xl font-display font-black text-charcoal mb-4">{t.focus.intervalComplete}</h2>
           <p className="text-charcoal/40 mb-12 text-sm font-medium">{t.focus.takeBreath}</p>
           <div className="flex flex-col gap-3 w-full max-w-xs">
            {activeTarget.type === 'task' && (
              <button onClick={handleFinish} className="w-full py-5 bg-charcoal text-cream font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all">{t.focus.markFinished}</button>
            )}
            <button onClick={resetSession} className="w-full py-5 border border-charcoal/10 text-charcoal/40 font-black uppercase tracking-widest text-[10px] rounded-2xl hover:text-charcoal transition-all">{t.focus.continue}</button>
           </div>
        </div>
      )}

      <button onClick={resetSession} className="absolute top-12 left-12 p-3 text-charcoal/10 hover:text-charcoal transition-all">
        <span className="material-symbols-outlined text-2xl">close</span>
      </button>

      <div className="w-full max-w-[240px] mt-8">
        <div className="w-full h-[2px] bg-charcoal/[0.03] rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all duration-1000" style={{ width: `${progress}%` }}></div>
        </div>
      </div>

      <main className="flex flex-col items-center text-center space-y-12">
        <div className="space-y-4">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/40">{t.focus.currentIntention}</p>
          <h1 className="text-2xl font-display font-bold text-charcoal max-w-xs leading-snug tracking-tight">
            {selectedItem.title}
          </h1>
        </div>

        <div 
          onClick={() => setIsActive(!isActive)}
          className={`text-[120px] font-display font-extralight tracking-tighter cursor-pointer transition-all duration-700 select-none ${isActive ? 'text-charcoal drop-shadow-2xl' : 'text-charcoal/10 scale-95'}`}
        >
          {formatTime(timeLeft)}
        </div>
      </main>

      <footer className="w-full max-w-xs space-y-6">
        <button 
          onClick={() => setIsActive(!isActive)}
          className={`w-full py-6 rounded-[2rem] font-black uppercase tracking-[0.3em] text-[10px] transition-all duration-500 ${
            isActive 
              ? 'bg-charcoal text-cream shadow-2xl scale-105' 
              : 'bg-white border border-charcoal/5 text-charcoal shadow-sm hover:shadow-lg'
          }`}
        >
          {isActive ? t.focus.pause : t.focus.commence}
        </button>
      </footer>
    </div>
  );
};

export default FocusView;
