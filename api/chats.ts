import { apiGet, apiPost, apiDelete } from './client';
import { ChatSession, ChatMessage } from '../types';

interface BackendMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

interface BackendSession {
  id: number;
  title: string;
  messages: BackendMessage[];
  createdAt: string;
  updatedAt: string;
}

function messageToFrontend(m: BackendMessage): ChatMessage {
  return {
    id: String(m.id),
    role: m.role,
    content: m.content,
    isSynced: true,
  };
}

function sessionToFrontend(s: BackendSession): ChatSession {
  return {
    id: String(s.id),
    title: s.title,
    messages: (s.messages || []).map(messageToFrontend),
    createdAt: new Date(s.createdAt).getTime(),
  };
}

export async function fetchSessions(): Promise<ChatSession[]> {
  const data = await apiGet<BackendSession[]>('/api/chats');
  return data.map(sessionToFrontend);
}

export async function createSession(title: string): Promise<ChatSession> {
  const data = await apiPost<BackendSession>('/api/chats', { title });
  return sessionToFrontend(data);
}

export async function fetchSession(id: string): Promise<ChatSession> {
  const data = await apiGet<BackendSession>(`/api/chats/${id}`);
  return sessionToFrontend(data);
}

export async function addMessage(sessionId: string, role: 'user' | 'assistant', content: string): Promise<ChatMessage> {
  const data = await apiPost<BackendMessage>(`/api/chats/${sessionId}/messages`, { role, content });
  return messageToFrontend(data);
}

export async function deleteSession(id: string): Promise<void> {
  await apiDelete(`/api/chats/${id}`);
}
