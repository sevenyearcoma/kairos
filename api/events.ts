import { apiGet, apiPost, apiPut, apiDelete } from './client';
import { Event } from '../types';

interface BackendEvent {
  id: number;
  title: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  color?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

interface EventPayload {
  title: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  color?: string;
  tags?: string[];
}

function toFrontend(e: BackendEvent): Event {
  const date = e.startTime ? e.startTime.split('T')[0] : '';
  const startTime = e.startTime
    ? new Date(e.startTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '00:00';
  const endTime = e.endTime
    ? new Date(e.endTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '01:00';

  return {
    id: String(e.id),
    title: e.title,
    date,
    startTime,
    endTime,
    description: e.description,
    location: e.location,
    type: 'work',
    source: 'local',
  };
}

function toPayload(event: Partial<Event>): EventPayload {
  const payload: EventPayload = { title: event.title || '' };
  if (event.description) payload.description = event.description;
  if (event.location) payload.location = event.location;
  if (event.date && event.startTime) {
    payload.startTime = `${event.date}T${event.startTime}:00`;
  }
  if (event.date && event.endTime) {
    payload.endTime = `${event.date}T${event.endTime}:00`;
  }
  return payload;
}

export async function fetchEvents(): Promise<Event[]> {
  const data = await apiGet<BackendEvent[]>('/api/events');
  return data.map(toFrontend);
}

export async function createEvent(event: Partial<Event>): Promise<Event> {
  const data = await apiPost<BackendEvent>('/api/events', toPayload(event));
  return toFrontend(data);
}

export async function updateEvent(id: string, updates: Partial<Event>): Promise<Event> {
  const data = await apiPut<BackendEvent>(`/api/events/${id}`, toPayload(updates));
  return toFrontend(data);
}

export async function deleteEvent(id: string): Promise<void> {
  await apiDelete(`/api/events/${id}`);
}
