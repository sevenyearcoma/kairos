import { apiGet, apiPut } from './client';
import { Personality } from '../types';

export async function fetchPersonality(): Promise<Personality> {
  const data = await apiGet<any>('/api/personality');
  if (data.bio && typeof data.bio === 'string') {
    try {
      return JSON.parse(data.bio);
    } catch {}
  }
  return { trust: 75, respect: 65, strictness: 20, burnoutRisk: 15, efficiency: 82 };
}

export async function savePersonality(p: Personality): Promise<void> {
  await apiPut('/api/personality', { bio: JSON.stringify(p) });
}
