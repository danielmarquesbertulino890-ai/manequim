import type { VercelRequest, VercelResponse } from '@vercel/node';
import { admin, check, userFrom } from './_lib.js';
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await userFrom(req);
  if (!user) return res.status(401).json({ error: 'Faça login.' });
  const db = admin();
  const { data: m } = await db.from('models').select('*').eq('id', req.query.id).eq('user_id', user.id).single();
  if (!m) return res.status(404).json({ error: 'Modelo não encontrado.' });
  if (m.status === 'done' || m.status === 'failed') return res.json(m);
  if (Date.now() - new Date(m.created_at).getTime() > 15 * 60_000) {
    const { data } = await db.from('models').update({ status: 'failed', error: 'Tempo esgotado.' }).eq('id', m.id).select().single();
    return res.json(data);
  }
  try {
    const r = await check(m.endpoint, m.task_id);
    let patch: any = { status: r.status, progress: r.progress, error: r.error ?? null, credits: r.credits ?? null };
    if (r.status === 'done' && r.glbUrl) {
      const buf = Buffer.from(await (await fetch(r.glbUrl)).arrayBuffer());
      const path = `${user.id}/${m.id}.glb`;
      await db.storage.from('models').upload(path, buf, { contentType: 'model/gltf-binary', upsert: true });
      patch = { ...patch, glb_path: path, thumb: r.thumb ?? null };
    }
    const { data } = await db.from('models').update(patch).eq('id', m.id).select().single();
    res.json(data);
  } catch { res.json(m); }
}
