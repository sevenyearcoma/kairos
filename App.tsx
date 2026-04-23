
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
import * as TasksApi from './api/tasks';
import * as EventsApi from './api/events';
import * as ChatsApi from './api/chats';
import * as MemoryApi from './api/memory';
import * as KnowledgeApi from './api/knowledge';
import * as PersonalityApi from './api/personality';
import * as PreferencesApi from './api/preferences';
import { getToken } from './api/client';

declare const google: any;

const GOOGLE_CLIENT_ID = "1047896434184-koiits1eutpidijn3n7lj6dqb72kpigj.apps.googleusercontent.com";
const GOOGLE_SCOPES = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/tasks";

const App: React.FC<{ onLogout?: () => void }> = ({ onLogout }) => {
  const TODAY = useMemo(() => {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
  }, []);

  const [language, setLanguage] = useState<Language>('en');

  const t = useMemo(() => getT(language), [language]);

  const [prefs, setPrefs] = useState<UserPreferences>({
    userName: 'User',
    assistantName: 'Kairos',
    theme: 'cream',
    onboardingComplete: false
  });

  const [events, setEvents] = useState<Event[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>('');

  const [memory, setMemory] = useState<MemoryItem[]>([]);

  const [personality, setPersonality] = useState<Personality>({
    trust: 75,
    respect: 65,
    strictness: 20,
    burnoutRisk: 15,
    efficiency: 82
  });

  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBase>({
    user_name: 'User',
    core_stack: [],
    current_projects: [],
    interests: [],
    preferences: { tone: 'Direct, slightly witty' }
  });

  const [isGoogleConnected, setIsGoogleConnected] = useState(() => !!localStorage.getItem('kairos_google_token'));
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => localStorage.getItem('kairos_last_sync'));
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const activeChat = useMemo(() => {
    if (!chats.length) return null;
    return chats.find(c => c.id === activeChatId) || chats[0];
  }, [chats, activeChatId]);

  const location = useLocation();
  const tokenClient = useRef<any>(null);

  // Загрузка всех данных с бэка при старте
  useEffect(() => {
    if (!getToken()) return;
    Promise.allSettled([
      TasksApi.fetchTasks(),
      EventsApi.fetchEvents(),
      MemoryApi.fetchMemory(),
      KnowledgeApi.fetchKnowledgeBase(),
      PersonalityApi.fetchPersonality(),
      PreferencesApi.fetchPreferences(),
      ChatsApi.fetchSessions(),
    ]).then(([tasksRes, eventsRes, memoryRes, kbRes, personalityRes, prefsRes, chatsRes]) => {
      if (tasksRes.status === 'fulfilled') setTasks(tasksRes.value);
      if (eventsRes.status === 'fulfilled') setEvents(eventsRes.value);
      if (memoryRes.status === 'fulfilled') setMemory(memoryRes.value);
      if (kbRes.status === 'fulfilled') setKnowledgeBase(kbRes.value);
      if (personalityRes.status === 'fulfilled') setPersonality(personalityRes.value);
      if (prefsRes.status === 'fulfilled') {
        setLanguage(prefsRes.value.language);
        setPrefs(prefsRes.value.prefs);
      }
      if (chatsRes.status === 'fulfilled' && chatsRes.value.length > 0) {
        setChats(chatsRes.value);
        setActiveChatId(chatsRes.value[0].id);
      }
      setIsDataLoaded(true);
    }).catch(() => { setIsDataLoaded(true); });
  }, []);

  // Синхронизируем personality/kb/prefs на бэк при изменении (если авторизован)
  useEffect(() => {
    if (!getToken()) return;
    PersonalityApi.savePersonality(personality).catch(() => {});
  }, [personality]);

  useEffect(() => {
    if (!getToken()) return;
    KnowledgeApi.saveKnowledgeBase(knowledgeBase).catch(() => {});
  }, [knowledgeBase]);

  useEffect(() => {
    if (!getToken()) return;
    PreferencesApi.savePreferences(prefs, language).catch(() => {});
  }, [prefs, language]);

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
        if (calendarResponse.status === 401 || calendarResponse.status === 403) throw new Error('Unauthorized');
        throw new Error(`Calendar API Error: ${calendarResponse.status}`);
      }

      const calendarData = await calendarResponse.json();
      const googleEvents: Event[] = (calendarData.items || []).map((item: any) => {
        const start = item.start.dateTime || item.start.date;
        const date = start.split('T')[0];
        const startTime = item.start.dateTime ? new Date(item.start.dateTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }) : 'All Day';
        const endTime = item.end.dateTime ? new Date(item.end.dateTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
        return {
          id: `google-${item.id}`,
          externalId: item.id,
          title: item.summary || 'Untitled Google Event',
          date,
          startTime,
          endTime,
          type: 'work' as const,
          source: 'google' as const,
          description: item.description,
          location: item.location
        };
      });

      const tasksResponse = await fetch('https://www.googleapis.com/tasks/v1/lists/@default/tasks?maxResults=50', { headers: { Authorization: `Bearer ${token}` } });

      if (!tasksResponse.ok) {
        if (tasksResponse.status === 401 || tasksResponse.status === 403) throw new Error('Unauthorized');
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
          source: 'google' as const,
          priority: 'normal' as TaskPriority
        };
      });

      setEvents(prev => [...prev.filter(e => e.source !== 'google'), ...googleEvents]);
      setTasks(prev => [...prev.filter(t => t.source !== 'google'), ...googleTasks]);
      const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
      setLastSyncTime(now);
      localStorage.setItem('kairos_last_sync', now);
      setIsGoogleConnected(true);

    } catch (err: any) {
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

  const handleUpdateChatMessages = (chatId: string, messages: ChatMessage[], newTitle?: string) => {
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages, title: newTitle || c.title } : c));
  };

  const handleSyncChatMessages = useCallback(async (chatId: string, userMsg: ChatMessage, aiMsg: ChatMessage) => {
    if (!getToken()) return;
    try {
      await ChatsApi.addMessage(chatId, 'user', userMsg.content);
      await ChatsApi.addMessage(chatId, 'assistant', aiMsg.content);
    } catch { /* silent — chat still works locally */ }
  }, []);

  const handleSetMessageSynced = (chatId: string, messageId: string) => {
    setChats(prev => prev.map(c => {
      if (c.id !== chatId) return c;
      return { ...c, messages: c.messages.map(m => m.id === messageId ? { ...m, isSynced: true } : m) };
    }));
  };

  const handleAddMemoryItem = useCallback((item: MemoryItem) => {
    setMemory(prev => [item, ...prev].slice(0, 50));
    if (getToken()) MemoryApi.createMemoryItem(item.text).catch(() => {});
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

    // Фоновое сохранение на бэкенд
    if (getToken()) {
      EventsApi.createEvent(newEvent).then(saved => {
        setEvents(prev => prev.map(e => e.id === newId ? { ...saved, source: 'local' } : e));
      }).catch(() => {});
    }

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
          end: { dateTime: endDateTime.toISOString(), timeZone }
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

    if (getToken() && eventToDelete?.source !== 'google') {
      EventsApi.deleteEvent(id).catch(() => {});
    }

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

  const handleEditEvent = async (id: string, updates: Partial<Event>) => {
    const event = events.find(e => e.id === id);
    if (!event) return;
    const updatedEvent = { ...event, ...updates };
    setEvents(prev => prev.map(e => e.id === id ? updatedEvent : e));

    if (getToken() && event.source !== 'google') {
      EventsApi.updateEvent(id, updatedEvent).catch(() => {});
    }

    if (isGoogleConnected && event.source === 'google' && event.externalId) {
      const token = localStorage.getItem('kairos_google_token');
      if (token) {
        try {
          const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          const startDateTime = new Date(`${updatedEvent.date}T${updatedEvent.startTime}:00`);
          const endDateTime = new Date(`${updatedEvent.date}T${updatedEvent.endTime}:00`);
          await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${event.externalId}`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              summary: updatedEvent.title,
              description: updatedEvent.description,
              location: updatedEvent.location,
              start: { dateTime: startDateTime.toISOString(), timeZone },
              end: { dateTime: endDateTime.toISOString(), timeZone }
            })
          });
        } catch (e) { console.error("Failed to update Google Calendar event", e); }
      }
    }
  };

  const handleAddTask = async (title: string, category: string, date: string, description?: string, recurrence?: Task['recurrence'], priority?: TaskPriority) => {
    const tempId = Date.now().toString();
    const newTask: Task = { id: tempId, title, category, date, completed: false, description, recurrence: recurrence || 'none', source: 'local', priority: priority || 'normal' };
    setTasks(prev => [...prev, newTask]);

    if (getToken()) {
      TasksApi.createTask(newTask).then(saved => {
        setTasks(prev => prev.map(t => t.id === tempId ? { ...saved, category, recurrence: recurrence || 'none' } : t));
      }).catch(() => {});
    }

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

    if (getToken() && task.source !== 'google') {
      if (newStatus) {
        TasksApi.completeTask(id).catch(() => {});
      } else {
        TasksApi.updateTask(id, { ...task, completed: false }).catch(() => {});
      }
    }

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

    if (getToken() && taskToDelete?.source !== 'google') {
      TasksApi.deleteTask(id).catch(() => {});
    }

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

  const handleEditTask = async (id: string, updates: Partial<Task>) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const updatedTask = { ...task, ...updates };
    setTasks(prev => prev.map(t => t.id === id ? updatedTask : t));

    if (getToken() && task.source !== 'google') {
      TasksApi.updateTask(id, updatedTask).catch(() => {});
    }

    if (isGoogleConnected && task.source === 'google' && task.externalId) {
      const token = localStorage.getItem('kairos_google_token');
      if (token) {
        try {
          const body: any = { title: updatedTask.title, notes: updatedTask.description || '' };
          if (updatedTask.date) body.due = new Date(updatedTask.date + 'T12:00:00Z').toISOString();
          await fetch(`https://tasks.googleapis.com/tasks/v1/lists/@default/tasks/${task.externalId}`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
        } catch (e) { console.error("Failed to update Google Task", e); }
      }
    }
  };

  const handleNewChat = async () => {
    const tempId = Date.now().toString();
    const currentT = getT(language);
    const initialMsg = currentT.chat.initialMsg(prefs.userName, prefs.assistantName);
    const title = language === 'en' ? 'New Conversation' : 'Новый разговор';
    setChats(prev => [{ id: tempId, title, messages: [{ id: `${tempId}-init`, role: 'assistant', content: initialMsg }], createdAt: Date.now() }, ...prev]);
    setActiveChatId(tempId);

    if (getToken()) {
      ChatsApi.createSession(title).then(saved => {
        setChats(prev => prev.map(c => c.id === tempId ? { ...c, id: saved.id } : c));
        setActiveChatId(prev => prev === tempId ? saved.id : prev);
      }).catch(() => {});
    }
  };

  useEffect(() => { if (isDataLoaded && chats.length === 0) handleNewChat(); }, [isDataLoaded, chats.length]);

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
              {onLogout && (
                <button
                  onClick={onLogout}
                  title="Logout"
                  className="size-9 flex items-center justify-center rounded-full bg-white border border-charcoal/10 text-charcoal/20 hover:text-red-500 hover:bg-red-50 hover:border-red-200 transition-all shadow-sm ml-1"
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                </button>
              )}
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
                  onSyncMessages={handleSyncChatMessages}
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
