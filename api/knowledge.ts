import { apiGet, apiPut } from './client';
import { KnowledgeBase } from '../types';

export async function fetchKnowledgeBase(): Promise<KnowledgeBase> {
  const data = await apiGet<any>('/api/knowledge-base');
  // Backend returns a generic object — map content string to our KnowledgeBase shape
  if (data.content && typeof data.content === 'string') {
    try {
      return JSON.parse(data.content);
    } catch {
      return { user_name: 'User' };
    }
  }
  return data as KnowledgeBase;
}

export async function saveKnowledgeBase(kb: KnowledgeBase): Promise<void> {
  // Store the whole KB as a JSON string in the content field
  await apiPut('/api/knowledge-base', { content: JSON.stringify(kb) });
}
