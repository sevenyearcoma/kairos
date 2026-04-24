import type { CalendarItem, Task } from './types';

const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events.readonly';
const GOOGLE_TASKS_SCOPE = 'https://www.googleapis.com/auth/tasks.readonly';

export const googleScopes = [GOOGLE_CALENDAR_SCOPE, GOOGLE_TASKS_SCOPE];

const dayKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export async function fetchGoogleCalendarItems(accessToken: string): Promise<CalendarItem[]> {
  const timeMin = new Date().toISOString();
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
    timeMin,
  )}&maxResults=10&singleEvents=true&orderBy=startTime`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Google Calendar sync failed: ${response.status}`);
  }

  const data = await response.json();
  return (data.items ?? []).map((item: any) => {
    const start = item.start?.dateTime || item.start?.date || '';
    const date = start ? new Date(start) : null;
    return {
      id: `google-${item.id}`,
      day: date ? dayKey(date) : '',
      time: date
        ? date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
        : '--:--',
      title: item.summary || 'Untitled Google event',
      source: 'google',
    };
  });
}

export async function fetchGoogleTasks(accessToken: string): Promise<Task[]> {
  const response = await fetch('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks?maxResults=20', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Google Tasks sync failed: ${response.status}`);
  }

  const data = await response.json();
  return (data.items ?? [])
    .filter((item: any) => item.title && item.status !== 'completed')
    .map((item: any) => ({
      id: `google-${item.id}`,
      title: item.title,
      bucket: 'today',
      energy: 'ok',
      completed: false,
    }));
}
