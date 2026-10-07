import { createClient } from '@supabase/supabase-js';
export const admin = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
export async function userFrom(req: any) {
  const t = String(req.headers.authorization || '').replace('Bearer ', '');
  const { data } = await admin().auth.getUser(t);
  return data.user;
}
const PROVIDER = process.env.PROVIDER || 'meshy';
const BASE = 'https://api.meshy.ai/openapi';
const H = () => ({ Authorization: `Bearer ${process.env.MESHY_API_KEY}`, 'Content-Type': 'application/json' });
const COMMON = { topology: 'quad', target_polycount: 30000, pose_mode: 'a-pose', symmetry_mode: 'on' };
const STYLE = 'female mannequin, neutral A-pose, nude, bald, smooth featureless face, symmetrical, clean topology';
export type Started = { task: string; endpoint: string };

async function call(url: string, init?: RequestInit) {
  const r = await fetch(url, { ...init, headers: H() });
  if (r.status === 402) throw new Error('SEM_CREDITO');
  if (r.status === 400 || r.status === 422) throw new Error('ENTRADA_INVALIDA');
  if (!r.ok) throw new Error(`PROVEDOR_${r.status}`);
  return r.json();
}

// Para Tripo/Rodin: implemente start/check com a mesma assinatura e escolha via PROVIDER.
export async function start(p: { prompt?: string; images?: string[] }): Promise<Started> {
  if (PROVIDER !== 'meshy') throw new Error(`Provedor "${PROVIDER}" ainda não implementado em api/_lib.ts`);
  let endpoint: string, body: any;
  if (p.images?.length) {
    const multi = p.images.length > 1;
    endpoint = multi ? 'v1/multi-image-to-3d' : 'v1/image-to-3d';
    body = { ...COMMON, should_texture: false, ...(multi ? { image_urls: p.images } : { image_url: p.images[0] }) };
  } else {
    endpoint = 'v2/text-to-3d';
    body = { ...COMMON, mode: 'preview', prompt: `${STYLE}. ${p.prompt}`.slice(0, 600) };
  }
  const j = await call(`${BASE}/${endpoint}`, { method: 'POST', body: JSON.stringify(body) });
  return { task: j.result, endpoint };
}

export async function check(endpoint: string, task: string) {
  const j = await call(`${BASE}/${endpoint}/${task}`);
  const map: any = { PENDING: 'queued', IN_PROGRESS: 'processing', SUCCEEDED: 'done', FAILED: 'failed', CANCELED: 'failed' };
  return { status: map[j.status] || 'processing', progress: j.progress ?? 0, glbUrl: j.model_urls?.glb as string | undefined,
    thumb: j.thumbnail_url as string | undefined, error: j.task_error?.message as string | undefined, credits: undefined as number | undefined };
}
