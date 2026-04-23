import { apiGet, apiPost, apiDelete } from './client';
import { MemoryItem } from '../types';

interface BackendMemory {
  id: number;
  content: string;
  category?: string;
  tags?: string[];
  createdAt: string;
}

export async function fetchMemory(): Promise<MemoryItem[]> {
  const data = await apiGet<BackendMemory[]>('/api/memory');
  return data.map(m => ({
    text: m.content,
    timestamp: new Date(m.createdAt).getTime(),
  }));
}

export async function createMemoryItem(text: string): Promise<MemoryItem> {
  const data = await apiPost<BackendMemory>('/api/memory', { content: text });
  return {
    text: data.content,
    timestamp: new Date(data.createdAt).getTime(),
  };
}

export async function deleteMemoryItem(id: string): Promise<void> {
  await apiDelete(`/api/memory/${id}`);
}
