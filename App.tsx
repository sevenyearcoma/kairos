
import React, { useState, useMemo, useEffect } from 'react';
import { Routes, Route, useLocation, Link } from 'react-router-dom';
import ChatView from './views/ChatView';
import CalendarView from './views/CalendarView';
import TasksView from './views/TasksView';
import FocusView from './views/FocusView';
import BottomNav from './components/BottomNav';
import { Event, Task, ChatMessage, ChatSession, Personality, Language } from './types';
import { isItemOnDate } from './utils/dateUtils';
import { getT } from './translations';

const TODAY = "2026-02-17";

const INITIAL_EVENTS: Event[] = [
  { id: '1', title: 'Board Strategy Review', date: TODAY, startTime: '09:30 AM', endTime: '10:30 AM', location: 'Conference Room B', type: 'work', source: 'local' },
  { id: '2', title: 'Product Sync', date: TODAY, startTime: '12:00 PM', endTime: '01:00 PM', location: 'Virtual', type: 'meeting', source: 'local' },
  { id: '3', title: 'Morning Yoga', date: '2026-02-01', startTime: '07:00 AM', endTime: '08:00 AM', type: 'personal', recurrence: 'daily' },
];

const INITIAL_TASKS: Task[] = [
  { id: 't1', title: 'Review Q4 Strategy', date: TODAY, time: '10:00 AM', category: 'Work', completed: false, rescheduleCount: 0, estimatedMinutes: 60 },
  { id: 't2', title: 'Call with Marcus', date: TODAY, time: '2:00 PM', category: 'Personal', completed: false, rescheduleCount: 1, estimatedMinutes: 30 },
];

