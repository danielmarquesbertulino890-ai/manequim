import { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import Viewer, { Api, Mode } from './Viewer';
import { api, configured, glbUrl, sb } from './supabase';
import './style.css';

type M = { id: string; name: string; prompt?: string; status: string; progress: number; error?: string; credits?: number;
  glb_path?: string; thumb?: string; is_public: boolean; created_at: string; image_paths: string[] };
const ok = (f: File) => ['image/jpeg', 'image/png'].includes(f.type) && f.size <= 10 * 1024 * 1024;
const LABEL: Record<string, string> = { queued: 'Na fila', processing: 'Processando', done: 'Concluído', failed: 'Falhou' };

export default function App() {
  const [ses, setSes] = useState<Session | null>(null);
  const [email, setEmail] = useState(''); const [sent, setSent] = useState(false);
  const [tab, setTab] = useState<'foto' | 'texto'>('foto');
  const [files, setFiles] = useState<File[]>([]); const [prompt, setPrompt] = useState('');
  const [list, setList] = useState<M[]>([]); const [cur, setCur] = useState<M | null>(null);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode>('cinza'); const [auto, setAuto] = useState(true);
  const vr = useRef<Api | null>(null);
  const shared = new URLSearchParams(location.search).get('m');

  useEffect(() => { sb.auth.getSession().then(r => setSes(r.data.session)); sb.auth.onAuthStateChange((_, s) => setSes(s)); }, []);
  const load = async () => { const { data } = await sb.from('models').select('*').order('created_at', { ascending: false }); setList((data as M[]) || []); };
  useEffect(() => { if (ses) load(); }, [ses]);
  useEffect(() => { if (shared) sb.from('models').select('*').eq('id', shared).single().then(r => r.data && setCur(r.data as M)); }, [shared]);

  // Polling a cada 3s, sem bloquear a UI
  useEffect(() => {
    if (!cur || cur.status === 'done' || cur.status === 'failed' || shared) return;
    const t = setInterval(async () => { try { const m = await api(`/api/status?id=${cur.id}`); setCur(m); if (m.status !== 'queued' && m.status !== 'processing') load(); } catch {} }, 3000);
    return () => clearInterval(t);
  }, [cur?.id, cur?.status]);

  async function generate() {
    setErr(''); setBusy(true);
    try {
      if (tab === 'foto') {
        if (!files.length) throw new Error('Escolha 1 ou 2 imagens.');
        if (!files.every(ok)) throw new Error('Use JPG ou PNG de até 10 MB.');
      } else if (prompt.trim().length < 5) throw new Error('Descreva o manequim.');
      const paths: string[] = [];
      if (tab === 'foto') for (const f of files) {
        const p = `${ses!.user.id}/${crypto.randomUUID()}.${f.type === 'image/png' ? 'png' : 'jpg'}`;
        const { error } = await sb.storage.from('uploads').upload(p, f); if (error) throw new Error('Falha no upload da imagem.');
        paths.push(p);
      }
      const { id } = await api('/api/generate', { prompt: tab === 'texto' ? prompt : undefined, imagePaths: paths });
      setCur(await api(`/api/status?id=${id}`));
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  const dl = (href: string, name: string) => { const a = document.createElement('a'); a.href = href; a.download = name; a.click(); };
  async function pngs() { for (const v of ['frente', 'costas', 'direita']) dl(await vr.current!.shot(v), `manequim-${v}.png`); }
  async function glb() { const b = await (await fetch(glbUrl(cur!.glb_path!))).blob(); dl(URL.createObjectURL(b), `${cur!.name}.glb`); }
  async function patch(id: string, p: Partial<M>) { await sb.from('models').update(p).eq('id', id); if (cur?.id === id) setCur({ ...cur, ...p }); load(); }
  async function share() { await patch(cur!.id, { is_public: true }); const u = `${location.origin}/?m=${cur!.id}`; await navigator.clipboard?.writeText(u); alert('Link copiado:\n' + u); }
  async function dup(m: M) { await sb.from('models').insert({ user_id: ses!.user.id, name: m.name + ' (cópia)', prompt: m.prompt, glb_path: m.glb_path, thumb: m.thumb, status: 'done', progress: 100 }); load(); }
  async function del(m: M) { if (!confirm('Excluir este modelo?')) return; await sb.from('models').delete().eq('id', m.id); if (cur?.id === m.id) setCur(null); load(); }

  if (!configured) return <main><h1>Gerador de Manequim 3D</h1><section><h2>Falta configurar</h2><p>Cadastre VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nas variáveis de ambiente da Vercel e faça um novo deploy.</p></section></main>;

  if (!ses && !shared) return (
    <main><h1>Gerador de Manequim 3D</h1><section><h2>Entrar</h2>
      {sent ? <p>Link de acesso enviado para {email}.</p> : <>
        <input type="email" placeholder="seu e-mail" value={email} onChange={e => setEmail(e.target.value)} />
        <button onClick={async () => { await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin } }); setSent(true); }}>Entrar</button></>}
    </section></main>);

  const ready = cur?.status === 'done' && cur.glb_path;
  return (
    <main>
      <h1>Gerador de Manequim 3D</h1>
      {!shared && !cur && <section>
        <div className="row"><button className={tab === 'foto' ? 'on' : ''} onClick={() => setTab('foto')}>Enviar foto</button>
          <button className={tab === 'texto' ? 'on' : ''} onClick={() => setTab('texto')}>Descrever em texto</button></div>
        {tab === 'foto' ? <><p>1 a 2 imagens (frente e costas) · JPG/PNG · até 10 MB</p>
          <input type="file" accept="image/jpeg,image/png" multiple onChange={e => setFiles(Array.from(e.target.files || []).slice(0, 2))} /></>
          : <textarea rows={4} placeholder="Ex.: manequim feminina esguia, ombros estreitos, quadril largo" value={prompt} onChange={e => setPrompt(e.target.value)} />}
        <button disabled={busy} onClick={generate}>{busy ? 'Enviando…' : 'Gerar manequim'}</button>
        {err && <p className="err">{err} <button onClick={generate}>Tentar de novo</button></p>}
      </section>}

      {cur && !ready && <section>
        <h2>{LABEL[cur.status]}</h2>
        {cur.status !== 'failed' && <progress max={100} value={cur.progress || 5} />}
        {cur.status === 'failed' && <p className="err">{cur.error || 'Falha na geração.'} <button onClick={() => { setCur(null); }}>Tentar de novo</button></p>}
      </section>}

      {ready && <section>
        <div className="viewer"><Viewer url={glbUrl(cur!.glb_path!)} mode={mode} auto={auto} apiRef={vr} /></div>
        <div className="row">{(['cinza', 'wireframe', 'silhueta'] as Mode[]).map(m => <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>{m}</button>)}</div>
        <div className="row"><button onClick={() => vr.current?.view('frente')}>Frente</button><button onClick={() => vr.current?.view('costas')}>Costas</button>
          <button onClick={() => vr.current?.view('esquerda')}>Perfil E</button><button onClick={() => vr.current?.view('direita')}>Perfil D</button>
          <button onClick={() => vr.current?.view('reset')}>Resetar</button><button onClick={() => setAuto(!auto)}>{auto ? 'Parar giro' : 'Girar'}</button></div>
        <div className="row"><button onClick={glb}>Baixar .glb</button><button onClick={pngs}>Baixar imagens</button>{!shared && <button onClick={share}>Compartilhar</button>}</div>
        {cur?.credits != null && <small>Créditos usados: {cur.credits}</small>}
        {!shared && <button onClick={() => setCur(null)}>＋ Novo</button>}
      </section>}

      {!shared && <section><h2>Histórico</h2>
        {list.map(m => <div className="item" key={m.id}>
          {m.thumb ? <img src={m.thumb} alt="" /> : <div className="ph" />}
          <div onClick={() => setCur(m)}><b>{m.name}</b><small>{new Date(m.created_at).toLocaleString('pt-BR')} · {LABEL[m.status]}<br />{m.prompt || `${m.image_paths?.length || 0} foto(s)`}</small></div>
          <div className="row"><button onClick={() => { const n = window.prompt('Novo nome', m.name); if (n) patch(m.id, { name: n }); }}>✎</button>
            <button onClick={() => dup(m)}>⧉</button><button onClick={() => del(m)}>🗑</button></div></div>)}
      </section>}
    </main>);
}
