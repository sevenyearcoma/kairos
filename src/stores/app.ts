import { atom } from 'nanostores';
import { persistentAtom } from '@nanostores/persistent';
import type { Event, Task, ChatSession, ChatMessage, MemoryItem, UserPreferences, Language, Personality, KnowledgeBase, TaskPriority } from '../types';
import { getT } from '../translations';

const jsonCodec = { encode: JSON.stringify, decode: (v: string) => { try { return JSON.parse(v); } catch { return null; } } };

export const $events = persistentAtom<Event[]>('kairos_events', [], jsonCodec);
export const $tasks = persistentAtom<Task[]>('kairos_tasks', [], jsonCodec);
export const $chats = persistentAtom<ChatSession[]>('kairos_chats', [], jsonCodec);
export const $activeChatId = persistentAtom<string>('kairos_active_chat', '');
export const $memory = persistentAtom<MemoryItem[]>('kairos_memory_v2', [], jsonCodec);
export const $prefs = persistentAtom<UserPreferences>('kairos_prefs', {
  userName: 'User', assistantName: 'Kairos', theme: 'cream', onboardingComplete: false,
}, jsonCodec);
export const $language = persistentAtom<Language>('kairos_lang', 'en');
export const $personality = persistentAtom<Personality>('kairos_personality', {
  trust: 75, respect: 65, strictness: 20, burnoutRisk: 15, efficiency: 82,
}, jsonCodec);
export const $knowledgeBase = persistentAtom<KnowledgeBase>('kairos_knowledge_base', {
  user_name: 'User', core_stack: [], current_projects: [], interests: [],
  preferences: { tone: 'Direct, slightly witty' },
}, jsonCodec);

export const $isGoogleConnected = atom(false);
export const $lastSyncTime = atom<string | null>(null);
export const $isSyncing = atom(false);
export const $isAiThinking = atom(false);

export function initTransientState() {
  $isGoogleConnected.set(!!localStorage.getItem('kairos_google_token'));
  $lastSyncTime.set(localStorage.getItem('kairos_last_sync'));
}

export function getLocalDateStr(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
}

export function createNewChat() {
  const lang = $language.get();
  const prefs = $prefs.get();
  const newId = Date.now().toString();
  const initialMsg = getT(lang).chat.initialMsg(prefs.userName, prefs.assistantName);
  $chats.set([{
    id: newId,
    title: lang === 'en' ? 'New Conversation' : 'Новый разговор',
    messages: [{ id: `${newId}-0`, role: 'assistant', content: initialMsg }],
    createdAt: Date.now(),
  }, ...$chats.get()]);
  $activeChatId.set(newId);
}

export function ensureChat() {
  if ($chats.get().length === 0) createNewChat();
}

export function updateChatMessages(chatId: string, messages: ChatMessage[], newTitle?: string) {
  $chats.set($chats.get().map(c => c.id === chatId ? { ...c, messages, title: newTitle || c.title } : c));
}

export function setMessageSynced(chatId: string, messageId: string) {
  $chats.set($chats.get().map(c => {
    if (c.id !== chatId) return c;
    return { ...c, messages: c.messages.map(m => m.id === messageId ? { ...m, isSynced: true } : m) };
  }));
}

export function addMemoryItem(item: MemoryItem) {
  $memory.set([item, ...$memory.get()].slice(0, 50));
}

export async function addEvent(event: Partial<Event>) {
  const newId = Date.now().toString();
  const newEvent: Event = {
    ...event,
    id: newId,
    title: event.title || 'Untitled',
    date: event.date || getLocalDateStr(),
    startTime: event.startTime || '10:00',
    endTime: event.endTime || '11:00',
    type: event.type || 'work',
    source: 'local',
  };
  $events.set([...$events.get(), newEvent]);
  if (!$isGoogleConnected.get()) return;
  const token = localStorage.getItem('kairos_google_token');
  if (!token) return;
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: newEvent.title, description: newEvent.description, location: newEvent.location,
        start: { dateTime: new Date(`${newEvent.date}T${newEvent.startTime}:00`).toISOString(), timeZone },
        end: { dateTime: new Date(`${newEvent.date}T${newEvent.endTime}:00`).toISOString(), timeZone },
      }),
    });
    if (res.ok) {
      const data = await res.json();
      $events.set($events.get().map(e => e.id === newId ? { ...e, id: `google-${data.id}`, source: 'google', externalId: data.id } : e));
    }
  } catch (err) { console.error('Failed to add event to Google Calendar:', err); }
}

