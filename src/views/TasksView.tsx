import React, { useState, useMemo } from 'react';
import { useStore } from '@nanostores/react';
import { GoogleGenAI, Type } from '@google/genai';
import type { Task, Event, EnergyLevel, TaskBucket } from '../types';
import ItemDetailModal from '../components/ItemDetailModal';
import { getT } from '../translations';
import { isItemOnDate } from '../utils/dateUtils';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { $tasks, $events, $language, $energy, $prefs, addTask, addEvent, deleteTask, editTask, getLocalDateStr } from '../stores/app';

const ENERGY_FRESHNESS_MS = 1000 * 60 * 60 * 4; // 4 hours

const TasksView: React.FC = () => {
  const tasks = useStore($tasks);
  const events = useStore($events);
  const language = useStore($language);
  const energy = useStore($energy);
  const prefs = useStore($prefs);

  const t = useMemo(() => getT(language), [language]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [isAiProcessing, setIsAiProcessing] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<Task | Event | null>(null);
  const [startInEditMode, setStartInEditMode] = useState(false);
  const [showLater, setShowLater] = useState(false);
  const [dayDone, setDayDone] = useState(false);
  const [affirmation, setAffirmation] = useState<string | null>(null);

  const affirmations = t.tasks.feedback.warm;
  const showAffirmation = () => {
    const pick = affirmations[Math.floor(Math.random() * affirmations.length)];
    setAffirmation(pick);
    window.setTimeout(() => setAffirmation(null), 2800);
  };

  const { isListening, toggleListening } = useVoiceInput({
    onTranscript: setNewTaskTitle,
  });

  const energyFresh = energy.level && (Date.now() - energy.setAt < ENERGY_FRESHNESS_MS);
  const currentEnergy = energyFresh ? energy.level : null;

  const setEnergy = (level: EnergyLevel) => {
    $energy.set({ level, setAt: Date.now() });
  };

  // Filter tasks that haven't been completed
  const activeTasks = useMemo(() => tasks.filter(t => !t.completed), [tasks]);

  const todayTasks = useMemo(() => activeTasks.filter(t => (t.bucket || 'today') === 'today'), [activeTasks]);
  const laterTasks = useMemo(() => activeTasks.filter(t => t.bucket === 'later'), [activeTasks]);

  // If energy is set, gently sort Today so matching-energy tasks surface first
  const sortedTodayTasks = useMemo(() => {
    if (!currentEnergy) return todayTasks;
    const score = (task: Task) => {
      if (!task.energy) return 1;
      if (task.energy === currentEnergy) return 0;
      // allow adjacent: low<->ok<->sharp
      const order: EnergyLevel[] = ['low', 'ok', 'sharp'];
      const diff = Math.abs(order.indexOf(task.energy) - order.indexOf(currentEnergy));
      return diff;
    };
    return [...todayTasks].sort((a, b) => score(a) - score(b));
  }, [todayTasks, currentEnergy]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const resp = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: `A user with ADHD/CPTSD is adding a task: "${newTaskTitle}". Gently classify. Return JSON with: bucket ("today" if it seems urgent-ish or already on their mind, "later" otherwise — default "today"), energy ("low" for rest/admin, "ok" for normal tasks, "sharp" for deep work), category (Work|Personal|Meeting|Finance).`,
        config: { responseMimeType: "application/json" }
      });
      const res = JSON.parse(resp.text || "{}");
      const bucket: TaskBucket = res.bucket === 'later' ? 'later' : 'today';
      addTask(newTaskTitle, res.category || 'Personal', '', undefined, 'none', undefined, bucket, res.energy);
      setNewTaskTitle('');
      setShowInput(false);
    } catch {
      addTask(newTaskTitle, 'Personal', '', undefined, 'none', undefined, 'today');
      setNewTaskTitle('');
      setShowInput(false);
    } finally { setIsAnalyzing(false); }
  };

  const handleShrink = async (task: Task) => {
    setIsAiProcessing(task.id);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const resp = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: `Break this task into 2-4 tiny, concrete steps a person with ADHD could start in under 2 minutes each. Task: "${task.title}". Return JSON: { "steps": ["step 1", "step 2", ...] }. Keep each step short, action-first, no filler.`,
        config: { responseMimeType: "application/json" }
      });
      const res = JSON.parse(resp.text || "{}");
      if (Array.isArray(res.steps) && res.steps.length) {
        const description = (task.description ? task.description + '\n\n' : '') + res.steps.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n');
        editTask(task.id, { description });
      }
    } catch { /* silent — soft failure */ } finally { setIsAiProcessing(null); }
  };

  const handleAutoSchedule = async (task: Task) => {
    setIsAiProcessing(task.id);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const localToday = getLocalDateStr();
      const contextEvents = events.filter(e => isItemOnDate(e, localToday)).map(e => ({ title: e.title, start: e.startTime, end: e.endTime }));

      const prompt = `
        Role: Scheduler. Find gentle 1-hour slot on ${localToday}.
        Item: "${task.title}" (${task.category}${task.energy ? `, energy: ${task.energy}` : ''}).
        Existing Schedule (NO OVERLAPS): ${JSON.stringify(contextEvents)}
        Constraints: 09:00 to 21:00. Prefer times that match energy level.
        Return JSON: { "date": "YYYY-MM-DD", "startTime": "HH:MM", "endTime": "HH:MM", "reason": "why" }
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: { date: { type: Type.STRING }, startTime: { type: Type.STRING }, endTime: { type: Type.STRING }, reason: { type: Type.STRING } },
            required: ["date", "startTime", "endTime"]
          }
        }
      });
      const result = JSON.parse(response.text || "{}");
      if (result.date && result.startTime) {
        addEvent({ title: task.title, description: task.description, date: result.date, startTime: result.startTime, endTime: result.endTime });
        deleteTask(task.id);
      }
    } catch (e) { /* silent */ } finally { setIsAiProcessing(null); }
  };

  const energyDot = (level?: EnergyLevel) => {
    if (!level) return null;
    const colors = { low: 'bg-blue-300', ok: 'bg-green-300', sharp: 'bg-amber-300' };
    return <span className={`inline-block size-2 rounded-full ${colors[level]}`} />;
  };

  const renderTaskCard = (task: Task) => {
    const expanded = expandedTaskId === task.id;
    const touched = task.touched;
    return (
      <div
        key={task.id}
        onClick={() => setExpandedTaskId(expanded ? null : task.id)}
        className={`stitch-card p-4 rounded-2xl transition-all cursor-pointer ${expanded ? 'shadow-lg' : ''} ${touched ? 'border-primary/40' : ''}`}
      >
        <div className="flex justify-between items-center gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {energyDot(task.energy)}
            <span className="text-[13px] truncate">{task.title}</span>
          </div>
          {touched && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[8px] uppercase tracking-wider text-primary opacity-80">{t.tasks.touched}</span>}
        </div>
        {task.description && expanded && (
          <pre className="mt-3 text-xs text-charcoal/60 whitespace-pre-wrap font-sans">{task.description}</pre>
        )}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-charcoal/[0.05] flex flex-wrap justify-end gap-2">
            <button onClick={(e) => { e.stopPropagation(); editTask(task.id, { touched: !task.touched }); }} className="h-8 px-3 rounded-full bg-charcoal/[0.04] text-[9px] uppercase flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">{task.touched ? 'radio_button_checked' : 'radio_button_unchecked'}</span>
              {t.tasks.markTouched}
            </button>
            <button onClick={(e) => { e.stopPropagation(); editTask(task.id, { completed: true }); showAffirmation(); }} className="h-8 px-3 rounded-full bg-primary/35 text-charcoal text-[9px] uppercase flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">check</span>
              {t.tasks.done}
            </button>
            <button onClick={(e) => { e.stopPropagation(); handleShrink(task); }} disabled={isAiProcessing === task.id} className="h-8 px-3 rounded-full bg-charcoal/[0.04] text-[9px] uppercase flex items-center gap-1">
              <span className={`material-symbols-outlined text-sm ${isAiProcessing === task.id ? 'animate-spin' : ''}`}>auto_awesome</span>
              {t.tasks.shrink}
            </button>
            <button onClick={(e) => { e.stopPropagation(); editTask(task.id, { bucket: task.bucket === 'later' ? 'today' : 'later' }); }} className="h-8 px-3 rounded-full bg-charcoal/[0.04] text-[9px] uppercase flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">schedule</span>
              {task.bucket === 'later' ? t.tasks.moveToToday : t.tasks.notToday}
            </button>
            <button onClick={(e) => { e.stopPropagation(); handleAutoSchedule(task); }} disabled={isAiProcessing === task.id} className="h-8 px-3 rounded-full bg-charcoal/[0.04] text-[9px] uppercase flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">event</span>
              {t.tasks.schedule}
            </button>
            <button onClick={(e) => { e.stopPropagation(); setStartInEditMode(true); setSelectedItem(task); }} className="size-8 rounded-full bg-charcoal/[0.04] flex items-center justify-center">
              <span className="material-symbols-outlined text-sm">edit</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  const energyLabels: Record<EnergyLevel, string> = {
    low: t.tasks.energy.low,
    ok: t.tasks.energy.ok,
    sharp: t.tasks.energy.sharp,
  };

  if (dayDone) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-6 px-6 text-center">
        <span className="material-symbols-outlined text-6xl text-primary/60">nights_stay</span>
        <h2 className="text-2xl font-display font-extrabold tracking-tight">{t.tasks.doneForToday}</h2>
        <p className="text-sm text-charcoal/50 max-w-xs">{t.tasks.doneForTodaySub}</p>
        <button onClick={() => setDayDone(false)} className="mt-4 px-5 py-2 rounded-xl bg-charcoal/5 text-[10px] font-black uppercase tracking-widest">{t.tasks.comeBack}</button>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col space-y-5 px-1 md:grid md:grid-rows-[auto_1fr] md:gap-6 md:space-y-0">
      {affirmation && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[200] px-6 py-4 bg-white/95 backdrop-blur-xl border border-primary/30 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-top-2 duration-500 max-w-sm">
          <p className="text-sm font-bold text-charcoal text-center">{affirmation}</p>
        </div>
      )}
      <ItemDetailModal
        item={selectedItem}
        onClose={() => { setSelectedItem(null); setStartInEditMode(false); }}
        onEdit={(id, updates) => {
          if (selectedItem && 'startTime' in selectedItem) {
            // event edit — not used in tasks view
          } else {
            editTask(id, updates);
          }
        }}
        onDelete={deleteTask}
        language={language}
        initialEditMode={startInEditMode}
      />

      <div className="hidden h-full overflow-y-auto pb-10 pr-3 scrollbar-hide md:block">
        <section className="mx-auto max-w-5xl py-6">
          <div className="mb-16">
            <h1 className="font-display text-[42px] font-normal leading-tight text-charcoal">hello, {prefs.userName.toLowerCase()}.</h1>
            <p className="mt-3 font-display text-[22px] italic text-muted-ink">how does your world feel today?</p>
          </div>

          <div className="grid grid-cols-12 gap-8">
            <div className="col-span-7 rounded-xl border border-paper-edge/70 stitch-card p-8">
              <div className="mb-8 flex items-center gap-3">
                <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>eco</span>
                <h2 className="font-display text-[24px]">morning pulse</h2>
              </div>
              <p className="mb-4 text-sm text-muted-ink">energy level</p>
              <div className="mb-9 grid grid-cols-3 gap-4">
                {(['low', 'ok', 'sharp'] as EnergyLevel[]).map(lv => {
                  const active = currentEnergy === lv || (!currentEnergy && lv === 'ok');
                  return (
                    <button
                      key={lv}
                      onClick={() => setEnergy(lv)}
                      className={`rounded-lg px-4 py-4 text-sm transition duration-500 ${active ? 'bg-primary text-white' : 'bg-beige-soft/70 text-muted-ink hover:bg-primary/10 hover:text-sage-deep'}`}
                    >
                      {lv === 'ok' ? 'steady' : lv === 'sharp' ? 'high' : 'low'}
                    </button>
                  );
                })}
              </div>
              <p className="mb-4 text-sm text-muted-ink">{currentEnergy ? t.tasks.energy.feeling(energyLabels[currentEnergy]) : t.tasks.energy.prompt}</p>
            </div>

            <div className="relative col-span-5 min-h-[300px] overflow-hidden rounded-xl border border-paper-edge/70 bg-[#2C3834]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_45%_35%,rgba(234,227,214,0.55),transparent_18%),linear-gradient(140deg,#315259,#778A7E_45%,#1D2A2A)]" />
              <div className="absolute inset-x-0 bottom-0 p-8 text-white">
                <p className="font-display text-[22px] italic leading-relaxed">"nature does not hurry, yet everything is accomplished."</p>
                <p className="mt-5 text-xs tracking-[0.04em] opacity-80">lao tzu</p>
              </div>
            </div>

            <div className="col-span-12 mt-6">
              <div className="mb-8 flex items-end justify-between">
                <div>
                  <h2 className="font-display text-[28px] font-normal">your intentions</h2>
                  <p className="mt-1 text-sm text-muted-ink">{tasks.filter(task => task.completed).length} of {tasks.length} finished for today</p>
                </div>
                <button onClick={() => setShowInput(v => !v)} className="flex items-center gap-2 text-sm text-sage-deep">
                  <span className="material-symbols-outlined text-[18px]">{showInput ? 'close' : 'add_circle'}</span>
                  {showInput ? 'close' : 'new intention'}
                </button>
              </div>

              {showInput && (
                <form onSubmit={(e) => { handleAdd(e); setShowInput(false); }} className="mb-6 stitch-card rounded-2xl p-6 animate-in slide-in-from-top-4">
                  <div className="relative mb-4">
                    <input autoFocus className="w-full border-none bg-transparent pr-12 text-[18px] focus:ring-0" placeholder={isListening ? t.chat.listening : t.tasks.placeholder} value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} readOnly={isListening} />
                    <button type="button" onClick={() => toggleListening(newTaskTitle)} className={`absolute right-0 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full ${isListening ? 'bg-[#c8695e] text-white' : 'text-muted-ink hover:text-sage-deep'}`}>
                      <span className="material-symbols-outlined">{isListening ? 'stop' : 'mic'}</span>
                    </button>
                  </div>
                  <button type="submit" disabled={!newTaskTitle.trim() || isAnalyzing} className="w-full rounded-full bg-primary/25 py-3 text-sm text-charcoal transition hover:bg-primary/35 disabled:opacity-30">
                    {isAnalyzing ? t.tasks.analyzing : t.tasks.accept}
                  </button>
                </form>
              )}

              <div className="space-y-4">
                {sortedTodayTasks.length === 0 ? (
                  <div className="text-center py-12 text-charcoal/35">
                    <p className="text-sm">{t.tasks.nothingToday}</p>
                    <p className="mt-2 text-xs italic text-muted-ink">{t.tasks.nothingTodaySub}</p>
                  </div>
                ) : sortedTodayTasks.map(task => (
                  <div
                    key={task.id}
                    onClick={() => setSelectedItem(task)}
                    className="group flex items-center gap-6 rounded-xl border border-paper-edge/45 stitch-card p-6 transition duration-500 hover:border-primary/25 cursor-pointer"
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); editTask(task.id, { completed: true }); showAffirmation(); }}
                      title={t.tasks.done}
                      className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-paper-edge hover:border-primary hover:bg-primary/20 transition"
                    >
                      {task.touched && <span className="material-symbols-outlined text-[14px] text-primary">done</span>}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="truncate text-[17px] font-medium text-charcoal">{task.title}</h3>
                        {task.energy && <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-sage-deep">{energyLabels[task.energy]}</span>}
                        {task.touched && <span className="text-[10px] text-primary/70">· {t.tasks.touched}</span>}
                      </div>
                      {task.description && <p className="mt-1 text-xs italic text-muted-ink line-clamp-1">{task.description}</p>}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleShrink(task); }}
                      disabled={isAiProcessing === task.id}
                      title={t.tasks.shrink}
                      className="opacity-0 group-hover:opacity-100 transition size-9 rounded-full bg-primary/10 text-sage-deep hover:bg-primary/20 flex items-center justify-center"
                    >
                      <span className={`material-symbols-outlined text-[18px] ${isAiProcessing === task.id ? 'animate-spin' : ''}`}>auto_awesome</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {laterTasks.length > 0 && (
              <div className="col-span-12 mt-8 rounded-xl border border-primary/15 bg-primary/5 p-8">
                <div className="flex items-center gap-6">
                  <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <span className="material-symbols-outlined text-[32px]">schedule</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-display text-xl text-sage-deep">{t.tasks.later}</h3>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-sage-deep/70">
                      {laterTasks.length} parked {laterTasks.length === 1 ? 'item' : 'items'} · surface when you're ready.
                    </p>
                  </div>
                  <button onClick={() => setShowLater(!showLater)} className="rounded-full bg-primary/20 px-7 py-3 text-sm text-sage-deep hover:bg-primary/30 transition flex items-center gap-1">
                    <span className="material-symbols-outlined text-[18px]">{showLater ? 'expand_less' : 'expand_more'}</span>
                    {showLater ? 'hide' : 'view'}
                  </button>
                </div>
                {showLater && (
                  <div className="mt-6 space-y-2">
                    {laterTasks.map(task => (
                      <div key={task.id} onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)} className="stitch-card flex items-center gap-3 rounded-lg p-4 cursor-pointer hover:border-primary/25 transition">
                        {energyDot(task.energy)}
                        <span className="flex-1 text-sm text-charcoal/80 truncate">{task.title}</span>
                        <button onClick={(e) => { e.stopPropagation(); editTask(task.id, { bucket: 'today' }); }} className="text-[11px] text-sage-deep hover:underline">
                          {t.tasks.moveToToday}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="contents md:hidden">
      <header className="flex shrink-0 items-start justify-between gap-4 pt-1 md:row-start-1">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-[22px] leading-tight text-charcoal">hello, {prefs.userName.toLowerCase()}</h1>
          <p className="text-[12px] text-charcoal/48">one thing at a time</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowInput(!showInput)} className="flex size-10 items-center justify-center rounded-full bg-white/60 text-charcoal/55 shadow-sm transition hover:text-charcoal">
            <span className="material-symbols-outlined text-[20px]">{showInput ? 'close' : 'add'}</span>
          </button>
        </div>
      </header>

      {/* Energy check-in */}
      <div className="md:row-start-2 md:grid md:min-h-0 md:grid-cols-[minmax(0,1fr)_300px] md:gap-6">
        <aside className="order-2 mt-5 space-y-4 md:col-start-2 md:row-start-1 md:mt-0">
          <div className="stitch-card rounded-2xl p-4 md:p-5">
            <p className="mb-3 text-center text-[12px] text-charcoal/55">
              {currentEnergy ? t.tasks.energy.feeling(energyLabels[currentEnergy]) : t.tasks.energy.prompt}
            </p>
            <div className="flex gap-2 md:flex-col">
              {(['low', 'ok', 'sharp'] as EnergyLevel[]).map(lv => {
                const active = currentEnergy === lv;
                const color = lv === 'low' ? 'border-[#d6d2cd] stitch-card text-charcoal/55' : lv === 'ok' ? 'border-primary/30 bg-primary/10 text-[#57715e]' : 'border-[#dcc8bb] bg-[#f7ede5] text-[#b36f5f]';
                return (
                  <button
                    key={lv}
                    onClick={() => setEnergy(lv)}
                    className={`flex-1 rounded-full border py-2 text-[10px] transition-all md:py-2.5 ${active ? color : 'border-charcoal/[0.06] bg-white/35 text-charcoal/40'}`}
                  >
                    {energyLabels[lv]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="hidden stitch-card rounded-2xl p-5 md:block">
            <p className="text-[9px] uppercase tracking-[0.22em] text-charcoal/30">{t.tasks.later}</p>
            <p className="mt-3 font-display text-[32px] leading-none text-charcoal/70">{laterTasks.length}</p>
            <p className="mt-3 font-display text-sm italic leading-relaxed text-charcoal/40">
              parked gently for another day.
            </p>
          </div>
        </aside>

        <section className="min-h-0 md:col-start-1 md:row-start-1 md:flex md:flex-col">

      {showInput && (
        <form onSubmit={handleAdd} className="stitch-card rounded-2xl p-5 animate-in slide-in-from-top-4">
          <div className="relative mb-4">
            <input autoFocus className="w-full bg-transparent border-none pr-12 text-[18px] focus:ring-0" placeholder={isListening ? t.chat.listening : t.tasks.placeholder} value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} readOnly={isListening} />
            <button type="button" onClick={() => toggleListening(newTaskTitle)} className={`absolute right-0 top-1/2 -translate-y-1/2 size-10 rounded-full flex items-center justify-center ${isListening ? 'bg-[#c8695e] text-white' : 'text-charcoal/25'}`}>
              <span className="material-symbols-outlined">{isListening ? 'stop' : 'mic'}</span>
            </button>
          </div>
          <button type="submit" disabled={!newTaskTitle.trim() || isAnalyzing} className="w-full rounded-full bg-primary/25 py-3 text-[10px] uppercase tracking-wider text-charcoal transition disabled:opacity-30">
            {isAnalyzing ? t.tasks.analyzing : t.tasks.accept}
          </button>
        </form>
      )}

      {/* Today list */}
      <div className="flex-1 overflow-y-auto scrollbar-hide pb-8 space-y-3 md:max-h-full md:pr-1">
        {sortedTodayTasks.length === 0 ? (
          <div className="text-center py-16 text-charcoal/30">
            <p className="text-sm font-medium">{t.tasks.nothingToday}</p>
            <p className="text-xs mt-2">{t.tasks.nothingTodaySub}</p>
          </div>
        ) : (
          sortedTodayTasks.map(renderTaskCard)
        )}

        {/* Later drawer */}
        <div className="pt-8">
          <button
            onClick={() => setShowLater(!showLater)}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-full text-charcoal/45 text-[11px]"
          >
            <span>{t.tasks.later} · {laterTasks.length}</span>
            <span className="material-symbols-outlined text-sm">{showLater ? 'expand_less' : 'expand_more'}</span>
          </button>
          {showLater && (
            <div className="mt-3 space-y-3 opacity-80">
              {laterTasks.length === 0 ? (
                <p className="text-center text-xs text-charcoal/30 py-6">{t.tasks.laterEmpty}</p>
              ) : (
                laterTasks.map(renderTaskCard)
              )}
            </div>
          )}
        </div>

        {/* Safe exit */}
        <div className="pt-4 flex justify-center">
          <button onClick={() => setDayDone(true)} className="font-display px-5 py-2 text-[12px] italic text-charcoal/42 hover:text-charcoal/70 transition-all">
            {t.tasks.imDone}
          </button>
        </div>
      </div>
        </section>
      </div>
      </div>
    </div>
  );
};

export default TasksView;
