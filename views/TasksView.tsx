
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { Task, Event, Personality, Language, TaskPriority, KnowledgeBase } from '../types';
import ItemDetailModal from '../components/ItemDetailModal';
import { getT } from '../translations';
import { isItemOnDate } from '../utils/dateUtils';

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

interface TasksViewProps {
  tasks: Task[];
  events?: Event[];
  personality: Personality;
  language: Language;
  knowledgeBase: KnowledgeBase;
  onUpdateKnowledgeBase: (kb: KnowledgeBase) => void;
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
  tasks, events = [], language, knowledgeBase, onUpdateKnowledgeBase, onDeleteTask, onEditTask, onAddTask, onAddEvent,
  onSyncGoogle, onDisconnectGoogle, isGoogleConnected, lastSyncTime, isSyncing = false
}) => {
  const t = useMemo(() => getT(language), [language]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState(t.tasks.categories[0]);
  const [showInput, setShowInput] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [isAiProcessing, setIsAiProcessing] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<Task | Event | null>(null);
  const [startInEditMode, setStartInEditMode] = useState(false);

  const [touchDragItem, setTouchDragItem] = useState<any>(null);
  const touchTimer = useRef<any>(null);
  const touchStartPos = useRef<{x: number, y: number} | null>(null);

  const [isListening, setIsListening] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recognitionRef = useRef<any>(null);
  const baseInputRef = useRef('');

  useEffect(() => {
    return () => { if (recognitionRef.current) recognitionRef.current.stop(); };
  }, []);

  useEffect(() => {
    let interval: number;
    if (isListening) {
      interval = window.setInterval(() => {
        setRecordingTime(prev => (prev >= 120 ? prev : prev + 1));
      }, 1000);
    } else setRecordingTime(0);
    return () => clearInterval(interval);
  }, [isListening]);

  useEffect(() => {
    if (!touchDragItem) return;
    const handleMove = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
      const touch = e.touches[0];
      setTouchDragItem((prev: any) => prev ? { ...prev, x: touch.clientX, y: touch.clientY } : null);
    };
    const handleEnd = (e: TouchEvent) => {
      const touch = e.changedTouches[0];
      const target = document.elementFromPoint(touch.clientX, touch.clientY);
      const dropZone = target?.closest('[data-drop-zone]') as HTMLElement;
      if (dropZone) {
        const newP = dropZone.getAttribute('data-drop-zone') as TaskPriority;
        if (newP && newP !== touchDragItem.priority) onEditTask(touchDragItem.id, { priority: newP });
      }
      setTouchDragItem(null);
    };
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);
    return () => {
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [touchDragItem, onEditTask]);

  const toggleListening = () => {
    if (isListening) { stopListening(); return; }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = language === 'ru' ? 'ru-RU' : 'en-US';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.onstart = () => { setIsListening(true); setRecordingTime(0); baseInputRef.current = newTaskTitle; };
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      let tr = '';
      for (let i = 0; i < event.results.length; ++i) tr += event.results[i][0].transcript;
      if (tr) setNewTaskTitle(baseInputRef.current + (baseInputRef.current && !baseInputRef.current.endsWith(' ') ? ' ' : '') + tr);
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => { if (recognitionRef.current) recognitionRef.current.stop(); setIsListening(false); };

  const priorities: TaskPriority[] = ['urgent', 'high', 'normal', 'low'];
  const quadrantStyles = {
    urgent: { bg: 'bg-[#FFF5F5]', border: 'border-[#FED7D7]', text: 'text-[#9B1C1C]', tab: 'bg-[#FED7D7]' },
    high: { bg: 'bg-[#EFF6FF]', border: 'border-[#BFDBFE]', text: 'text-[#1E40AF]', tab: 'bg-[#BFDBFE]' },
    normal: { bg: 'bg-[#F0FDF4]', border: 'border-[#BBF7D0]', text: 'text-[#166534]', tab: 'bg-[#BBF7D0]' },
    low: { bg: 'bg-[#F4F4F5]', border: 'border-[#E4E4E7]', text: 'text-[#52525B]', tab: 'bg-[#E4E4E7]' }
  };

  const groupedTasks = useMemo(() => {
    const groups: Record<TaskPriority, Task[]> = { urgent: [], high: [], normal: [], low: [] };
    tasks.forEach(task => { groups[task.priority || 'normal'].push(task); });
    return groups;
  }, [tasks]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const resp = await ai.models.generateContent({
        model: 'gemini-flash-lite-latest',
        contents: `Classify: "${newTaskTitle}". JSON with: priority (urgent|high|normal|low), category (Work|Personal|Meeting|Finance)`,
        config: { responseMimeType: "application/json" }
      });
      const res = JSON.parse(resp.text || "{}");
      onAddTask(newTaskTitle, res.category || newTaskCategory, '', undefined, 'none', res.priority || 'normal');
      setNewTaskTitle('');
      setShowInput(false);
    } catch { onAddTask(newTaskTitle, newTaskCategory, '', undefined, 'none', 'normal'); setNewTaskTitle(''); setShowInput(false); } finally { setIsAnalyzing(false); }
  };

  const handleAutoSchedule = async (task: Task) => {
    if (!onAddEvent) return;
    setIsAiProcessing(task.id);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const now = new Date();
      const offset = now.getTimezoneOffset() * 60000;
      const localToday = new Date(now.getTime() - offset).toISOString().split('T')[0];
      const contextEvents = events.filter(e => isItemOnDate(e, localToday)).map(e => ({ title: e.title, start: e.startTime, end: e.endTime }));
      
      const prompt = `
        Role: Scheduler. Find optimal 1-hour slot on ${localToday}.
        Item: "${task.title}" (${task.category}, ${task.priority}).
        Existing Schedule (MANDATORY: NO OVERLAPS): ${JSON.stringify(contextEvents)}
        Constraints: 09:00 to 21:00. 
        Return JSON: { "date": "YYYY-MM-DD", "startTime": "HH:MM", "endTime": "HH:MM", "reason": "why" }
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
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
        onAddEvent({ title: task.title, description: task.description, date: result.date, startTime: result.startTime, endTime: result.endTime });
        onDeleteTask(task.id);
      }
    } catch (e) { alert(t.tasks.autoSchedule.fail); } finally { setIsAiProcessing(null); }
  };

  const renderStack = (priority: TaskPriority) => {
    const items = groupedTasks[priority];
    const style = quadrantStyles[priority];
    return (
      <div key={priority} data-drop-zone={priority} onDragOver={(e)=>e.preventDefault()} onDrop={(e)=>{const tid=e.dataTransfer.getData('text'); onEditTask(tid, {priority})}} className={`flex flex-col rounded-[2rem] shadow-sm transition-all ${style.bg} border ${style.border}`}>
        <div className={`px-5 py-3 flex justify-between items-center border-b ${style.border} bg-white/40 rounded-t-[2rem]`}>
          <h3 className={`text-xs font-black uppercase tracking-widest ${style.text}`}>{t.tasks.priorities[priority].split('(')[0].trim()}</h3>
          <span className="text-[10px] font-bold opacity-60">{items.length}</span>
        </div>
        <div className="relative flex-1 p-4 pb-12 md:overflow-y-auto scrollbar-hide space-y-2">
          {items.map((task, idx) => (
            <div key={task.id} draggable onDragStart={(e)=>e.dataTransfer.setData('text', task.id)} onClick={()=>setExpandedTaskId(expandedTaskId===task.id?null:task.id)} className={`p-4 bg-white border border-charcoal/5 rounded-xl shadow-sm transition-all cursor-pointer ${expandedTaskId===task.id?'scale-105 z-10 shadow-lg':''}`}>
              <div className="flex justify-between items-center">
                <span className={`text-sm font-bold truncate ${task.completed?'line-through opacity-40':''}`}>{task.title}</span>
                <span className="material-symbols-outlined text-charcoal/20">{expandedTaskId===task.id?'expand_less':'expand_more'}</span>
              </div>
              {expandedTaskId===task.id && (
                <div className="mt-4 pt-4 border-t border-charcoal/5 flex justify-end gap-2">
                  <button onClick={(e)=>{e.stopPropagation(); setStartInEditMode(true); setSelectedItem(task);}} className="size-8 rounded-lg bg-charcoal/5 flex items-center justify-center hover:bg-charcoal/10 transition-all"><span className="material-symbols-outlined text-sm">edit</span></button>
                  <button onClick={(e)=>{e.stopPropagation(); handleAutoSchedule(task);}} disabled={isAiProcessing===task.id} className="h-8 px-3 rounded-lg bg-primary text-charcoal text-[9px] font-black uppercase flex items-center gap-1 transition-all"><span className={`material-symbols-outlined text-sm ${isAiProcessing===task.id?'animate-spin':''}`}>{isAiProcessing===task.id?'sync':'auto_awesome'}</span>{t.tasks.autoSchedule.button}</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 px-4 md:px-0 relative h-full flex flex-col">
      <ItemDetailModal item={selectedItem} onClose={()=>{setSelectedItem(null);setStartInEditMode(false);}} onEdit={onEditTask} language={language} initialEditMode={startInEditMode} />
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 h-auto md:h-20 shrink-0">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-display font-extrabold tracking-tight text-charcoal">{t.tasks.title}</h1>
          <p className="text-charcoal/40 text-sm font-medium">{t.tasks.activeFor}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onSyncGoogle} disabled={isSyncing} className="px-4 py-2 bg-white border border-charcoal/5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all"><span className={`material-symbols-outlined text-sm ${isSyncing?'animate-spin':''}`}>{isSyncing?'sync':'sync'}</span>{isSyncing?t.common.syncing:t.common.syncNow}</button>
          <button onClick={()=>setShowInput(!showInput)} className="px-6 py-3 bg-charcoal text-cream rounded-2xl font-bold uppercase tracking-widest text-[11px] shadow-lg">{showInput?t.tasks.cancel:t.tasks.newTask}</button>
        </div>
      </header>
      {showInput && (
        <form onSubmit={handleAdd} className="bg-white p-6 rounded-[2rem] border border-primary/20 shadow-xl z-50 animate-in slide-in-from-top-4">
           <div className="relative mb-4">
              <input autoFocus className="w-full bg-transparent border-none focus:ring-0 text-xl font-bold" placeholder={isListening?t.chat.listening:t.tasks.placeholder} value={newTaskTitle} onChange={(e)=>setNewTaskTitle(e.target.value)} readOnly={isListening} />
              <button type="button" onClick={toggleListening} className={`absolute right-0 top-1/2 -translate-y-1/2 size-10 rounded-xl flex items-center justify-center ${isListening?'bg-red-500 text-white':'text-charcoal/20'}`}><span className="material-symbols-outlined">{isListening?'stop':'mic'}</span></button>
           </div>
           <button type="submit" disabled={!newTaskTitle.trim()||isAnalyzing} className="w-full py-3 bg-primary text-charcoal font-bold uppercase text-[10px] rounded-xl transition-all">{isAnalyzing?t.tasks.analyzing:t.tasks.accept}</button>
        </form>
      )}
      <div className="flex-1 md:grid md:grid-cols-2 md:grid-rows-2 gap-6 pb-32 md:pb-0 overflow-y-auto md:overflow-visible scrollbar-hide">
        {priorities.map(p => renderStack(p))}
      </div>
    </div>
  );
};

export default TasksView;