export async function deleteEvent(id: string) {
  const ev = $events.get().find(e => e.id === id);
  $events.set($events.get().filter(e => e.id !== id));
  if (!$isGoogleConnected.get() || ev?.source !== 'google' || !ev.externalId) return;
  const token = localStorage.getItem('kairos_google_token');
  if (token) {
    try {
      await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${ev.externalId}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` },
      });
    } catch (e) { console.error('Failed to delete Google event', e); }
  }
}

export async function editEvent(id: string, updates: Partial<Event>) {
  const event = $events.get().find(e => e.id === id);
  if (!event) return;
  const updated = { ...event, ...updates };
  $events.set($events.get().map(e => e.id === id ? updated : e));
  if (!$isGoogleConnected.get() || event.source !== 'google' || !event.externalId) return;
  const token = localStorage.getItem('kairos_google_token');
  if (token) {
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${event.externalId}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: updated.title, description: updated.description, location: updated.location,
          start: { dateTime: new Date(`${updated.date}T${updated.startTime}:00`).toISOString(), timeZone },
          end: { dateTime: new Date(`${updated.date}T${updated.endTime}:00`).toISOString(), timeZone },
        }),
      });
    } catch (e) { console.error('Failed to update Google event', e); }
  }
}

export async function addTask(title: string, category: string, date: string, description?: string, recurrence?: Task['recurrence'], priority?: TaskPriority) {
  const tempId = Date.now().toString();
  $tasks.set([...$tasks.get(), { id: tempId, title, category, date, completed: false, description, recurrence: recurrence || 'none', source: 'local', priority: priority || 'normal' }]);
  if (!$isGoogleConnected.get()) return;
  const token = localStorage.getItem('kairos_google_token');
  if (token) {
    try {
      const taskBody: any = { title, notes: description || '' };
      if (date) taskBody.due = new Date(date + 'T12:00:00Z').toISOString();
      const res = await fetch('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks', {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(taskBody),
      });
      if (res.ok) {
        const data = await res.json();
        $tasks.set($tasks.get().map(task => task.id === tempId ? { ...task, id: `google-${data.id}`, externalId: data.id, source: 'google' } : task));
      }
    } catch (e) { console.error('Failed to create Google Task', e); }
  }
}

export async function toggleTask(id: string) {
  const task = $tasks.get().find(task => task.id === id);
  if (!task) return;
  const newStatus = !task.completed;
  $tasks.set($tasks.get().map(task => task.id === id ? { ...task, completed: newStatus } : task));
  if (!$isGoogleConnected.get() || task.source !== 'google' || !task.externalId) return;
  const token = localStorage.getItem('kairos_google_token');
  if (token) {
    try {
      await fetch(`https://tasks.googleapis.com/tasks/v1/lists/@default/tasks/${task.externalId}`, {
        method: 'PATCH', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus ? 'completed' : 'needsAction' }),
      });
    } catch (e) { console.error('Failed to sync task status', e); }
  }
}

export async function deleteTask(id: string) {
  const task = $tasks.get().find(task => task.id === id);
  $tasks.set($tasks.get().filter(task => task.id !== id));
  if (!$isGoogleConnected.get() || task?.source !== 'google' || !task.externalId) return;
  const token = localStorage.getItem('kairos_google_token');
  if (token) {
    try {
      await fetch(`https://tasks.googleapis.com/tasks/v1/lists/@default/tasks/${task.externalId}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` },
      });
    } catch (e) { console.error('Failed to delete Google Task', e); }
  }
}

export async function editTask(id: string, updates: Partial<Task>) {
  const task = $tasks.get().find(task => task.id === id);
  if (!task) return;
  const updated = { ...task, ...updates };
  $tasks.set($tasks.get().map(task => task.id === id ? updated : task));
  if (!$isGoogleConnected.get() || task.source !== 'google' || !task.externalId) return;
  const token = localStorage.getItem('kairos_google_token');
  if (token) {
    try {
      const body: any = { title: updated.title, notes: updated.description || '' };
      if (updated.date) body.due = new Date(updated.date + 'T12:00:00Z').toISOString();
      await fetch(`https://tasks.googleapis.com/tasks/v1/lists/@default/tasks/${task.externalId}`, {
        method: 'PATCH', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (e) { console.error('Failed to update Google Task', e); }
  }
}

export async function syncGoogleData(token: string) {
  $isSyncing.set(true);
  try {
    const calRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${new Date().toISOString()}&maxResults=50&singleEvents=true&orderBy=startTime`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!calRes.ok) {
      if (calRes.status === 401) throw new Error('Unauthorized');
      throw new Error(`Calendar API Error: ${calRes.status}`);
    }
    const calData = await calRes.json();
    const googleEvents: Event[] = (calData.items || []).map((item: any) => {
      const start = item.start.dateTime || item.start.date;
      return {
        id: `google-${item.id}`, externalId: item.id,
        title: item.summary || 'Untitled Google Event',
        date: start.split('T')[0],
        startTime: item.start.dateTime ? new Date(item.start.dateTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }) : 'All Day',
        endTime: item.end.dateTime ? new Date(item.end.dateTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
        type: 'work' as const, source: 'google' as const, description: item.description, location: item.location,
      };
    });

    const tasksRes = await fetch('https://www.googleapis.com/tasks/v1/lists/@default/tasks?maxResults=50', { headers: { Authorization: `Bearer ${token}` } });
    if (!tasksRes.ok) {
      if (tasksRes.status === 401) throw new Error('Unauthorized');
      throw new Error(`Tasks API Error: ${tasksRes.status}`);
    }
    const tasksData = await tasksRes.json();
    const googleTasks: Task[] = (tasksData.items || []).filter((item: any) => item.title).map((item: any) => ({
      id: `google-${item.id}`, externalId: item.id, title: item.title, category: 'Work',
      date: item.due ? item.due.split('T')[0] : '', completed: item.status === 'completed',
      description: item.notes, source: 'google' as const, priority: 'normal' as const,
    }));

    $events.set([...$events.get().filter(e => e.source !== 'google'), ...googleEvents]);
    $tasks.set([...$tasks.get().filter(task => task.source !== 'google'), ...googleTasks]);
    const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    $lastSyncTime.set(now);
    localStorage.setItem('kairos_last_sync', now);
    $isGoogleConnected.set(true);
  } catch (err: any) {
    if (err.message === 'Unauthorized' || err.message?.includes('Forbidden')) {
      localStorage.removeItem('kairos_google_token');
      $isGoogleConnected.set(false);
    }
  } finally {
    $isSyncing.set(false);
  }
}

export function disconnectGoogle() {
  localStorage.removeItem('kairos_google_token');
  localStorage.removeItem('kairos_last_sync');
  $isGoogleConnected.set(false);
  $lastSyncTime.set(null);
  $events.set($events.get().filter(e => e.source !== 'google'));
  $tasks.set($tasks.get().filter(task => task.source !== 'google'));
}
