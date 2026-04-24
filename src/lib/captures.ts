import { isSupabaseConfigured, supabase } from './supabase';

export type CaptureKind = 'thought' | 'task' | 'event' | 'voice';

export interface CaptureInput {
  content: string;
  kind: CaptureKind;
  metadata?: Record<string, unknown>;
}

export interface RecalledCapture {
  id: string;
  content: string;
  kind: CaptureKind;
  created_at: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

const RETRY_QUEUE_KEY = 'kairos.captureRetryQueue';

async function embedViaEdge(text: string, taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY'): Promise<number[]> {
  const { data, error } = await supabase().functions.invoke('embed', {
    body: { text, taskType },
  });
  if (error) throw error;
  const embedding = (data as { embedding?: number[] })?.embedding;
  if (!embedding) throw new Error('embed returned no embedding');
  return embedding;
}

function queueRetry(input: CaptureInput) {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(RETRY_QUEUE_KEY);
    const queue: CaptureInput[] = raw ? JSON.parse(raw) : [];
    queue.push(input);
    window.localStorage.setItem(RETRY_QUEUE_KEY, JSON.stringify(queue.slice(-50)));
  } catch {
    /* best effort */
  }
}

async function drainRetryQueue() {
  if (typeof window === 'undefined') return;
  const raw = window.localStorage.getItem(RETRY_QUEUE_KEY);
  if (!raw) return;
  const queue: CaptureInput[] = JSON.parse(raw);
  if (!queue.length) return;
  window.localStorage.removeItem(RETRY_QUEUE_KEY);
  for (const item of queue) {
    await archiveCapture(item);
  }
}

export async function archiveCapture(input: CaptureInput): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const { data: auth } = await supabase().auth.getUser();
    if (!auth.user) return;
    const embedding = await embedViaEdge(input.content, 'RETRIEVAL_DOCUMENT');
    const { error } = await supabase().from('captures').insert({
      user_id: auth.user.id,
      content: input.content,
      kind: input.kind,
      metadata: input.metadata ?? {},
      embedding,
    });
    if (error) throw error;
  } catch (err) {
    console.warn('[kairos] capture archive deferred', err);
    queueRetry(input);
  }
}

export function archiveCaptureAsync(input: CaptureInput): void {
  void archiveCapture(input);
}

export async function recall(query: string, matchCount = 8): Promise<RecalledCapture[]> {
  if (!isSupabaseConfigured) return [];
  if (!query.trim()) return [];
  void drainRetryQueue();
  const embedding = await embedViaEdge(query, 'RETRIEVAL_QUERY');
  const { data, error } = await supabase().rpc('match_captures', {
    query_embedding: embedding,
    match_count: matchCount,
  });
  if (error) throw error;
  return (data ?? []) as RecalledCapture[];
}

export async function warmEmbedder(): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await supabase().functions.invoke('embed', { body: { text: 'warm', taskType: 'RETRIEVAL_QUERY' } });
  } catch {
    /* ignore */
  }
}
