import type { VercelRequest, VercelResponse } from '@vercel/node';
import { admin, start, userFrom } from './_lib.js';
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await userFrom(req);
  if (!user) return res.status(401).json({ error: 'Faça login.' });
  const { prompt, imagePaths = [] } = req.body || {};
  if (!prompt && !imagePaths.length) return res.status(400).json({ error: 'Envie imagens ou um texto.' });
  const db = admin();
  try {
    const urls: string[] = [];
    for (const p of imagePaths.slice(0, 2)) {
      if (!String(p).startsWith(user.id + '/')) return res.status(403).json({ error: 'Arquivo inválido.' });
      const { data } = await db.storage.from('uploads').createSignedUrl(p, 3600);
      urls.push(data!.signedUrl);
    }
    const s = await start({ prompt, images: urls });
    const { data } = await db.from('models').insert({ user_id: user.id, prompt, image_paths: imagePaths,
      provider: process.env.PROVIDER || 'meshy', task_id: s.task, endpoint: s.endpoint, name: (prompt || 'Manequim').slice(0, 40) }).select().single();
    res.json({ id: data.id });
  } catch (e: any) {
    const m: any = { SEM_CREDITO: 'Sem créditos no provedor.', ENTRADA_INVALIDA: 'Imagem ou texto inválido.' };
    res.status(502).json({ error: m[e.message] || 'Falha ao iniciar a geração.' });
  }
}