const App: React.FC = () => {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('kairos_lang');
    return (saved as Language) || 'en';
  });

  const t = useMemo(() => getT(language), [language]);

  const [events, setEvents] = useState<Event[]>(() => {
    const saved = localStorage.getItem('kairos_events');
    return saved ? JSON.parse(saved) : INITIAL_EVENTS;
  });
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('kairos_tasks');
    return saved ? JSON.parse(saved) : INITIAL_TASKS;
  });
  const [chats, setChats] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('kairos_chats');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeChatId, setActiveChatId] = useState<string>(() => {
    const saved = localStorage.getItem('kairos_active_chat');
    return saved || '';
  });
  const [memory, setMemory] = useState<string[]>(() => {
    const saved = localStorage.getItem('kairos_memory');
    return saved ? JSON.parse(saved) : [];
  });
  const [personality, setPersonality] = useState<Personality>(() => {
    const saved = localStorage.getItem('kairos_personality');
    return saved ? JSON.parse(saved) : {
      trust: 75,
      respect: 65,
      strictness: 20,
      burnoutRisk: 15,
      efficiency: 82
    };
  });
  
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const location = useLocation();

  useEffect(() => localStorage.setItem('kairos_lang', language), [language]);
  useEffect(() => localStorage.setItem('kairos_events', JSON.stringify(events)), [events]);
  useEffect(() => localStorage.setItem('kairos_tasks', JSON.stringify(tasks)), [tasks]);
  useEffect(() => localStorage.setItem('kairos_chats', JSON.stringify(chats)), [chats]);
  useEffect(() => localStorage.setItem('kairos_active_chat', activeChatId), [activeChatId]);
  useEffect(() => localStorage.setItem('kairos_memory', JSON.stringify(memory)), [memory]);
  useEffect(() => localStorage.setItem('kairos_personality', JSON.stringify(personality)), [personality]);

  useEffect(() => {
    if (chats.length === 0) {
      const initialId = Date.now().toString();
      setChats([{
        id: initialId,
        title: language === 'en' ? 'Morning Briefing' : 'Утренний брифинг',
        messages: [{
          id: '1',
          role: 'assistant',
          content: t.chat.initialMsg
        }],
        createdAt: Date.now()
      }]);
      setActiveChatId(initialId);
    }
  }, []);

  const activeChat = useMemo(() => 
    chats.find(c => c.id === activeChatId) || chats[0], 
  [chats, activeChatId]);

  useEffect(() => {
    const todayTasks = tasks.filter(t => isItemOnDate(t, TODAY) && !t.completed);
    const totalMinutes = todayTasks.reduce((acc, t) => acc + (t.estimatedMinutes || 45), 0);
    const density = Math.min(100, (totalMinutes / 480) * 100); 
    const totalReschedules = tasks.reduce((acc, t) => acc + (t.rescheduleCount || 0), 0);
    
    setPersonality(prev => ({
      ...prev,
      burnoutRisk: Math.round(density + (totalReschedules * 2)),
      efficiency: Math.max(0, 100 - (totalReschedules * 5))
    }));
  }, [tasks, events]);

  const handleUpdateChatMessages = (chatId: string, messages: ChatMessage[], newTitle?: string) => {
    setChats(prev => prev.map(c => 
      c.id === chatId 
        ? { ...c, messages, title: newTitle || c.title } 
        : c
    ));
  };

  const handleAddEvent = (eventData: Partial<Event>) => {
    const newEvent: Event = {
      id: Date.now().toString(),
      title: eventData.title || 'New Event',
      date: eventData.date || TODAY,
      startTime: eventData.startTime || '10:00 AM',
      endTime: eventData.endTime || '11:00 AM',
      location: eventData.location || 'TBD',
      type: eventData.type || 'work',
      source: 'local',
      recurrence: eventData.recurrence || 'none',
      daysOfWeek: eventData.daysOfWeek,
      dayOfMonth: eventData.dayOfMonth
    };
    setEvents(prev => [...prev, newEvent]);
  };

  const handleAddTask = (title: string, category: string = 'Personal', date: string = TODAY, description?: string, recurrence?: Task['recurrence'], estimatedMinutes: number = 45) => {
    setTasks(prev => [...prev, { 
      id: Date.now().toString(), 
      title, date, time: 'As scheduled', 
      category, completed: false, rescheduleCount: 0, 
      description, recurrence, estimatedMinutes 
    }]);
  };

  const handleToggleTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed, failed: false } : t));
  };

  const handleRescheduleTask = (taskId: string, newDate: string, isExternal: boolean = false) => {
    setTasks(prev => prev.map(t => 
      t.id === taskId 
        ? { ...t, date: newDate, rescheduleCount: (t.rescheduleCount || 0) + 1 } 
        : t
    ));
  };

  const handleBulkReschedule = (taskIds: string[], eventIds: string[], newDate: string, isExternal: boolean = false) => {
    setTasks(prev => prev.map(t => 
      taskIds.includes(t.id) 
        ? { ...t, date: newDate, rescheduleCount: (t.rescheduleCount || 0) + 1 } 
        : t
    ));
    setEvents(prev => prev.map(e => 
      eventIds.includes(e.id) 
        ? { ...e, date: newDate } 
        : e
    ));
  };

  return (
    <div className="flex h-screen w-full bg-cream text-charcoal overflow-hidden">
      <aside className="hidden md:flex flex-col w-72 border-r border-charcoal/5 bg-white/50 sticky top-0 h-screen p-8 shrink-0 overflow-y-auto scrollbar-hide">
        <div className="flex items-center gap-3 mb-12">
          <div className="size-10 bg-charcoal rounded-xl flex items-center justify-center text-cream shadow-2xl">
            <span className="material-symbols-outlined text-xl">hourglass_empty</span>
          </div>
          <span className="font-display font-black text-2xl tracking-tighter uppercase">Kairos</span>
        </div>

        <nav className="flex-1 space-y-2">
          <Link to="/" className={`flex items-center gap-4 px-5 py-4 rounded-2xl text-[12px] font-extrabold uppercase tracking-widest transition-all ${location.pathname === '/' ? 'bg-charcoal text-cream shadow-xl' : 'text-charcoal/40 hover:bg-charcoal/5 hover:text-charcoal'}`}>
            <span className="material-symbols-outlined text-[22px]">chat_bubble</span>
            {t.nav.secretary}
          </Link>
          <Link to="/calendar" className={`flex items-center gap-4 px-5 py-4 rounded-2xl text-[12px] font-extrabold uppercase tracking-widest transition-all ${location.pathname === '/calendar' ? 'bg-charcoal text-cream shadow-xl' : 'text-charcoal/40 hover:bg-charcoal/5 hover:text-charcoal'}`}>
            <span className="material-symbols-outlined text-[22px]">calendar_today</span>
            {t.nav.calendar}
          </Link>
          <Link to="/tasks" className={`flex items-center gap-4 px-5 py-4 rounded-2xl text-[12px] font-extrabold uppercase tracking-widest transition-all ${location.pathname === '/tasks' ? 'bg-charcoal text-cream shadow-xl' : 'text-charcoal/40 hover:bg-charcoal/5 hover:text-charcoal'}`}>
            <span className="material-symbols-outlined text-[22px]">task_alt</span>
            {t.nav.tasks}
          </Link>
          <Link to="/focus" className={`flex items-center gap-4 px-5 py-4 rounded-2xl text-[12px] font-extrabold uppercase tracking-widest transition-all ${location.pathname === '/focus' ? 'bg-charcoal text-cream shadow-xl' : 'text-charcoal/40 hover:bg-charcoal/5 hover:text-charcoal'}`}>
            <span className="material-symbols-outlined text-[22px]">target</span>
            {t.nav.focus}
          </Link>
        </nav>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col relative bg-white/30 h-screen h-[100dvh] overflow-hidden">
        <header className="h-20 border-b border-charcoal/5 flex items-center px-6 md:px-10 justify-between bg-white/80 backdrop-blur-xl sticky top-0 z-40 shrink-0">
           <div className="flex items-center gap-4">
              <h1 className="text-[11px] font-black uppercase tracking-[0.25em] text-charcoal/20">{t.nav.assistant}</h1>
           </div>
           <div className="flex items-center gap-4">
              <div className="flex bg-beige-soft border border-charcoal/5 rounded-full p-1 mr-2">
                 <button 
                  onClick={() => setLanguage('en')}
                  className={`px-3 py-1 text-[10px] font-black rounded-full transition-all ${language === 'en' ? 'bg-charcoal text-cream' : 'text-charcoal/30'}`}
                 >EN</button>
                 <button 
                  onClick={() => setLanguage('ru')}
                  className={`px-3 py-1 text-[10px] font-black rounded-full transition-all ${language === 'ru' ? 'bg-charcoal text-cream' : 'text-charcoal/30'}`}
                 >RU</button>
              </div>
              <div className="px-4 py-1.5 bg-beige-soft border border-charcoal/5 rounded-full hidden sm:block">
                <span className="text-[10px] font-black text-charcoal/40 uppercase tracking-widest">
                  {new Date(TODAY).toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
           </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-12 pb-32 md:pb-12 scrollbar-hide">
          <div className="max-w-6xl mx-auto h-full">
            <Routes>
              <Route path="/" element={
                activeChat && <ChatView 
                  activeChat={activeChat} 
                  chats={chats}
                  personality={personality}
                  tasks={tasks}
                  events={events}
                  memory={memory}
                  language={language}
                  onSetActiveChat={setActiveChatId}
                  onNewChat={() => {
                    const newId = Date.now().toString();
                    setChats(prev => [{ id: newId, title: language === 'en' ? 'New Conversation' : 'Новый разговор', messages: [], createdAt: Date.now() }, ...prev]);
                    setActiveChatId(newId);
                  }}
                  onDeleteChat={(id) => setChats(prev => prev.filter(c => c.id !== id))}
                  onUpdateMessages={handleUpdateChatMessages}
                  onAddEvent={handleAddEvent}
                  onAddTask={handleAddTask}
                  onRescheduleTask={handleRescheduleTask}
                  onBulkReschedule={handleBulkReschedule}
                  onAddMemory={(f) => setMemory(prev => [...prev, f])}
                />
              } />
              <Route path="/calendar" element={<CalendarView events={events} tasks={tasks} language={language} onDeleteEvent={(id) => setEvents(prev => prev.filter(e => e.id !== id))} onAddEvent={handleAddEvent} onAddTask={handleAddTask} onEditEvent={(id, updates) => setEvents(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e))} onSyncGoogle={() => setIsGoogleConnected(true)} isGoogleConnected={isGoogleConnected} />} />
              <Route path="/tasks" element={<TasksView tasks={tasks} personality={personality} language={language} onToggleTask={handleToggleTask} onDeleteTask={(id) => setTasks(prev => prev.filter(t => t.id !== id))} onAddTask={handleAddTask} onRescheduleTask={handleRescheduleTask} onFailTask={(id) => setTasks(prev => prev.map(t => t.id === id ? { ...t, failed: true } : t))} onEditTask={(id, updates) => setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))} />} />
              <Route path="/focus" element={<FocusView tasks={tasks.filter(t => !t.completed && isItemOnDate(t, TODAY))} events={events.filter(e => isItemOnDate(e, TODAY))} language={language} onComplete={handleToggleTask} />} />
            </Routes>
          </div>
        </div>
        <BottomNav currentPath={location.pathname} language={language} />
      </main>
    </div>
  );
};

export default App;
