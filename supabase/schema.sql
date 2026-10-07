create table models (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null default 'Manequim',
  prompt text, image_paths text[] default '{}',
  provider text, task_id text, endpoint text,
  status text not null default 'queued', progress int default 0,
  error text, credits numeric, glb_path text, thumb text,
  is_public boolean default false, created_at timestamptz default now()
);
alter table models enable row level security;
create policy "dono" on models for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "publico" on models for select using (is_public);
-- Storage: crie os buckets "uploads" (privado) e "models" (público).
create policy "upload proprio" on storage.objects for insert to authenticated
  with check (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);
