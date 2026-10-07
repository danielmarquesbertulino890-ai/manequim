import { createClient } from '@supabase/supabase-js';
export const sb = createClient(import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co', import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder');
export const glbUrl = (path: string) => sb.storage.from('models').getPublicUrl(path).data.publicUrl;
export async function api(path: string, body?: unknown) {
  const { data } = await sb.auth.getSession();
  const r = await fetch(path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json',
    Authorization: `Bearer ${data.session?.access_token}` }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || 'Erro');
  return j;
}

export const configured = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;
