
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Routes, Route, useLocation, Link } from 'react-router-dom';
import ChatView from './views/ChatView';
import CalendarView from './views/CalendarView';
import TasksView from './views/TasksView';
import FocusView from './views/FocusView';
import BottomNav from './components/BottomNav';
import { Event, Task, ChatMessage, ChatSession, Personality, Language, MemoryItem } from './types';
import { isItemOnDate } from './utils/dateUtils';
import { getT } from './translations';
import { GoogleGenAI } from '@google/genai';

const App: React.FC = () => {
  const TODAY = useMemo(() => new Date().toISOString().split('T')[0], []);

  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('kairos_lang');
    return (saved as Language) || 'en';
  });

  const t = useMemo(() => getT(language), [language]);

  const [events, setEvents] = useState<Event[]>(() => {
    const saved = localStorage.getItem('kairos_events');
    return saved ? JSON.parse(saved) : [];
  });
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('kairos_tasks');
    return saved ? JSON.parse(saved) : [];
  });
  const [chats, setChats] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('kairos_chats');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeChatId, setActiveChatId] = useState<string>(() => {
    const saved = localStorage.getItem('kairos_active_chat');
    return saved || '';
  });
  const [memory, setMemory] = useState<MemoryItem[]>(() => {
    const saved = localStorage.getItem('kairos_memory_v2');
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
  
  const [isGoogleConnected, setIsGoogleConnected] = useState(() => {
    return !!localStorage.getItem('kairos_google_token');
  });

  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => {
    return localStorage.getItem('kairos_last_sync');
  });

  const activeChat = useMemo(() => {
    if (!chats.length) return null;
    return chats.find(c => c.id === activeChatId) || chats[0];
  }, [chats, activeChatId]);

  const location = useLocation();
  const tokenClient = useRef<any>(null);

  useEffect(() => localStorage.setItem('kairos_lang', language), [language]);
  useEffect(() => localStorage.setItem('kairos_events', JSON.stringify(events)), [events]);
  useEffect(() => localStorage.setItem('kairos_tasks', JSON.stringify(tasks)), [tasks]);
  useEffect(() => localStorage.setItem('kairos_chats', JSON.stringify(chats)), [chats]);
  useEffect(() => localStorage.setItem('kairos_active_chat', activeChatId), [activeChatId]);
  useEffect(() => localStorage.setItem('kairos_memory_v2', JSON.stringify(memory)), [memory]);
  useEffect(() => localStorage.setItem('kairos_personality', JSON.stringify(personality)), [personality]);
  useEffect(() => {
    if (lastSyncTime) localStorage.setItem('kairos_last_sync', lastSyncTime);
  }, [lastSyncTime]);

  const handleUpdateChatMessages = (chatId: string, messages: ChatMessage[], newTitle?: string) => {
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages, title: newTitle || c.title } : c));
  };

  const handleSetMessageSynced = (chatId: string, messageId: string) => {
    setChats(prev => prev.map(c => {
      if (c.id !== chatId) return c;
      return {
        ...c,
        messages: c.messages.map(m => m.id === messageId ? { ...m, isSynced: true } : m)
      };
    }));
  };

  const handleAddMemoryItem = useCallback((item: MemoryItem) => {
    setMemory(prev => [item, ...prev].slice(0, 100));
  }, []);

  const convertTimeToGoogle = (dateStr: string, timeStr: string) => {
    if (!timeStr || timeStr === 'All Day') return { date: dateStr };
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':');
    let h = parseInt(hours, 10);
    if (modifier === 'PM' && h < 12) h += 12;
    if (modifier === 'AM' && h === 12) h = 0;
    return { 
      dateTime: `${dateStr}T${h.toString().padStart(2, '0')}:${minutes}:00`, 
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone 
    };
  };

  const fetchGoogleTasks = async (token: string) => {
    try {
      const response = await fetch('https://www.googleapis.com/tasks/v1/lists/@default/tasks', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        if (response.status === 401) throw new Error('Unauthorized');
        throw new Error('Failed to fetch tasks');
      }
      const data = await response.json();
      if (data.items) {
        const googleTasks: Task[] = data.items.map((item: any) => ({
          id: `google-task-${item.id}`,
          externalId: item.id,
          title: item.title || 'Untitled Task',
          date: item.due ? item.due.split('T')[0] : TODAY,
          time: '09:00 AM',
          category: 'Google',
          completed: item.status === 'completed',
          description: item.notes || '',
          source: 'google',
          recurrence: 'none'
        }));

        setTasks(prev => {
          const nonGoogle = prev.filter(t => t.source !== 'google');
          return [...nonGoogle, ...googleTasks];
        });
      }
    } catch (error: any) {
      console.error("Task Sync error:", error);
      if (error.message === 'Unauthorized') {
        setIsGoogleConnected(false);
        localStorage.removeItem('kairos_google_token');
      }
    }
  };

  const fetchGoogleEvents = async (token: string) => {
    try {
      const timeMin = new Date();
      timeMin.setMonth(timeMin.getMonth() - 1);
      
      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin.toISOString()}&singleEvents=true&orderBy=startTime`, { 
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      
      if (!response.ok) {
        if (response.status === 401) throw new Error('Unauthorized');
        throw new Error('Failed to fetch events');
      }
      
      const data = await response.json();
      if (data.items) {
        const googleEvents: Event[] = data.items.map((item: any) => {
          const start = item.start?.dateTime || item.start?.date;
          return {
            id: `google-${item.id}`,
            externalId: item.id,
            title: item.summary || 'Untitled Event',
            date: start ? start.split('T')[0] : TODAY,
            startTime: item.start?.dateTime ? new Date(item.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'All Day',
            endTime: item.end?.dateTime ? new Date(item.end.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'All Day',
            location: item.location || '',
            type: 'meeting',
            source: 'google',
            description: item.description || ''
          };
        });

        setEvents(prev => {
          const nonGoogle = prev.filter(e => e.source !== 'google');
          return [...nonGoogle, ...googleEvents];
        });
      }
    } catch (error: any) {
      console.error("Event Sync error:", error);
      if (error.message === 'Unauthorized') {
        setIsGoogleConnected(false);
        localStorage.removeItem('kairos_google_token');
      }
    }
  };

  const fetchAllGoogleData = async (token: string) => {
    await Promise.all([fetchGoogleEvents(token), fetchGoogleTasks(token)]);
    setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  };

  const createGoogleTask = async (task: Task) => {
    const token = localStorage.getItem('kairos_google_token');
    if (!token) return null;
    try {
      const response = await fetch('https://www.googleapis.com/tasks/v1/lists/@default/tasks', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: task.title,
          notes: task.description,
          due: `${task.date}T00:00:00.000Z`,
          status: task.completed ? 'completed' : 'needsAction'
        })
      });
      if (response.ok) {
        const data = await response.json();
        return data.id;
      }
    } catch (e) { console.error("Error creating Google task:", e); }
    return null;
  };

  const updateGoogleTask = async (task: Task) => {
    const token = localStorage.getItem('kairos_google_token');
    if (!token || !task.externalId) return false;
    try {
      const response = await fetch(`https://www.googleapis.com/tasks/v1/lists/@default/tasks/${task.externalId}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: task.title,
          notes: task.description,
          due: `${task.date}T00:00:00.000Z`,
          status: task.completed ? 'completed' : 'needsAction'
        })
      });
      return response.ok;
    } catch (e) { console.error("Error updating Google task:", e); return false; }
  };

  const deleteGoogleTask = async (externalId: string) => {
    const token = localStorage.getItem('kairos_google_token');
    if (!token || !externalId) return false;
    try {
      const response = await fetch(`https://www.googleapis.com/tasks/v1/lists/@default/tasks/${externalId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return response.ok;
    } catch (e) { console.error("Error deleting Google task:", e); return false; }
  };

  const createGoogleEvent = async (event: Event) => {
    const token = localStorage.getItem('kairos_google_token');
    if (!token) return null;

    try {
      let recurrenceRule: string[] | undefined;
      if (event.recurrence && event.recurrence !== 'none') {
        let rule = 'RRULE:FREQ=';
        if (event.recurrence === 'daily') rule += 'DAILY';
        else if (event.recurrence === 'weekly') rule += 'WEEKLY';
        else if (event.recurrence === 'weekdays') rule += 'WEEKLY;BYDAY=MO,TU,WE,TH,FR';
        else if (event.recurrence === 'monthly') rule += 'MONTHLY';
        else if (event.recurrence === 'specific_days' && event.daysOfWeek) {
          const daysMap = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
          rule += `WEEKLY;BYDAY=${event.daysOfWeek.map(d => daysMap[d]).join(',')}`;
        }
        recurrenceRule = [rule];
      }

      const googleEventResource = {
        summary: event.title,
        location: event.location,
        description: event.description,
        start: convertTimeToGoogle(event.date, event.startTime),
        end: convertTimeToGoogle(event.date, event.endTime),
        recurrence: recurrenceRule
      };

      const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(googleEventResource)
      });

      if (response.ok) {
        const data = await response.json();
        return data.id;
      }
    } catch (error) {
      console.error("Error creating Google event:", error);
    }
    return null;
  };

  const updateGoogleEvent = async (event: Event) => {
    const token = localStorage.getItem('kairos_google_token');
    if (!token || !event.externalId) return false;

    try {
      const googleEventResource = {
        summary: event.title,
        location: event.location,
        description: event.description,
        start: convertTimeToGoogle(event.date, event.startTime),
        end: convertTimeToGoogle(event.date, event.endTime),
      };

      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${event.externalId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(googleEventResource)
      });

      return response.ok;
    } catch (error) {
      console.error("Error updating Google event:", error);
      return false;
    }
  };

  const deleteGoogleEvent = async (externalId: string) => {
    const token = localStorage.getItem('kairos_google_token');
    if (!token || !externalId) return false;

    try {
      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${externalId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return response.ok;
    } catch (error) {
      console.error("Error deleting Google event:", error);
      return false;
    }
  };

  const handleDisconnectGoogle = () => {
    localStorage.removeItem('kairos_google_token');
    localStorage.removeItem('kairos_last_sync');
    setIsGoogleConnected(false);
    setLastSyncTime(null);
    setEvents(prev => prev.filter(e => e.source !== 'google'));
    setTasks(prev => prev.filter(t => t.source !== 'google'));
  };

  useEffect(() => {
    const initGIS = () => {
      // @ts-ignore
      if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
        // @ts-ignore
        tokenClient.current = google.accounts.oauth2.initTokenClient({
          client_id: '1069276372995-f4l3c28vafgmikmjm5ng0ucrh0epv4ms.apps.googleusercontent.com',
          scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/tasks',
          callback: async (response: any) => {
            if (response.error) return;
            localStorage.setItem('kairos_google_token', response.access_token);
            setIsGoogleConnected(true);
            await fetchAllGoogleData(response.access_token);
          },
        });

        const existingToken = localStorage.getItem('kairos_google_token');
        if (existingToken) {
          fetchAllGoogleData(existingToken);
        }
      }
    };
    
    const checkInterval = setInterval(() => {
      // @ts-ignore
      if (typeof google !== 'undefined' && google.accounts) {
        initGIS();
        clearInterval(checkInterval);
      }
    }, 500);
    return () => clearInterval(checkInterval);
  }, []);

  const handleSyncGoogle = useCallback(() => {
    const token = localStorage.getItem('kairos_google_token');
    if (token) fetchAllGoogleData(token);
    else if (tokenClient.current) tokenClient.current.requestAccessToken(); 
  }, []);

  const handleAddEvent = async (event: Partial<Event>) => {
    const newId = Date.now().toString();
    const newEvent: Event = {
      id: newId,
      title: event.title || 'Untitled',
      date: event.date || TODAY,
      startTime: event.startTime || '10:00 AM',
      endTime: event.endTime || '11:00 AM',
      type: event.type || 'work',
      source: 'local',
      ...event
    };
    
    if (isGoogleConnected) {
      const externalId = await createGoogleEvent(newEvent);
      if (externalId) {
        newEvent.externalId = externalId;
        newEvent.source = 'google';
        newEvent.id = `google-${externalId}`;
      }
    }
    setEvents(prev => [...prev, newEvent]);
  };

  const handleUpdateEvent = async (id: string, updates: Partial<Event>) => {
    const existing = events.find(e => e.id === id);
    if (!existing) return;

    const updatedEvent = { ...existing, ...updates };
    setEvents(prev => prev.map(e => e.id === id ? updatedEvent : e));

    if (updatedEvent.source === 'google' && isGoogleConnected) {
      await updateGoogleEvent(updatedEvent);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    const existing = events.find(e => e.id === id);
    if (existing?.source === 'google' && existing.externalId && isGoogleConnected) {
      await deleteGoogleEvent(existing.externalId);
    }
    setEvents(prev => prev.filter(e => e.id !== id));
  };

  const handleAddTask = async (title: string, category: string, date: string, description?: string, recurrence?: Task['recurrence'], estimatedMinutes?: number, daysOfWeek?: number[]) => {
    const newTask: Task = {
      id: Date.now().toString(),
      title,
      category,
      date,
      time: '09:00 AM',
      completed: false,
      description,
      recurrence: recurrence || 'none',
      daysOfWeek,
      estimatedMinutes: estimatedMinutes || 45,
      source: 'local'
    };
    
    if (isGoogleConnected) {
      const externalId = await createGoogleTask(newTask);
      if (externalId) {
        newTask.externalId = externalId;
        newTask.source = 'google';
        newTask.id = `google-task-${externalId}`;
      }
    }
    setTasks(prev => [...prev, newTask]);
  };

  const handleToggleTask = async (id: string) => {
    const existing = tasks.find(t => t.id === id);
    if (!existing) return;
    const updated = { ...existing, completed: !existing.completed };
    setTasks(prev => prev.map(t => t.id === id ? updated : t));
    if (updated.source === 'google' && updated.externalId && isGoogleConnected) {
      await updateGoogleTask(updated);
    }
  };

  const handleUpdateTask = async (id: string, updates: Partial<Task>) => {
    const existing = tasks.find(t => t.id === id);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    setTasks(prev => prev.map(t => t.id === id ? updated : t));
    if (updated.source === 'google' && updated.externalId && isGoogleConnected) {
      await updateGoogleTask(updated);
    }
  };

  const handleDeleteTask = async (id: string) => {
    const existing = tasks.find(t => t.id === id);
    if (existing?.source === 'google' && existing.externalId && isGoogleConnected) {
      await deleteGoogleTask(existing.externalId);
    }
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const handleRescheduleTask = async (taskId: string, newDate: string) => {
    const existing = tasks.find(t => t.id === taskId);
    if (!existing) return;
    const updated = { ...existing, date: newDate, rescheduleCount: (existing.rescheduleCount || 0) + 1 };
    setTasks(prev => prev.map(t => t.id === taskId ? updated : t));
    if (updated.source === 'google' && updated.externalId && isGoogleConnected) {
      await updateGoogleTask(updated);
    }
  };

  const handleNewChat = () => {
    const newId = Date.now().toString();
    const initialMsg = language === 'ru' ? "Привет! Я готов помочь тебе организовать дела. Что запланируем?" : "Hello! I'm here to help you organize your life. What's on your mind?";
    setChats(prev => [{ id: newId, title: language === 'en' ? 'New Conversation' : 'Новый разговор', messages: [{ id: Date.now().toString(), role: 'assistant', content: initialMsg }], createdAt: Date.now() }, ...prev]);
    setActiveChatId(newId);
  };

  const handleDeleteChat = (id: string) => {
    setChats(prev => prev.filter(c => c.id !== id));
    if (activeChatId === id) setActiveChatId('');
  };

  useEffect(() => {
    if (chats.length === 0) {
      handleNewChat();
    }
  }, []);

  return (
    <div className="flex h-screen w-full bg-cream text-charcoal overflow-hidden">
      <aside className="hidden md:flex flex-col w-72 border-r border-charcoal/5 bg-white/50 sticky top-0 h-screen p-8 shrink-0 overflow-y-auto scrollbar-hide">
        <div className="flex items-center gap-3 mb-12">
          <div className="size-10 bg-charcoal rounded-xl flex items-center justify-center text-primary shadow-2xl">
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

      <main className="flex-1 min-w-0 flex flex-col relative bg-white/30 h-screen overflow-hidden">
        <header className="h-20 border-b border-charcoal/5 flex items-center px-6 md:px-10 justify-between bg-white/80 backdrop-blur-xl sticky top-0 z-40 shrink-0">
           <div className="flex items-center gap-4">
              <h1 className="text-[11px] font-black uppercase tracking-[0.25em] text-charcoal/20">{t.nav.assistant}</h1>
           </div>
           <div className="flex items-center gap-4">
              <div className="flex bg-beige-soft border border-charcoal/5 rounded-full p-1 mr-2">
                 <button onClick={() => setLanguage('en')} className={`px-3 py-1 text-[10px] font-black rounded-full transition-all ${language === 'en' ? 'bg-charcoal text-cream' : 'text-charcoal/30'}`}>EN</button>
                 <button onClick={() => setLanguage('ru')} className={`px-3 py-1 text-[10px] font-black rounded-full transition-all ${language === 'ru' ? 'bg-charcoal text-cream' : 'text-charcoal/30'}`}>RU</button>
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
                activeChat ? <ChatView 
                  activeChat={activeChat} 
                  chats={chats}
                  personality={personality}
                  tasks={tasks}
                  events={events}
                  memory={memory}
                  language={language}
                  onSetActiveChat={setActiveChatId}
                  onNewChat={handleNewChat}
                  onDeleteChat={handleDeleteChat}
                  onUpdateMessages={handleUpdateChatMessages}
                  onAddEvent={handleAddEvent}
                  onAddTask={handleAddTask}
                  onRescheduleTask={(id, date) => handleRescheduleTask(id, date)}
                  onBulkReschedule={() => {}}
                  onAddMemory={handleAddMemoryItem}
                  onSetSynced={handleSetMessageSynced}
                /> : <div className="flex items-center justify-center h-full text-charcoal/20 uppercase font-black tracking-widest">Initializing...</div>
              } />
              <Route path="/calendar" element={
                <CalendarView 
                  events={events} 
                  tasks={tasks} 
                  language={language} 
                  onDeleteEvent={handleDeleteEvent} 
                  onAddEvent={handleAddEvent} 
                  onAddTask={(title, cat, date) => handleAddTask(title, cat, date)} 
                  onEditEvent={handleUpdateEvent} 
                  onSyncGoogle={handleSyncGoogle} 
                  onDisconnectGoogle={handleDisconnectGoogle}
                  isGoogleConnected={isGoogleConnected} 
                  lastSyncTime={lastSyncTime}
                />
              } />
              <Route path="/tasks" element={
                <TasksView 
                  tasks={tasks} 
                  personality={personality} 
                  language={language} 
                  onToggleTask={handleToggleTask} 
                  onDeleteTask={handleDeleteTask} 
                  onAddTask={handleAddTask} 
                  onRescheduleTask={handleRescheduleTask} 
                  onFailTask={(id) => handleUpdateTask(id, { failed: true })} 
                  onEditTask={handleUpdateTask} 
                  onSyncGoogle={handleSyncGoogle}
                  onDisconnectGoogle={handleDisconnectGoogle}
                  isGoogleConnected={isGoogleConnected}
                  lastSyncTime={lastSyncTime}
                />
              } />
              <Route path="/focus" element={
                <FocusView 
                  tasks={tasks.filter(t => !t.completed && isItemOnDate(t, TODAY))} 
                  events={events.filter(e => isItemOnDate(e, TODAY))} 
                  language={language} 
                  onComplete={handleToggleTask} 
                />
              } />
            </Routes>
          </div>
        </div>
        <BottomNav currentPath={location.pathname} language={language} />
      </main>
    </div>
  );
};

export default App;
