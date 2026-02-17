
import React, { useState, useMemo, useEffect } from 'react';
import { Task, Event, Personality, Language, TaskStatus } from '../types';
import ItemDetailModal from '../components/ItemDetailModal';
import { isItemOnDate } from '../utils/dateUtils';
import { getT } from '../translations';

interface TasksViewProps {
  tasks: Task[];
  events?: Event[];
  personality: Personality;
  language: Language;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onEditTask: (id: string, updates: Partial<Task>) => void;
  onAddTask: (title: string, category: string, date: string, description?: string, recurrence?: Task['recurrence']) => void;
  onRescheduleTask: (taskId: string, newDate: string) => void;
  onFailTask: (id: string) => void;
  onSyncGoogle: () => void;
  onDisconnectGoogle: () => void;
  isGoogleConnected: boolean;
  lastSyncTime?: string | null;
  isSyncing?: boolean;
}

const TasksView: React.FC<TasksViewProps> = ({ 
  tasks, events = [], personality, language, onToggleTask, onDeleteTask, onEditTask, onAddTask, onRescheduleTask, onFailTask,
  onSyncGoogle, onDisconnectGoogle, isGoogleConnected, lastSyncTime, isSyncing = false
}) => {
  const t = useMemo(() => getT(language), [language]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState(t.tasks.categories[0]);
  const [showInput, setShowInput] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; visible: boolean } | null>(null);
  const [selectedItem, setSelectedItem] = useState<Task | Event | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban'); // Default to Kanban per user request implies focus on it
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const TODAY = new Date().toISOString().split('T')[0];
  const TOMORROW_DATE = new Date();
  TOMORROW_DATE.setDate(TOMORROW_DATE.getDate() + 1);
  const TOMORROW = TOMORROW_DATE.toISOString().split('T')[0];

  // Helper to normalize status for old data
  const getTaskStatus = (task: Task): TaskStatus => {
    if (task.status) return task.status;
    if (task.completed) return 'done';
    if (task.failed) return 'planning'; // Failed tasks go back to backlog/planning
    if (isItemOnDate(task, TODAY)) return 'todo';
    return 'planning';
  };

  const groupedItems = useMemo(() => {
    // For List View
    const routines: Task[] = [];
    const todayTasks: Task[] = [];
    const tomorrowTasks: Task[] = [];
    const laterTasks: Task[] = [];
    const completedTasks: Task[] = [];
    const failedTasks: Task[] = [];
    
    // For Kanban View
    const kanban = {
      planning: [] as Task[],
      todo: [] as Task[],
      in_progress: [] as Task[],
      done: [] as Task[]
    };

    tasks.forEach(t => {
      // List View Logic
      if (t.completed) completedTasks.push(t);
      else if (t.failed) failedTasks.push(t);
      else if (t.recurrence && t.recurrence !== 'none') {
        routines.push(t);
        if (isItemOnDate(t, TODAY)) todayTasks.push(t);
      } else if (isItemOnDate(t, TODAY)) todayTasks.push(t);
      else if (isItemOnDate(t, TOMORROW)) tomorrowTasks.push(t);
      else laterTasks.push(t);

      // Kanban View Logic
      const status = getTaskStatus(t);
      kanban[status].push(t);
    });

    const todayOneOffs = todayTasks.filter(t => !t.recurrence || t.recurrence === 'none');

    return { 
      // List
      routines, todayOneOffs, tomorrowTasks, laterTasks, completedTasks, failedTasks,
      // Kanban
      kanban
    };
  }, [tasks, TODAY, TOMORROW]);

  useEffect(() => {
    if (feedback?.visible) {
      const timer = setTimeout(() => {
        setFeedback(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const handleToggle = (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    
    // Simple toggle for List View
    onToggleTask(id);

    if (!task.completed) {
      let message = t.tasks.feedback.success;
      if (personality.strictness > 60) message = t.tasks.feedback.strict;
      else if (personality.trust > 80) {
        const warm = t.tasks.feedback.warm;
        message = warm[Math.floor(Math.random() * warm.length)];
      }
      setFeedback({ message, visible: true });
    }
  };

  const handleFail = (id: string) => {
    onFailTask(id);
    setFeedback({ message: t.tasks.feedback.fail, visible: true });
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTaskTitle.trim()) {
      onAddTask(newTaskTitle, newTaskCategory, TODAY);
      setNewTaskTitle('');
      setShowInput(false);
    }
  };

  const handlePostpone = (taskId: string) => {
    onRescheduleTask(taskId, TOMORROW);
  };

  // --- DnD Handlers ---
  const onDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
    // Transparent ghost image if desired, standard behavior is usually fine
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessary to allow dropping
  };

  const onDrop = (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    setDraggedTaskId(null);

    // Find the task
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    if (getTaskStatus(task) === targetStatus) return;

    // Logic for updating task based on column
    const updates: Partial<Task> = { status: targetStatus };

    if (targetStatus === 'done') {
      updates.completed = true;
      let message = t.tasks.feedback.success;
      setFeedback({ message, visible: true });
    } else {
      updates.completed = false;
      // If moving to ToDo or InProgress, imply it's for today if it wasn't
      if ((targetStatus === 'todo' || targetStatus === 'in_progress') && !isItemOnDate(task, TODAY)) {
        updates.date = TODAY;
      }
    }
    
    onEditTask(taskId, updates);
  };

  const columns: { id: TaskStatus; label: string; colorClass: string; items: Task[] }[] = [
    { id: 'planning', label: t.tasks.kanban.planning, colorClass: 'bg-charcoal/5', items: groupedItems.kanban.planning },
    { id: 'todo', label: t.tasks.kanban.todo, colorClass: 'bg-primary/10', items: groupedItems.kanban.todo },
    { id: 'in_progress', label: t.tasks.kanban.inProgress, colorClass: 'bg-primary/20', items: groupedItems.kanban.in_progress },
    { id: 'done', label: t.tasks.kanban.done, colorClass: 'bg-emerald-muted/20', items: groupedItems.kanban.done },
  ];

  const renderTaskCard = (task: Task, isKanban = false) => (
    <div 
      key={task.id}
      draggable={isKanban}
      onDragStart={(e) => isKanban && onDragStart(e, task.id)}
      className={`group flex items-center gap-4 p-5 rounded-[1.5rem] transition-all border cursor-pointer select-none active:scale-95 ${
        task.id === draggedTaskId ? 'opacity-50 scale-95 shadow-none border-dashed' : 
        task.completed 
          ? 'bg-white/50 opacity-60 border-charcoal/5' 
          : task.failed 
          ? 'bg-red-50/50 border-red-100 opacity-80'
          : 'bg-white hover:shadow-xl hover:shadow-charcoal/5 border-charcoal/5'
      }`}
      onClick={() => setSelectedItem(task)}
    >
      <div 
        onClick={(e) => { e.stopPropagation(); if (!task.failed) handleToggle(task.id); }}
        className={`size-6 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 cursor-pointer ${
          task.completed ? 'border-primary bg-primary' : 
          task.failed ? 'border-red-200 bg-red-100' : 
          'border-charcoal/10 group-hover:border-primary'
        }`}
      >
        {task.completed && <span className="material-symbols-outlined text-white text-[16px] font-bold">check</span>}
        {task.failed && <span className="material-symbols-outlined text-red-500 text-[16px] font-bold">close</span>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
           <h3 className={`text-sm font-bold truncate text-charcoal transition-all ${task.completed ? 'line-through text-charcoal/30' : task.failed ? 'text-red-900/40' : ''}`}>
             {task.title}
           </h3>
           {task.recurrence && task.recurrence !== 'none' && (
             <span className="material-symbols-outlined text-[14px] text-primary/40">sync</span>
           )}
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className={`text-[10px] font-bold uppercase tracking-tighter ${task.completed ? 'text-charcoal/20' : task.failed ? 'text-red-300' : 'text-primary/80'}`}>
            {task.category}
          </span>
          {task.rescheduleCount && task.rescheduleCount > 0 && (
            <span className="text-[9px] bg-red-50 text-red-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter">
              Postponed x{task.rescheduleCount}
            </span>
          )}
        </div>
      </div>
      {!isKanban && (
        <div className="flex items-center gap-1">
            <button 
              onClick={(e) => { e.stopPropagation(); onDeleteTask(task.id); }}
              className="opacity-0 group-hover:opacity-30 hover:!opacity-100 transition-all p-2 text-charcoal/40 hover:text-red-500"
            >
              <span className="material-symbols-outlined text-lg">delete</span>
            </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-8 pb-32 md:pb-0 px-4 md:px-0 relative h-full flex flex-col">
      <ItemDetailModal 
        item={selectedItem} 
        onClose={() => setSelectedItem(null)} 
        onEdit={onEditTask} 
        language={language}
      />

      {feedback?.visible && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] bg-charcoal text-cream px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="size-6 bg-primary rounded-full flex items-center justify-center text-charcoal">
            <span className="material-symbols-outlined text-[16px] font-black">auto_awesome</span>
          </div>
          <span className="text-[11px] font-black uppercase tracking-widest">{feedback.message}</span>
        </div>
      )}

      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 shrink-0">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-display font-extrabold tracking-tight text-charcoal">{t.tasks.title}</h1>
          <div className="flex items-center gap-4">
             <p className="text-charcoal/40 text-sm font-medium">
                {t.tasks.activeFor} {new Date(TODAY).toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long' })}
             </p>
             {isGoogleConnected && lastSyncTime && (
               <p className="text-[9px] font-black text-primary uppercase tracking-widest flex items-center gap-1.5 border-l border-charcoal/5 pl-4">
                 <span className={`material-symbols-outlined text-[12px] ${isSyncing ? 'animate-spin' : ''}`}>{isSyncing ? 'sync' : 'done_all'}</span>
                 {isSyncing ? (language === 'ru' ? 'Синхронизация...' : 'Syncing...') : `${language === 'ru' ? 'Обновлено в' : 'Synced at'} ${lastSyncTime}`}
               </p>
             )}
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-beige-soft border border-charcoal/5 rounded-2xl p-1 shadow-sm">
            <button 
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewMode === 'list' ? 'bg-white text-charcoal shadow-md' : 'text-charcoal/40 hover:text-charcoal'}`}
            >
              <span className="material-symbols-outlined text-[18px]">format_list_bulleted</span>
              <span className="hidden sm:inline">{t.tasks.viewList}</span>
            </button>
            <button 
              onClick={() => setViewMode('kanban')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewMode === 'kanban' ? 'bg-white text-charcoal shadow-md' : 'text-charcoal/40 hover:text-charcoal'}`}
            >
              <span className="material-symbols-outlined text-[18px]">view_kanban</span>
              <span className="hidden sm:inline">{t.tasks.viewKanban}</span>
            </button>
          </div>

          <div className="flex items-center bg-beige-soft border border-charcoal/5 rounded-2xl p-1 shadow-sm">
            <button 
              onClick={onSyncGoogle}
              disabled={isSyncing}
              className={`flex items-center gap-2.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                isGoogleConnected 
                  ? 'bg-primary/10 text-primary' 
                  : 'text-charcoal/40 hover:text-charcoal hover:bg-white'
              }`}
            >
              <span className={`material-symbols-outlined text-[16px] ${isSyncing ? 'animate-spin' : ''}`}>
                {isGoogleConnected ? 'sync' : 'cloud_off'}
              </span>
              {isGoogleConnected ? (language === 'ru' ? 'ОБНОВИТЬ' : 'SYNC') : (language === 'ru' ? 'GOOGLE' : 'LINK')}
            </button>
            {isGoogleConnected && (
              <button 
                onClick={onDisconnectGoogle}
                title={language === 'ru' ? 'Отключить Google' : 'Disconnect Google'}
                className="size-10 flex items-center justify-center text-charcoal/20 hover:text-red-500 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
              </button>
            )}
          </div>

          <button 
            onClick={() => setShowInput(!showInput)}
            className="flex items-center gap-3 px-6 py-3 bg-charcoal text-cream rounded-2xl hover:bg-primary transition-all shadow-lg shadow-charcoal/5 font-bold uppercase tracking-widest text-[11px]"
          >
            <span className="material-symbols-outlined text-[18px]">{showInput ? 'close' : 'add'}</span>
            {showInput ? t.tasks.cancel : t.tasks.newTask}
          </button>
        </div>
      </header>

      {showInput && (
        <form onSubmit={handleAdd} className="bg-white p-6 rounded-[2rem] border border-primary/20 shadow-xl shadow-primary/5 animate-in slide-in-from-top-4 duration-300 shrink-0">
           <div className="space-y-4">
              <input 
                autoFocus
                className="w-full bg-transparent border-none focus:ring-0 text-xl font-bold placeholder:text-charcoal/10" 
                placeholder={t.tasks.placeholder} 
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                {t.tasks.categories.map(cat => (
                  <button 
                    key={cat}
                    type="button"
                    onClick={() => setNewTaskCategory(cat)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
                      newTaskCategory === cat ? 'bg-charcoal text-cream' : 'bg-charcoal/5 text-charcoal/40 hover:bg-charcoal/10'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <button 
                type="submit"
                disabled={!newTaskTitle.trim()}
                className="w-full py-3 bg-primary text-charcoal font-bold uppercase tracking-[0.2em] text-[10px] rounded-xl disabled:opacity-30 transition-all"
              >
                {t.tasks.accept}
              </button>
           </div>
        </form>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
        {viewMode === 'list' ? (
          <div className="space-y-10 pb-12">
             {groupedItems.routines.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-xs font-extrabold uppercase tracking-widest text-primary/60">
                    {t.tasks.routines}
                  </h2>
                  <div className="flex-1 h-[1px] bg-primary/10"></div>
                </div>
                <div className="grid lg:grid-cols-2 gap-3">
                  {groupedItems.routines.map(t => renderTaskCard(t))}
                </div>
              </section>
            )}

            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <h2 className="text-xs font-extrabold uppercase tracking-widest text-charcoal/30">
                  {t.tasks.oneOffs} • {t.tasks.today}
                </h2>
                <div className="flex-1 h-[1px] bg-charcoal/5"></div>
              </div>
              <div className="grid gap-3">
                {groupedItems.todayOneOffs.length > 0 ? groupedItems.todayOneOffs.map(t => renderTaskCard(t)) : (
                  <div className="py-8 text-center border-2 border-dashed border-charcoal/5 rounded-[2rem]">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-charcoal/20">{t.tasks.noTasks}</p>
                  </div>
                )}
              </div>
            </section>

            {groupedItems.tomorrowTasks.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-xs font-extrabold uppercase tracking-widest text-charcoal/30">
                    {t.tasks.tomorrow}
                  </h2>
                  <div className="flex-1 h-[1px] bg-charcoal/5"></div>
                </div>
                <div className="grid gap-3">
                  {groupedItems.tomorrowTasks.map(t => renderTaskCard(t))}
                </div>
              </section>
            )}

            {groupedItems.failedTasks.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-xs font-extrabold uppercase tracking-widest text-red-300">{t.tasks.abandoned}</h2>
                  <div className="flex-1 h-[1px] bg-red-100"></div>
                </div>
                <div className="grid gap-3">
                  {groupedItems.failedTasks.map(t => renderTaskCard(t))}
                </div>
              </section>
            )}

            <div className="grid lg:grid-cols-2 gap-10">
              {groupedItems.laterTasks.length > 0 && (
                <section className="space-y-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xs font-extrabold uppercase tracking-widest text-charcoal/30">{t.tasks.upcoming}</h2>
                  </div>
                  <div className="grid gap-3">
                    {groupedItems.laterTasks.map(t => renderTaskCard(t))}
                  </div>
                </section>
              )}
              {groupedItems.completedTasks.length > 0 && (
                <section className="space-y-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xs font-extrabold uppercase tracking-widest text-charcoal/30">{t.tasks.completed}</h2>
                  </div>
                  <div className="grid gap-3">
                    {groupedItems.completedTasks.map(t => renderTaskCard(t))}
                  </div>
                </section>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-full pb-6 overflow-x-auto snap-x snap-mandatory gap-4 md:gap-6 px-1">
             {columns.map(col => (
               <div 
                 key={col.id} 
                 onDragOver={onDragOver}
                 onDrop={(e) => onDrop(e, col.id)}
                 className={`flex-col shrink-0 w-[85vw] md:w-80 h-full rounded-[2.5rem] p-4 flex snap-center transition-all ${col.colorClass} border border-transparent hover:border-charcoal/5`}
               >
                  <div className="flex items-center gap-2 mb-4 px-2 py-2">
                     <div className={`size-2 rounded-full ${col.id === 'todo' ? 'bg-primary' : 'bg-charcoal/20'}`}></div>
                     <h3 className="text-xs font-black uppercase tracking-widest text-charcoal/60">{col.label}</h3>
                     <span className="text-[10px] font-bold text-charcoal/20 ml-auto bg-white/50 px-2 py-1 rounded-full">{col.items.length}</span>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto space-y-3 scrollbar-hide pr-1 min-h-0">
                     {col.items.map(t => renderTaskCard(t, true))}
                     {col.items.length === 0 && (
                       <div className="h-24 flex items-center justify-center text-[10px] text-charcoal/10 font-black uppercase tracking-widest border-2 border-dashed border-charcoal/5 rounded-2xl">
                         Empty
                       </div>
                     )}
                  </div>
               </div>
             ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TasksView;
