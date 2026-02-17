
import React, { useState, useMemo } from 'react';
import { Task, Event, Personality, Language, TaskPriority } from '../types';
import ItemDetailModal from '../components/ItemDetailModal';
import { getT } from '../translations';

interface TasksViewProps {
  tasks: Task[];
  events?: Event[];
  personality: Personality;
  language: Language;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onEditTask: (id: string, updates: Partial<Task>) => void;
  onAddTask: (title: string, category: string, date: string, description?: string, recurrence?: Task['recurrence'], priority?: TaskPriority) => void;
  onAddEvent?: (event: Partial<Event>) => void; // Added for promotion
  onRescheduleTask: (taskId: string, newDate: string) => void;
  onFailTask: (id: string) => void;
  onSyncGoogle: () => void;
  onDisconnectGoogle: () => void;
  isGoogleConnected: boolean;
  lastSyncTime?: string | null;
  isSyncing?: boolean;
}

const TasksView: React.FC<TasksViewProps> = ({ 
  tasks, language, onDeleteTask, onEditTask, onAddTask, onAddEvent,
  onSyncGoogle, onDisconnectGoogle, isGoogleConnected, lastSyncTime, isSyncing = false
}) => {
  const t = useMemo(() => getT(language), [language]);
  
  // State for new task
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState(t.tasks.categories[0]);
  const [showInput, setShowInput] = useState(false);
  
  // State for Drag & Drop
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  
  // State for Mobile Tabs
  const [activeMobileTab, setActiveMobileTab] = useState<TaskPriority>('urgent');

  // State for Promotion (Scheduling)
  const [promotingTask, setPromotingTask] = useState<Task | null>(null);
  const [promoteDate, setPromoteDate] = useState(new Date().toISOString().split('T')[0]);
  const [promoteTime, setPromoteTime] = useState('10:00');
  const [promoteDuration, setPromoteDuration] = useState('01:00');

  // State for Details
  const [selectedItem, setSelectedItem] = useState<Task | Event | null>(null);

  const priorities: TaskPriority[] = ['urgent', 'high', 'normal', 'low'];
  const priorityColors = {
    urgent: 'bg-red-50 text-red-600 border-red-100',
    high: 'bg-orange-50 text-orange-600 border-orange-100',
    normal: 'bg-blue-50 text-blue-600 border-blue-100',
    low: 'bg-charcoal/5 text-charcoal/60 border-charcoal/5'
  };

  const groupedTasks = useMemo(() => {
    const groups: Record<TaskPriority, Task[]> = { urgent: [], high: [], normal: [], low: [] };
    tasks.forEach(task => {
      // If priority is undefined in old data, default to normal
      const p = task.priority || 'normal';
      if (groups[p]) groups[p].push(task);
      else groups['normal'].push(task);
    });
    return groups;
  }, [tasks]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTaskTitle.trim()) {
      // Default to 'normal' priority for quick add
      onAddTask(newTaskTitle, newTaskCategory, '', undefined, 'none', 'normal');
      setNewTaskTitle('');
      setShowInput(false);
    }
  };

  const handlePromoteSubmit = () => {
    if (!promotingTask || !onAddEvent) return;

    // Calculate end time
    const [h, m] = promoteTime.split(':').map(Number);
    const [dh, dm] = promoteDuration.split(':').map(Number);
    const endDate = new Date();
    endDate.setHours(h + dh);
    endDate.setMinutes(m + dm);
    const endTime = endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    onAddEvent({
      title: promotingTask.title,
      description: promotingTask.description,
      type: promotingTask.category.toLowerCase() as any || 'work',
      date: promoteDate,
      startTime: promoteTime,
      endTime: endTime,
      recurrence: promotingTask.recurrence || 'none',
      daysOfWeek: promotingTask.daysOfWeek,
      source: 'local'
    });

    onDeleteTask(promotingTask.id);
    setPromotingTask(null);
  };

  // --- DnD Handlers ---
  const onDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDrop = (e: React.DragEvent, targetPriority: TaskPriority) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;
    setDraggedTaskId(null);

    const task = tasks.find(t => t.id === taskId);
    if (!task || task.priority === targetPriority) return;

    onEditTask(taskId, { priority: targetPriority });
  };

  const renderColumn = (priority: TaskPriority) => {
    const items = groupedTasks[priority];
    return (
      <div 
        key={priority}
        onDragOver={onDragOver}
        onDrop={(e) => onDrop(e, priority)}
        className="flex flex-col h-full bg-white/40 border border-charcoal/5 rounded-[2rem] overflow-hidden"
      >
        <div className={`p-4 border-b border-charcoal/5 flex justify-between items-center ${priority === activeMobileTab ? 'bg-white' : ''}`}>
          <div className="flex items-center gap-2">
            <div className={`size-2 rounded-full ${priority === 'urgent' ? 'bg-red-400' : priority === 'high' ? 'bg-orange-400' : priority === 'normal' ? 'bg-primary' : 'bg-charcoal/20'}`}></div>
            <h3 className="text-xs font-black uppercase tracking-widest text-charcoal/60">{t.tasks.priorities[priority]}</h3>
          </div>
          <span className="text-[10px] font-bold text-charcoal/20 bg-white px-2 py-1 rounded-full border border-charcoal/5">{items.length}</span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-hide">
          {items.map(task => (
            <div 
              key={task.id}
              draggable
              onDragStart={(e) => onDragStart(e, task.id)}
              className={`group relative p-5 bg-white rounded-[1.5rem] border border-charcoal/5 shadow-sm hover:shadow-lg transition-all cursor-grab active:cursor-grabbing ${task.id === draggedTaskId ? 'opacity-40 scale-95' : ''}`}
              onClick={() => setSelectedItem(task)}
            >
               <div className="flex justify-between items-start mb-2">
                 <span className="text-[9px] font-bold uppercase tracking-wider text-charcoal/30 bg-beige-soft px-2 py-1 rounded-lg">{task.category}</span>
                 {task.recurrence && task.recurrence !== 'none' && <span className="material-symbols-outlined text-[14px] text-charcoal/20">sync</span>}
               </div>
               <h4 className="text-sm font-bold text-charcoal mb-4 leading-snug">{task.title}</h4>
               
               <div className="flex gap-2 mt-auto">
                 <button 
                    onClick={(e) => { e.stopPropagation(); setPromotingTask(task); }}
                    className="flex-1 py-2 bg-charcoal text-cream rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1 hover:bg-primary hover:text-charcoal transition-colors shadow-sm"
                 >
                   <span className="material-symbols-outlined text-[14px]">event_available</span>
                   {t.tasks.promote.button}
                 </button>
                 <button 
                    onClick={(e) => { e.stopPropagation(); onDeleteTask(task.id); }}
                    className="size-8 flex items-center justify-center rounded-xl bg-charcoal/5 text-charcoal/20 hover:text-red-500 hover:bg-red-50 transition-colors"
                 >
                   <span className="material-symbols-outlined text-[16px]">delete</span>
                 </button>
               </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="h-32 flex flex-col items-center justify-center text-charcoal/10 border-2 border-dashed border-charcoal/5 rounded-2xl mx-1">
              <span className="material-symbols-outlined text-3xl mb-1">inbox</span>
              <span className="text-[9px] font-black uppercase tracking-widest">{t.tasks.noTasks}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-24 md:pb-0 px-4 md:px-0 relative h-full flex flex-col">
      <ItemDetailModal 
        item={selectedItem} 
        onClose={() => setSelectedItem(null)} 
        onEdit={onEditTask} 
        language={language}
      />

      {/* Promotion Modal */}
      {promotingTask && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-charcoal/30 backdrop-blur-sm" onClick={() => setPromotingTask(null)}></div>
          <div className="relative w-full max-w-sm bg-white rounded-[2rem] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
             <h3 className="text-lg font-display font-black text-charcoal mb-1">{t.tasks.promote.modalTitle}</h3>
             <p className="text-xs text-charcoal/40 font-medium mb-6">Assign a time to "{promotingTask.title}"</p>
             
             <div className="space-y-4 mb-8">
               <div>
                 <label className="text-[9px] font-black uppercase tracking-widest text-charcoal/30 block mb-1">Date</label>
                 <input type="date" value={promoteDate} onChange={e => setPromoteDate(e.target.value)} className="w-full bg-beige-soft border-none rounded-xl text-sm font-bold p-3" />
               </div>
               <div className="flex gap-4">
                 <div className="flex-1">
                   <label className="text-[9px] font-black uppercase tracking-widest text-charcoal/30 block mb-1">Start Time</label>
                   <input type="time" value={promoteTime} onChange={e => setPromoteTime(e.target.value)} className="w-full bg-beige-soft border-none rounded-xl text-sm font-bold p-3" />
                 </div>
                 <div className="flex-1">
                   <label className="text-[9px] font-black uppercase tracking-widest text-charcoal/30 block mb-1">Duration</label>
                   <input type="time" value={promoteDuration} onChange={e => setPromoteDuration(e.target.value)} className="w-full bg-beige-soft border-none rounded-xl text-sm font-bold p-3" />
                 </div>
               </div>
             </div>

             <div className="flex gap-3">
               <button onClick={() => setPromotingTask(null)} className="flex-1 py-3 border border-charcoal/10 rounded-xl text-[10px] font-black uppercase tracking-widest">Cancel</button>
               <button onClick={handlePromoteSubmit} className="flex-1 py-3 bg-primary text-charcoal rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg">{t.tasks.promote.confirm}</button>
             </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 shrink-0">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-display font-extrabold tracking-tight text-charcoal">{t.tasks.title}</h1>
          <div className="flex items-center gap-4">
             <p className="text-charcoal/40 text-sm font-medium">{t.tasks.activeFor}</p>
             {isGoogleConnected && lastSyncTime && (
               <p className="text-[9px] font-black text-primary uppercase tracking-widest flex items-center gap-1.5 border-l border-charcoal/5 pl-4">
                 <span className={`material-symbols-outlined text-[12px] ${isSyncing ? 'animate-spin' : ''}`}>{isSyncing ? 'sync' : 'done_all'}</span>
                 {isSyncing ? (language === 'ru' ? 'Синхронизация...' : 'Syncing...') : `${language === 'ru' ? 'Обновлено в' : 'Synced at'} ${lastSyncTime}`}
               </p>
             )}
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
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

      {/* Content Area */}
      <div className="flex-1 min-h-0 flex flex-col md:block">
        {/* Mobile Tab Switcher */}
        <div className="md:hidden flex bg-beige-soft p-1 rounded-xl mb-4 shrink-0 overflow-x-auto">
          {priorities.map(p => (
            <button
              key={p}
              onClick={() => setActiveMobileTab(p)}
              className={`flex-1 min-w-[80px] py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                activeMobileTab === p ? 'bg-white shadow-md text-charcoal' : 'text-charcoal/40'
              }`}
            >
              {t.tasks.priorities[p].split(' ')[0]} {/* Short name for mobile */}
            </button>
          ))}
        </div>

        {/* Desktop Grid / Mobile Active View */}
        <div className="h-full md:grid md:grid-cols-4 md:gap-4 hidden">
          {priorities.map(p => renderColumn(p))}
        </div>
        
        {/* Mobile Single Column View */}
        <div className="md:hidden flex-1 min-h-0">
          {renderColumn(activeMobileTab)}
        </div>
      </div>
    </div>
  );
};

export default TasksView;
