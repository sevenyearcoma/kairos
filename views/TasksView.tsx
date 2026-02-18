
import React, { useState, useMemo, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
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
  onAddEvent?: (event: Partial<Event>) => void;
  onRescheduleTask: (taskId: string, newDate: string) => void;
  onFailTask: (id: string) => void;
  onSyncGoogle: () => void;
  onDisconnectGoogle: () => void;
  isGoogleConnected: boolean;
  lastSyncTime?: string | null;
  isSyncing?: boolean;
}

const TasksView: React.FC<TasksViewProps> = ({ 
  tasks, events = [], language, onDeleteTask, onEditTask, onAddTask, onAddEvent,
  onSyncGoogle, onDisconnectGoogle, isGoogleConnected, lastSyncTime, isSyncing = false
}) => {
  const t = useMemo(() => getT(language), [language]);
  
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState(t.tasks.categories[0]);
  const [showInput, setShowInput] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [isAiProcessing, setIsAiProcessing] = useState<string | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const [selectedItem, setSelectedItem] = useState<Task | Event | null>(null); // For full edit modal
  const [startInEditMode, setStartInEditMode] = useState(false);
  
  const priorities: TaskPriority[] = ['urgent', 'high', 'normal', 'low'];

  const quadrantStyles = {
    urgent: { bg: 'bg-[#FFF5F5]', border: 'border-[#FED7D7]', text: 'text-[#9B1C1C]', tab: 'bg-[#FED7D7]' },
    high: { bg: 'bg-[#EFF6FF]', border: 'border-[#BFDBFE]', text: 'text-[#1E40AF]', tab: 'bg-[#BFDBFE]' },
    normal: { bg: 'bg-[#F0FDF4]', border: 'border-[#BBF7D0]', text: 'text-[#166534]', tab: 'bg-[#BBF7D0]' },
    low: { bg: 'bg-[#F4F4F5]', border: 'border-[#E4E4E7]', text: 'text-[#52525B]', tab: 'bg-[#E4E4E7]' }
  };

  const groupedTasks = useMemo(() => {
    const groups: Record<TaskPriority, Task[]> = { urgent: [], high: [], normal: [], low: [] };
    tasks.forEach(task => {
      const p = task.priority || 'normal';
      if (groups[p]) groups[p].push(task);
      else groups['normal'].push(task);
    });
    return groups;
  }, [tasks]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || isAnalyzing) return;
    
    setIsAnalyzing(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Optimized prompt for lighter model
      const prompt = `
        Classify: "${newTaskTitle}"
        Return JSON object with:
        1. priority: 'urgent' | 'high' | 'normal' | 'low'
        2. category: 'Work' | 'Personal' | 'Meeting' | 'Finance'
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-flash-lite-latest', // Lighter model for simple classification
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              priority: { type: Type.STRING, enum: ['urgent', 'high', 'normal', 'low'] },
              category: { type: Type.STRING, enum: ['Work', 'Personal', 'Meeting', 'Finance'] }
            }
          }
        }
      });
      
      const result = JSON.parse(response.text || "{}");
      
      onAddTask(
        newTaskTitle, 
        result.category || newTaskCategory, 
        '', 
        undefined, 
        'none', 
        result.priority || 'normal'
      );
      
      setNewTaskTitle('');
      setShowInput(false);
    } catch (err) {
      console.error("AI Categorization failed", err);
      onAddTask(newTaskTitle, newTaskCategory, '', undefined, 'none', 'normal');
      setNewTaskTitle('');
      setShowInput(false);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAutoSchedule = async (task: Task) => {
    if (!onAddEvent) return;
    setIsAiProcessing(task.id);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const now = new Date();
      const offset = now.getTimezoneOffset() * 60000;
      const localToday = new Date(now.getTime() - offset).toISOString().split('T')[0];
      
      // Optimization: Filter out past events to reduce token usage and speed up processing
      const contextEvents = events
        .filter(e => (e.recurrence && e.recurrence !== 'none') || e.date >= localToday)
        .map(e => ({
          title: e.title,
          date: e.date,
          start: e.startTime,
          end: e.endTime,
          recurrence: e.recurrence,
          daysOfWeek: e.daysOfWeek
        }));

      // Tasks that are already scheduled/have dates (if any exist in this view)
      const contextTasks = tasks
        .filter(t => t.date && t.id !== task.id && t.date >= localToday)
        .map(t => ({
          title: t.title,
          date: t.date,
          priority: t.priority
        }));

      // Highly condensed prompt for speed
      const prompt = `
        Role: Scheduler.
        Task: Find optimal 1-hour slot.
        Context Date: ${localToday} (${new Date(localToday).toLocaleDateString('en-US', { weekday: 'short' })})
        
        Item: "${task.title}" (${task.category}, ${task.priority}). ${task.description || ''}
        
        Rules:
        1. Timing: If "next week", schedule then. Else Today/Tomorrow.
        2. Hours: Work 09-18. Personal 09-21.
        3. NO OVERLAP with Schedule.
        
        Schedule:
        ${JSON.stringify(contextEvents)}
        
        Return JSON: { "date": "YYYY-MM-DD", "startTime": "HH:MM", "endTime": "HH:MM", "reason": "short reason" }
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              date: { type: Type.STRING },
              startTime: { type: Type.STRING },
              endTime: { type: Type.STRING },
              reason: { type: Type.STRING }
            },
            required: ["date", "startTime", "endTime"]
          }
        }
      });

      const result = JSON.parse(response.text || "{}");

      if (result.date && result.startTime) {
        onAddEvent({
          title: task.title,
          description: (task.description ? task.description + '\n\n' : '') + `[Auto: ${result.reason || 'Scheduled'}]`,
          type: task.category.toLowerCase() as any || 'work',
          date: result.date,
          startTime: result.startTime,
          endTime: result.endTime,
          recurrence: task.recurrence || 'none',
          source: 'local'
        });
        onDeleteTask(task.id);
      } else {
        alert(t.tasks.autoSchedule.fail);
      }
    } catch (e) {
      console.error("Auto schedule failed", e);
      alert(t.tasks.autoSchedule.fail);
    } finally {
      setIsAiProcessing(null);
    }
  };

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
    onEditTask(taskId, { priority: targetPriority });
  };

  const toggleExpand = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedTaskId(expandedTaskId === taskId ? null : taskId);
  };

  // Helper for random paper rotation
  const getRotation = (index: number) => {
    const rots = ['rotate-1', '-rotate-1', 'rotate-2', '-rotate-2', 'rotate-0', '-rotate-1'];
    return rots[index % rots.length];
  };

  const renderStack = (priority: TaskPriority) => {
    const items = groupedTasks[priority];
    const style = quadrantStyles[priority];
    
    const fullTitle = t.tasks.priorities[priority];
    const mainTitle = fullTitle.split('(')[0].trim();
    
    return (
      <div 
        key={priority}
        onDragOver={onDragOver}
        onDrop={(e) => onDrop(e, priority)}
        className={`flex flex-col h-full rounded-[2rem] shadow-[0_4px_20px_rgba(0,0,0,0.02)] overflow-hidden transition-all ${style.bg} border ${style.border}`}
      >
        {/* Folder Tab Header */}
        <div className={`px-5 py-3 flex justify-between items-center border-b ${style.border} bg-white/40`}>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${style.tab.replace('bg-', 'bg-opacity-50 ')}`}></div>
            <h3 className={`text-xs font-black uppercase tracking-widest ${style.text}`}>{mainTitle}</h3>
          </div>
          <span className={`text-[10px] font-bold ${style.text} opacity-60`}>{items.length}</span>
        </div>
        
        {/* Stack Container */}
        <div className="relative flex-1 p-4 overflow-y-auto scrollbar-hide">
          {items.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center opacity-20 gap-2 min-h-[120px]">
                <span className="material-symbols-outlined text-4xl">folder_open</span>
                <p className="text-[9px] font-black uppercase tracking-widest">Empty</p>
             </div>
          ) : (
             <div className="flex flex-col w-full pb-10 isolate space-y-[-16px]"> 
                {items.map((task, index) => {
                  const isExpanded = expandedTaskId === task.id;
                  const rotationClass = isExpanded ? 'rotate-0' : getRotation(index);
                  const isProcessing = isAiProcessing === task.id;

                  return (
                    <div 
                       key={task.id}
                       draggable
                       onDragStart={(e) => { e.stopPropagation(); onDragStart(e, task.id); }}
                       onClick={(e) => toggleExpand(task.id, e)}
                       style={{ zIndex: isExpanded ? 50 : index }} 
                       className={`
                         group relative w-full bg-[#FAF9F6] border border-charcoal/5 rounded-xl shadow-sm
                         transition-all duration-300 ease-out cursor-pointer
                         hover:z-[40] hover:-translate-y-2 hover:shadow-lg hover:rotate-0 hover:scale-[1.02]
                         ${rotationClass}
                         ${isExpanded ? 'mb-4 shadow-xl translate-y-0 scale-100 z-50' : ''}
                       `}
                    >
                        {/* Card Face (Visible Strip) */}
                        <div className="px-4 flex items-center justify-between gap-3 h-[50px]">
                           <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className={`shrink-0 size-2.5 rounded-full border-2 border-white shadow-sm
                                ${task.category === 'Work' ? 'bg-blue-400' : 
                                  task.category === 'Personal' ? 'bg-purple-400' : 
                                  task.category === 'Meeting' ? 'bg-emerald-400' :
                                  'bg-amber-400'}
                              `}></div>
                              <span className={`text-sm font-bold text-charcoal truncate ${task.completed ? 'line-through opacity-40' : ''}`}>
                                {task.title}
                              </span>
                           </div>
                           <div className="shrink-0 text-charcoal/20 group-hover:text-charcoal/50 transition-colors">
                              <span className="material-symbols-outlined text-lg">
                                {isExpanded ? 'expand_less' : 'expand_more'}
                              </span>
                           </div>
                        </div>

                        {/* Expanded Content (Accordion) */}
                        <div className={`
                          px-4 overflow-hidden transition-all duration-300 ease-in-out border-t border-charcoal/5 bg-white/50
                          ${isExpanded ? 'max-h-[200px] py-4 opacity-100' : 'max-h-0 py-0 opacity-0'}
                        `}>
                           {task.description && (
                             <p className="text-xs text-charcoal/60 mb-4 font-medium leading-relaxed line-clamp-2">
                               {task.description}
                             </p>
                           )}
                           
                           <div className="flex items-center gap-2 justify-end">
                              <button 
                                onClick={(e) => { e.stopPropagation(); setStartInEditMode(false); setSelectedItem(task); }}
                                className="size-9 rounded-lg flex items-center justify-center text-charcoal/30 hover:bg-charcoal/5 hover:text-charcoal transition-colors"
                                title={language === 'ru' ? 'Подробнее' : 'View Details'}
                              >
                                <span className="material-symbols-outlined text-lg">visibility</span>
                              </button>

                              <button 
                                onClick={(e) => { e.stopPropagation(); setStartInEditMode(true); setSelectedItem(task); }}
                                className="size-9 rounded-lg flex items-center justify-center text-charcoal/30 hover:bg-charcoal/5 hover:text-charcoal transition-colors"
                                title={language === 'ru' ? 'Редактировать' : 'Edit'}
                              >
                                <span className="material-symbols-outlined text-lg">edit</span>
                              </button>

                              <button 
                                onClick={(e) => { e.stopPropagation(); handleAutoSchedule(task); }}
                                className="h-9 px-3 rounded-lg bg-charcoal/5 hover:bg-primary hover:text-charcoal text-charcoal/60 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all"
                                title={language === 'ru' ? 'Авто-планирование' : 'Auto Schedule'}
                              >
                                <span className={`material-symbols-outlined text-sm ${isProcessing ? 'animate-spin' : ''}`}>
                                  {isProcessing ? 'sync' : 'auto_awesome'}
                                </span>
                                {language === 'ru' ? 'В График' : 'Schedule'}
                              </button>

                              <button 
                                onClick={(e) => { e.stopPropagation(); onDeleteTask(task.id); }}
                                className="size-9 rounded-lg flex items-center justify-center text-charcoal/30 hover:bg-red-50 hover:text-red-500 transition-colors"
                                title={language === 'ru' ? 'Удалить' : 'Delete'}
                              >
                                <span className="material-symbols-outlined text-lg">delete</span>
                              </button>
                           </div>
                        </div>
                    </div>
                  );
                })}
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
        onClose={() => { setSelectedItem(null); setStartInEditMode(false); }} 
        onEdit={onEditTask} 
        language={language}
        initialEditMode={startInEditMode}
      />
      
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 shrink-0 h-20">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-display font-extrabold tracking-tight text-charcoal">{t.tasks.title}</h1>
          <div className="flex items-center gap-4">
             <p className="text-charcoal/40 text-sm font-medium">{t.tasks.activeFor}</p>
             {isGoogleConnected && lastSyncTime && (
               <p className="text-[9px] font-black text-primary uppercase tracking-widest flex items-center gap-1.5 border-l border-charcoal/5 pl-4">
                 <span className={`material-symbols-outlined text-[12px] ${isSyncing ? 'animate-spin' : ''}`}>{isSyncing ? 'sync' : 'done_all'}</span>
                 {isSyncing ? (language === 'ru' ? 'Обновление...' : 'Syncing...') : `${language === 'ru' ? 'Обновлено' : 'Synced'} ${lastSyncTime}`}
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
            className="flex items-center gap-3 px-6 py-3 bg-charcoal text-cream rounded-2xl hover:bg-primary hover:text-charcoal transition-all shadow-lg shadow-charcoal/5 font-bold uppercase tracking-widest text-[11px]"
          >
            <span className="material-symbols-outlined text-[18px]">{showInput ? 'close' : 'add'}</span>
            {showInput ? t.tasks.cancel : t.tasks.newTask}
          </button>
        </div>
      </header>

      {showInput && (
        <form onSubmit={handleAdd} className="bg-white p-6 rounded-[2rem] border border-primary/20 shadow-xl shadow-primary/5 animate-in slide-in-from-top-4 duration-300 shrink-0 relative z-50">
           <div className="space-y-4">
              <input 
                autoFocus
                className="w-full bg-transparent border-none focus:ring-0 text-xl font-bold placeholder:text-charcoal/10" 
                placeholder={t.tasks.placeholder} 
                value={newTaskTitle}
                disabled={isAnalyzing}
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
                disabled={!newTaskTitle.trim() || isAnalyzing}
                className="w-full py-3 bg-primary text-charcoal font-bold uppercase tracking-[0.2em] text-[10px] rounded-xl disabled:opacity-30 transition-all flex justify-center items-center"
              >
                {isAnalyzing ? (
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                    {language === 'ru' ? 'АНАЛИЗ...' : 'ANALYZING...'}
                  </span>
                ) : t.tasks.accept}
              </button>
           </div>
        </form>
      )}

      <div className="flex-1 min-h-0 pb-4">
        <div className="h-full grid grid-cols-1 md:grid-cols-2 grid-rows-2 gap-6">
          {priorities.map(p => renderStack(p))}
        </div>
      </div>
    </div>
  );
};

export default TasksView;
