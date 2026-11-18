-- Lumen Photos: tabel dasar + RLS + bucket privat. Aman dijalankan ulang (IF NOT EXISTS).
create table if not exists public.photos   (id text not null, user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, data jsonb not null default '{}', created_at timestamptz not null default now(), primary key(user_id,id));
create table if not exists public.albums   (like public.photos including defaults);
create table if not exists public.profile  (like public.photos including defaults);
create table if not exists public.settings (like public.photos including defaults);
do $$ begin
  begin alter table public.albums   add primary key (user_id,id); exception when others then null; end;
  begin alter table public.profile  add primary key (user_id,id); exception when others then null; end;
  begin alter table public.settings add primary key (user_id,id); exception when others then null; end;
end $$;
do $$ declare t text; begin
  foreach t in array array['photos','albums','profile','settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own_%1$s" on public.%1$I', t);
    execute format('create policy "own_%1$s" on public.%1$I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    begin execute format('alter publication supabase_realtime add table public.%I', t); exception when others then null; end;
  end loop;
end $$;
insert into storage.buckets (id,name,public) values ('photos','photos',false) on conflict (id) do nothing;
drop policy if exists "lumen_own_objects" on storage.objects;
create policy "lumen_own_objects" on storage.objects for all to authenticated
  using (bucket_id='photos' and (storage.foldername(name))[1]=auth.uid()::text)
  with check (bucket_id='photos' and (storage.foldername(name))[1]=auth.uid()::text);
