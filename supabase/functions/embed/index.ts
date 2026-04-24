// Supabase Edge Function: generate Gemini embedding for a string.
// Deployed with: supabase functions deploy embed
// Secret required: supabase secrets set GEMINI_API_KEY=...

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const GEMINI_MODEL = 'text-embedding-004';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:embedContent`;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const key = Deno.env.get('GEMINI_API_KEY');
    if (!key) return json({ error: 'GEMINI_API_KEY not set' }, 500);

    const { text, taskType } = await req.json();
    if (typeof text !== 'string' || !text.trim()) {
      return json({ error: 'text is required' }, 400);
    }

    const body = {
      model: `models/${GEMINI_MODEL}`,
      content: { parts: [{ text }] },
      taskType: taskType ?? 'RETRIEVAL_DOCUMENT',
    };

    const res = await fetch(`${GEMINI_URL}?key=${key}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const detail = await res.text();
      return json({ error: 'gemini_failed', detail }, res.status);
    }

    const data = await res.json();
    const embedding: number[] | undefined = data?.embedding?.values;
    if (!embedding || embedding.length === 0) {
      return json({ error: 'no_embedding_returned' }, 502);
    }

    return json({ embedding });
  } catch (err) {
    return json({ error: 'unhandled', message: String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...cors },
  });
}
