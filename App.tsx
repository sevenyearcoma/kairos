
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
    // We assume the user's local time for simplicity or UTC
    return { dateTime: `${dateStr}T${h.toString().padStart(2, '0')}:${minutes}:00`, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
  };

  const fetchGoogleEvents = async (token: string) => {
    try {
      const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=' + new Date().toISOString(), { headers: { 'Authorization': `Bearer ${token}` } });
      if (!response.ok) throw new Error('Unauthorized');
      const data = await response.json();
      if (data.items) {
        const googleEvents: Event[] = data.items.map((item: any) => ({
          id: `google-${item.id}`,
          externalId: item.id,
          title: item.summary || 'Untitled Event',
          date: item.start?.date || item.start?.dateTime?.split('T')[0] || TODAY,
          startTime: item.start?.dateTime ? new Date(item.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '10:00 AM',
          endTime: item.end?.dateTime ? new Date(item.end.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '11:00 AM',
          location: item.location || '',
          type: 'meeting',
          source: 'google',
          description: item.description || ''
        }));
        setEvents(prev => {
          const nonGoogle = prev.filter(e => e.source !== 'google');
          return [...nonGoogle, ...googleEvents];
        });
      }
    } catch (error: any) {
      if (error.message === 'Unauthorized') {
        setIsGoogleConnected(false);
        localStorage.removeItem('kairos_google_token');
      }
    }
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

  useEffect(() => {
    const initGIS = () => {
      // @ts-ignore
      if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
        // @ts-ignore
        tokenClient.current = google.accounts.oauth2.initTokenClient({
          client_id: '1069276372995-f4l3c28vafgmikmjm5ng0ucrh0epv4ms.apps.googleusercontent.com',
          scope: 'https://www.googleapis.com/auth/calendar',
          callback: async (response: any) => {
            if (response.error) return;
            localStorage.setItem('kairos_google_token', response.access_token);
            setIsGoogleConnected(true);
            await fetchGoogleEvents(response.access_token);
          },
        });
      }
    };
    const checkInterval = setInterval(() => {
      // @ts-ignore
      if (typeof google !== 'undefined' && google.accounts) {
        initGIS();
        clearInterval(checkInterval);
      }
    }, 1000);
    return () => clearInterval(checkInterval);
  }, []);

  const handleSyncGoogle = useCallback(() => {
    const token = localStorage.getItem('kairos_google_token');
    if (token) fetchGoogleEvents(token);
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

  const handleAddTask = (title: string, category: string, date: string, description?: string, recurrence?: Task['recurrence'], estimatedMinutes?: number, daysOfWeek?: number[]) => {
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
      estimatedMinutes: estimatedMinutes || 45
    };
    setTasks(prev => [...prev, newTask]);
  };

  const handleRescheduleTask = (taskId: string, newDate: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, date: newDate, rescheduleCount: (t.rescheduleCount || 0) + 1 } : t));
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
                  isGoogleConnected={isGoogleConnected} 
                />
              } />
              <Route path="/tasks" element={
                <TasksView 
                  tasks={tasks} 
                  personality={personality} 
                  language={language} 
                  onToggleTask={(id) => setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t))} 
                  onDeleteTask={(id) => setTasks(prev => prev.filter(t => t.id !== id))} 
                  onAddTask={handleAddTask} 
                  onRescheduleTask={handleRescheduleTask} 
                  onFailTask={(id) => setTasks(prev => prev.map(t => t.id === id ? { ...t, failed: true } : t))} 
                  onEditTask={(id, updates) => setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))} 
                />
              } />
              <Route path="/focus" element={
                <FocusView 
                  tasks={tasks.filter(t => !t.completed && isItemOnDate(t, TODAY))} 
                  events={events.filter(e => isItemOnDate(e, TODAY))} 
                  language={language} 
                  onComplete={(id) => setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t))} 
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
