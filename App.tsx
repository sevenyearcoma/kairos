
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Routes, Route, useLocation, Link } from 'react-router-dom';
import ChatView from './views/ChatView';
import CalendarView from './views/CalendarView';
import TasksView from './views/TasksView';
import FocusView from './views/FocusView';
import BottomNav from './components/BottomNav';
import { Event, Task, ChatMessage, ChatSession, Personality, Language, MemoryItem, UserPreferences, TaskPriority, KnowledgeBase } from './types';
import { isItemOnDate } from './utils/dateUtils';
import { getT } from './translations';

declare const google: any;

const GOOGLE_CLIENT_ID = "1069276372995-f4l3c28vafgmikmjm5ng0ucrh0epv4ms.apps.googleusercontent.com";
const GOOGLE_SCOPES = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/tasks";

const App: React.FC = () => {
  // Use local date instead of UTC to ensure "Today" is accurate to the user's timezone
  const TODAY = useMemo(() => {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
  }, []);

  const [language, setLanguage] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('kairos_lang');
      return (saved === 'en' || saved === 'ru') ? saved : 'en';
    } catch { return 'en'; }
  });

  const t = useMemo(() => getT(language), [language]);

  const [prefs, setPrefs] = useState<UserPreferences>(() => {
    try {
      const saved = localStorage.getItem('kairos_prefs');
      return saved ? JSON.parse(saved) : {
        userName: 'User',
        assistantName: 'Kairos',
        theme: 'cream',
        onboardingComplete: false
      };
    } catch (e) {
      console.error("Error loading prefs", e);
      return { userName: 'User', assistantName: 'Kairos', theme: 'cream', onboardingComplete: false };
    }
  });

  const [events, setEvents] = useState<Event[]>(() => {
    try {
      const saved = localStorage.getItem('kairos_events');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem('kairos_tasks');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [chats, setChats] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem('kairos_chats');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [activeChatId, setActiveChatId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('kairos_active_chat');
      return saved || '';
    } catch { return ''; }
  });

  const [memory, setMemory] = useState<MemoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('kairos_memory_v2');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [personality, setPersonality] = useState<Personality>(() => {
    try {
      const saved = localStorage.getItem('kairos_personality');
      return saved ? JSON.parse(saved) : {
        trust: 75,
        respect: 65,
        strictness: 20,
        burnoutRisk: 15,
        efficiency: 82
      };
    } catch {
       return { trust: 75, respect: 65, strictness: 20, burnoutRisk: 15, efficiency: 82 };
    }
  });
  
  // New Knowledge Base Agent State
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBase>(() => {
    try {
      const saved = localStorage.getItem('kairos_knowledge_base');
      if (saved) return JSON.parse(saved);
    } catch (e) { console.error("KB Load Error", e); }
    
    // Default initial state
    return {
      user_name: 'User',
      core_stack: [],
      current_projects: [],
      interests: [],
      preferences: {
        tone: 'Direct, slightly witty'
      }
    };
  });

  const [isGoogleConnected, setIsGoogleConnected] = useState(() => !!localStorage.getItem('kairos_google_token'));
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => localStorage.getItem('kairos_last_sync'));
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);

  const activeChat = useMemo(() => {
    if (!chats.length) return null;
    return chats.find(c => c.id === activeChatId) || chats[0];
  }, [chats, activeChatId]);

  const location = useLocation();
  const tokenClient = useRef<any>(null);

  // --- Dynamic Initial Message Update ---
  useEffect(() => {
    if (activeChat && activeChat.messages.length === 1 && activeChat.messages[0].role === 'assistant') {
      const newInitialMsg = t.chat.initialMsg(prefs.userName, prefs.assistantName);
      if (activeChat.messages[0].content !== newInitialMsg) {
        setChats(prev => prev.map(c => {
          if (c.id === activeChat.id) {
            return {
              ...c,
              title: language === 'en' ? 'New Conversation' : 'Новый разговор',
              messages: [{ ...c.messages[0], content: newInitialMsg }]
            };
          }
          return c;
        }));
      }
    }
  }, [language, t, prefs.userName, prefs.assistantName, activeChatId]);

  const syncGoogleData = useCallback(async (token: string) => {
    setIsSyncing(true);
    try {
      const calendarResponse = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${new Date().toISOString()}&maxResults=50&singleEvents=true&orderBy=startTime`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (!calendarResponse.ok) {
        if (calendarResponse.status === 401) throw new Error('Unauthorized');
        throw new Error(`Calendar API Error: ${calendarResponse.status}`);
      }
      
      const calendarData = await calendarResponse.json();
      const googleEvents: Event[] = (calendarData.items || []).map((item: any) => {
        const start = item.start.dateTime || item.start.date;
        const date = start.split('T')[0];
        const startTime = item.start.dateTime ? new Date(item.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : 'All Day';
        const endTime = item.end.dateTime ? new Date(item.end.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
        return {
          id: `google-${item.id}`,
          externalId: item.id,
          title: item.summary || 'Untitled Google Event',
          date,
          startTime,
          endTime,
          type: 'work',
          source: 'google',
          description: item.description,
          location: item.location
        };
      });

      const tasksResponse = await fetch('https://www.googleapis.com/tasks/v1/lists/@default/tasks?maxResults=50', { headers: { Authorization: `Bearer ${token}` } });
      
      if (!tasksResponse.ok) {
         if (tasksResponse.status === 401) throw new Error('Unauthorized');
         throw new Error(`Tasks API Error: ${tasksResponse.status}`);
      }
      
      const tasksData = await tasksResponse.json();
      const googleTasks: Task[] = (tasksData.items || []).filter((item: any) => item.title).map((item: any) => {
        const date = item.due ? item.due.split('T')[0] : '';
        return { 
          id: `google-${item.id}`, 
          externalId: item.id, 
          title: item.title, 
          category: 'Work', 
          date, 
          completed: item.status === 'completed', 
          description: item.notes, 
          source: 'google',
          priority: 'normal'
        };
      });

      setEvents(prev => [...prev.filter(e => e.source !== 'google'), ...googleEvents]);
      setTasks(prev => [...prev.filter(t => t.source !== 'google'), ...googleTasks]);
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      setLastSyncTime(now);
      localStorage.setItem('kairos_last_sync', now);
      setIsGoogleConnected(true);
      
    } catch (err: any) {
      console.error("Sync failed:", err);
      if (err.message === 'Unauthorized' || err.message.includes('Forbidden')) {
        localStorage.removeItem('kairos_google_token');
        setIsGoogleConnected(false);
      }
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    const initGis = () => {
      if (typeof google !== 'undefined' && !tokenClient.current) {
        try {
          tokenClient.current = google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: GOOGLE_SCOPES,
            callback: (tokenResponse: any) => {
              if (tokenResponse && tokenResponse.access_token) {
                localStorage.setItem('kairos_google_token', tokenResponse.access_token);
                syncGoogleData(tokenResponse.access_token);
              }
            },
          });
        } catch (err) { console.error("GIS Init failed", err); }
      }
    };
    if (typeof google !== 'undefined') initGis();
    else {
      const script = document.querySelector('script[src*="gsi/client"]');
      if (script) script.addEventListener('load', initGis);
    }
  }, [syncGoogleData]);

  useEffect(() => {
    const token = localStorage.getItem('kairos_google_token');
    if (token && !isSyncing) syncGoogleData(token);
  }, []);

  useEffect(() => localStorage.setItem('kairos_lang', language), [language]);
  useEffect(() => localStorage.setItem('kairos_prefs', JSON.stringify(prefs)), [prefs]);
  useEffect(() => localStorage.setItem('kairos_events', JSON.stringify(events)), [events]);
  useEffect(() => localStorage.setItem('kairos_tasks', JSON.stringify(tasks)), [tasks]);
  useEffect(() => localStorage.setItem('kairos_chats', JSON.stringify(chats)), [chats]);
  useEffect(() => localStorage.setItem('kairos_active_chat', activeChatId), [activeChatId]);
  useEffect(() => localStorage.setItem('kairos_memory_v2', JSON.stringify(memory)), [memory]);
  useEffect(() => localStorage.setItem('kairos_personality', JSON.stringify(personality)), [personality]);
  useEffect(() => localStorage.setItem('kairos_knowledge_base', JSON.stringify(knowledgeBase)), [knowledgeBase]);

  const handleUpdateChatMessages = (chatId: string, messages: ChatMessage[], newTitle?: string) => {
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages, title: newTitle || c.title } : c));
  };

  const handleSetMessageSynced = (chatId: string, messageId: string) => {
    setChats(prev => prev.map(c => {
      if (c.id !== chatId) return c;
      return { ...c, messages: c.messages.map(m => m.id === messageId ? { ...m, isSynced: true } : m) };
    }));
  };

  const handleAddMemoryItem = useCallback((item: MemoryItem) => {
    setMemory(prev => [item, ...prev].slice(0, 50));
  }, []);

  const handleSyncGoogle = useCallback(() => {
    const token = localStorage.getItem('kairos_google_token');
    if (token) syncGoogleData(token);
    else if (tokenClient.current) tokenClient.current.requestAccessToken({ prompt: 'consent' });
  }, [syncGoogleData]);

  const handleDisconnectGoogle = useCallback(() => {
    localStorage.removeItem('kairos_google_token');
    localStorage.removeItem('kairos_last_sync');
    setIsGoogleConnected(false);
    setLastSyncTime(null);
    setEvents(prev => prev.filter(e => e.source !== 'google'));
    setTasks(prev => prev.filter(t => t.source !== 'google'));
  }, []);

  const handleAddEvent = async (event: Partial<Event>) => {
    const newId = Date.now().toString();
    const newEvent: Event = { 
      id: newId, 
      title: event.title || 'Untitled', 
      date: event.date || TODAY, 
      startTime: event.startTime || '10:00', 
      endTime: event.endTime || '11:00', 
      type: event.type || 'work', 
      source: 'local',
      ...event 
    };
    setEvents(prev => [...prev, newEvent]);
    if (isGoogleConnected) {
      const token = localStorage.getItem('kairos_google_token');
      if (!token) return;
      try {
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const startDateTime = new Date(`${newEvent.date}T${newEvent.startTime}:00`);
        const endDateTime = new Date(`${newEvent.date}T${newEvent.endTime}:00`);
        const googleEventPayload: any = {
          summary: newEvent.title,
          description: newEvent.description,
          location: newEvent.location,
          start: { dateTime: startDateTime.toISOString(), timeZone },
          end: { endDateTime: endDateTime.toISOString(), timeZone }
        };
        const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(googleEventPayload)
        });
        if (res.ok) {
          const data = await res.json();
          setEvents(prev => prev.map(e => e.id === newId ? { ...e, id: `google-${data.id}`, source: 'google', externalId: data.id } : e));
        }
      } catch (err) { console.error("Failed to add event to Google Calendar:", err); }
    }
  };

  const handleDeleteEvent = async (id: string) => {
    const eventToDelete = events.find(e => e.id === id);
    setEvents(prev => prev.filter(e => e.id !== id));
    if (isGoogleConnected && eventToDelete?.source === 'google' && eventToDelete.externalId) {
      const token = localStorage.getItem('kairos_google_token');
      if (token) {
        try {
           await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventToDelete.externalId}`, {
             method: 'DELETE',
             headers: { 'Authorization': `Bearer ${token}` }
           });
        } catch(e) { console.error("Failed to delete Google Calendar event", e); }
      }
    }
  };

  const handleEditEvent = (id: string, updates: Partial<Event>) => {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  };

  const handleAddTask = async (title: string, category: string, date: string, description?: string, recurrence?: Task['recurrence'], priority?: TaskPriority) => {
    const tempId = Date.now().toString();
    const newTask: Task = { id: tempId, title, category, date, completed: false, description, recurrence: recurrence || 'none', source: 'local', priority: priority || 'normal' };
    setTasks(prev => [...prev, newTask]);
    if (isGoogleConnected) {
       const token = localStorage.getItem('kairos_google_token');
       if (token) {
         try {
           const taskBody: any = { title: title, notes: description || '' };
           if (date) taskBody.due = new Date(date + 'T12:00:00Z').toISOString();
           const res = await fetch('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks', {
             method: 'POST',
             headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
             body: JSON.stringify(taskBody)
           });
           if (res.ok) {
             const data = await res.json();
             setTasks(prev => prev.map(t => t.id === tempId ? { ...t, id: `google-${data.id}`, externalId: data.id, source: 'google' } : t));
           }
         } catch (e) { console.error("Failed to create Google Task", e); }
       }
    }
  };

  const handleToggleTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const newStatus = !task.completed;
    setTasks(prev => prev.map(t => t.id === id ? {...t, completed: newStatus} : t));
    if (isGoogleConnected && task.source === 'google' && task.externalId) {
      const token = localStorage.getItem('kairos_google_token');
      if (token) {
        try {
           await fetch(`https://tasks.googleapis.com/tasks/v1/lists/@default/tasks/${task.externalId}`, {
             method: 'PATCH',
             headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
             body: JSON.stringify({ status: newStatus ? 'completed' : 'needsAction' })
           });
        } catch (e) { console.error("Failed to sync status to Google Task", e); }
      }
    }
  };

  const handleDeleteTask = async (id: string) => {
    const taskToDelete = tasks.find(t => t.id === id);
    setTasks(prev => prev.filter(t => t.id !== id));
    if (taskToDelete && isGoogleConnected && taskToDelete.source === 'google' && taskToDelete.externalId) {
       const token = localStorage.getItem('kairos_google_token');
       if (token) {
          try {
            await fetch(`https://tasks.googleapis.com/tasks/v1/lists/@default/tasks/${taskToDelete.externalId}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` }
            });
          } catch(e) { console.error("Failed to delete Google Task", e); }
       }
    }
  };

  const handleEditTask = (id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const handleNewChat = () => {
    const newId = Date.now().toString();
    const currentT = getT(language);
    const initialMsg = currentT.chat.initialMsg(prefs.userName, prefs.assistantName);
    setChats(prev => [{ id: newId, title: language === 'en' ? 'New Conversation' : 'Новый разговор', messages: [{ id: Date.now().toString(), role: 'assistant', content: initialMsg }], createdAt: Date.now() }, ...prev]);
    setActiveChatId(newId);
  };

  useEffect(() => { if (chats.length === 0) handleNewChat(); }, []);

  return (
    <div className="flex h-screen w-full bg-cream text-charcoal overflow-hidden">
      <aside className="hidden md:flex flex-col w-72 border-r border-charcoal/5 bg-white/50 sticky top-0 h-screen p-8 shrink-0 overflow-y-auto scrollbar-hide">
        <div className="flex items-center gap-3 mb-12">
          <div className="size-10 bg-charcoal rounded-xl flex items-center justify-center text-primary shadow-2xl">
            <span className="material-symbols-outlined text-xl">hourglass_empty</span>
          </div>
          <span className="font-display font-black text-2xl tracking-tighter uppercase">{prefs.assistantName}</span>
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

      <main className="flex-1 min-w-0 flex flex-col relative bg-white/30 h-[100dvh] overflow-hidden">
        <header className="h-20 border-b border-charcoal/5 flex items-center px-6 md:px-10 justify-between bg-white/80 backdrop-blur-xl sticky top-0 z-40 shrink-0">
           <div className="flex items-center gap-4">
              <h1 className="text-[11px] font-black uppercase tracking-[0.25em] text-charcoal/20">{prefs.assistantName} — {prefs.userName}</h1>
           </div>
           <div className="flex items-center gap-2">
              {/* Conditional Auth Header UI */}
              {isGoogleConnected ? (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleSyncGoogle}
                    disabled={isSyncing}
                    title={`${t.common.syncedAt} ${lastSyncTime || '...'}`}
                    className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-primary/5 border border-primary/20 text-primary hover:bg-primary/10 transition-all shadow-sm group"
                  >
                    <span className={`material-symbols-outlined text-[18px] ${isSyncing ? 'animate-spin' : ''}`}>
                      sync
                    </span>
                    <span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline">
                      {isSyncing ? t.common.syncing : t.common.syncNow}
                    </span>
                  </button>
                  <button 
                    onClick={handleDisconnectGoogle}
                    title={t.common.disconnect}
                    className="size-9 flex items-center justify-center rounded-full bg-white border border-charcoal/10 text-charcoal/20 hover:text-red-500 hover:bg-red-50 hover:border-red-200 transition-all shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[18px]">logout</span>
                  </button>
                </div>
              ) : (
                <button 
                  onClick={handleSyncGoogle}
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white border border-charcoal/10 text-charcoal/40 hover:text-charcoal hover:bg-charcoal/5 transition-all shadow-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">cloud_off</span>
                  <span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline">
                    {t.common.linkGoogle}
                  </span>
                </button>
              )}

              <div className="flex bg-beige-soft border border-charcoal/5 rounded-full p-1 ml-2">
                 <button onClick={() => setLanguage('en')} className={`px-3 py-1 text-[10px] font-black rounded-full transition-all ${language === 'en' ? 'bg-charcoal text-cream' : 'text-charcoal/30'}`}>EN</button>
                 <button onClick={() => setLanguage('ru')} className={`px-3 py-1 text-[10px] font-black rounded-full transition-all ${language === 'ru' ? 'bg-charcoal text-cream' : 'text-charcoal/30'}`}>RU</button>
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
                  knowledgeBase={knowledgeBase}
                  language={language}
                  prefs={prefs}
                  isAiThinking={isAiThinking}
                  setIsAiThinking={setIsAiThinking}
                  onSetActiveChat={setActiveChatId}
                  onNewChat={handleNewChat}
                  onDeleteChat={(id) => setChats(prev => prev.filter(c => c.id !== id))}
                  onUpdateMessages={handleUpdateChatMessages}
                  onAddEvent={handleAddEvent}
                  onAddTask={handleAddTask}
                  onRescheduleTask={() => {}}
                  onBulkReschedule={() => {}}
                  onAddMemory={handleAddMemoryItem}
                  onUpdateKnowledgeBase={setKnowledgeBase}
                  onSetSynced={handleSetMessageSynced}
                  onUpdatePrefs={setPrefs}
                /> : <div className="flex items-center justify-center h-full text-[10px] font-black uppercase text-charcoal/20 animate-pulse">{t.chat.initializing}</div>
              } />
              <Route path="/calendar" element={
                <CalendarView 
                  events={events} 
                  tasks={tasks} 
                  language={language} 
                  knowledgeBase={knowledgeBase}
                  onUpdateKnowledgeBase={setKnowledgeBase}
                  onDeleteEvent={handleDeleteEvent} 
                  onAddEvent={handleAddEvent} 
                  onAddTask={handleAddTask} 
                  onEditEvent={handleEditEvent} 
                  onEditTask={handleEditTask}
                  onSyncGoogle={handleSyncGoogle} 
                  onDisconnectGoogle={handleDisconnectGoogle} 
                  isGoogleConnected={isGoogleConnected} 
                  lastSyncTime={lastSyncTime} 
                  isSyncing={isSyncing} 
                />
              } />
              <Route path="/tasks" element={
                <TasksView 
                  tasks={tasks} 
                  events={events} 
                  personality={personality} 
                  language={language} 
                  knowledgeBase={knowledgeBase}
                  onUpdateKnowledgeBase={setKnowledgeBase}
                  onToggleTask={handleToggleTask} 
                  onDeleteTask={handleDeleteTask} 
                  onAddTask={handleAddTask}
                  onAddEvent={handleAddEvent} 
                  onEditTask={handleEditTask}
                  onRescheduleTask={() => {}} 
                  onFailTask={() => {}} 
                  onSyncGoogle={handleSyncGoogle} 
                  onDisconnectGoogle={handleDisconnectGoogle} 
                  isGoogleConnected={isGoogleConnected} 
                  lastSyncTime={lastSyncTime} 
                  isSyncing={isSyncing} 
                />
              } />
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
