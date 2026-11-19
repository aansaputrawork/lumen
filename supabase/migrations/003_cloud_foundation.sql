-- Lumen Photos 003: paket & kuota, metadata terstruktur, perangkat, tautan berbagi, langganan, admin. Aman dijalankan ulang.
-- Harga & batas pada tabel plans hanya CONTOH: ubah sesuai bisnis Anda.
create table if not exists public.plans (id text primary key, name text not null, storage_bytes bigint not null, max_file_bytes bigint not null,
  price_idr integer not null default 0, active boolean not null default true, features jsonb not null default '{}');
insert into public.plans(id,name,storage_bytes,max_file_bytes,price_idr,features) values
 ('free','Free',5000000000,500000000,0,'{"share_links":false,"private_album":false}'),
 ('pro','Pro',200000000000,5000000000,29000,'{"share_links":true,"private_album":true}'),
 ('business','Business',1000000000000,10000000000,99000,'{"share_links":true,"private_album":true}') on conflict (id) do nothing;
create table if not exists public.user_accounts (user_id uuid primary key references auth.users(id) on delete cascade,
  plan_id text not null default 'free' references public.plans(id), quota_override bigint,
  role text not null default 'user' check (role in ('user','admin')), created_at timestamptz not null default now());
alter table public.plans enable row level security; alter table public.user_accounts enable row level security;
drop policy if exists plans_read on public.plans; create policy plans_read on public.plans for select to authenticated using (true);
drop policy if exists own_account_read on public.user_accounts; create policy own_account_read on public.user_accounts for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.user_accounts from anon, authenticated;   -- paket/role hanya diubah lewat SQL atau service role
revoke insert, update, delete on public.plans from anon, authenticated;
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.user_accounts(user_id) values (new.id) on conflict do nothing; return new; end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
insert into public.user_accounts(user_id) select id from auth.users on conflict do nothing;

-- Metadata terstruktur (diisi otomatis dari kolom jsonb "data", klien tidak perlu diubah)
alter table public.photos add column if not exists width int, add column if not exists height int, add column if not exists taken_at timestamptz,
  add column if not exists category text, add column if not exists is_favorite boolean not null default false, add column if not exists fingerprint text,
  add column if not exists thumb_path text, add column if not exists deleted_at timestamptz;
create or replace function public.photos_sync_meta() returns trigger language plpgsql as $$
declare d jsonb := coalesce(new.data,'{}');
begin
  new.width := nullif(d->>'w','')::numeric::int; new.height := nullif(d->>'h','')::numeric::int;
  new.taken_at := to_timestamp(nullif(d->>'date','')::numeric/1000); new.category := d->>'cat';
  new.is_favorite := coalesce(d->>'fav'='true',false); new.fingerprint := nullif(d->>'hash',''); new.thumb_path := d->>'tid';
  new.deleted_at := to_timestamp(nullif(d->>'del','')::numeric/1000);
  new.file_size := coalesce(new.file_size, nullif(d->>'size','')::numeric::bigint); new.mime_type := coalesce(new.mime_type, d->>'type');
  new.original_file_name := coalesce(new.original_file_name, d->>'name'); return new; end $$;
drop trigger if exists a_photos_meta on public.photos; create trigger a_photos_meta before insert or update on public.photos for each row execute function public.photos_sync_meta();
-- Kuota & batas ukuran file per paket (dicek saat baris foto dibuat)
create or replace function public.photos_enforce_quota() returns trigger language plpgsql security definer set search_path = public as $$
declare q bigint; m bigint; used bigint;
begin
  select coalesce(a.quota_override,p.storage_bytes), p.max_file_bytes into q,m from user_accounts a join plans p on p.id=a.plan_id where a.user_id=new.user_id;
  if q is null then return new; end if;
  if coalesce(new.file_size,0) > m then raise exception 'file_too_large'; end if;
  select coalesce(sum(file_size),0) into used from photos where user_id=new.user_id and storage_provider='supabase' and id<>new.id;
  if used + coalesce(new.file_size,0) > q then raise exception 'storage_quota_exceeded'; end if; return new; end $$;
drop trigger if exists b_photos_quota on public.photos; create trigger b_photos_quota before insert on public.photos for each row execute function public.photos_enforce_quota();
create index if not exists photos_taken_idx on public.photos (user_id, taken_at desc);
create index if not exists photos_fp_idx on public.photos (user_id, fingerprint);
create index if not exists photos_cat_idx on public.photos (user_id, category);

create table if not exists public.devices (id text not null, user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text, platform text, last_seen timestamptz not null default now(), created_at timestamptz not null default now(), primary key (user_id,id));
-- Tautan berbagi (backend saja; UI & Edge Function penyajian belum dibuat). Password album disimpan sebagai hash, bukan teks.
create table if not exists public.shared_links (token text primary key default replace(gen_random_uuid()::text,'-',''),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, album_id text not null,
  password_hash text, expires_at timestamptz, views int not null default 0, created_at timestamptz not null default now());
create table if not exists public.subscriptions (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null references public.plans(id), status text not null check (status in ('trialing','active','past_due','canceled')),
  provider text, provider_ref text, current_period_end timestamptz, created_at timestamptz not null default now());
create table if not exists public.payments (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id), amount_idr integer not null, status text not null check (status in ('pending','paid','failed','refunded')),
  provider text, provider_ref text, created_at timestamptz not null default now());
do $$ declare t text; begin
  foreach t in array array['devices','shared_links'] loop
    execute format('alter table public.%I enable row level security', t); execute format('drop policy if exists "own_%1$s" on public.%1$I', t);
    execute format('create policy "own_%1$s" on public.%1$I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t); end loop;
  foreach t in array array['subscriptions','payments'] loop   -- klien hanya boleh MEMBACA; penulisan oleh webhook pembayaran (service role)
    execute format('alter table public.%I enable row level security', t); execute format('drop policy if exists "read_own_%1$s" on public.%1$I', t);
    execute format('create policy "read_own_%1$s" on public.%1$I for select to authenticated using (user_id = auth.uid())', t); end loop;
end $$;
-- Pemantauan penggunaan untuk admin. Jadikan admin: update public.user_accounts set role='admin' where user_id='<UUID>';
create or replace function public.admin_usage() returns table(user_id uuid, email text, plan_id text, used_bytes bigint, quota_bytes bigint, photo_count bigint, last_upload timestamptz)
language plpgsql security definer set search_path = public, auth as $$
begin
  if not exists (select 1 from user_accounts x where x.user_id = auth.uid() and x.role = 'admin') then raise exception 'forbidden'; end if;
  return query select a.user_id, u.email::text, a.plan_id, coalesce(sum(p.file_size) filter (where p.storage_provider='supabase'),0)::bigint,
    coalesce(a.quota_override,pl.storage_bytes), count(p.id), max(p.created_at)
  from user_accounts a join auth.users u on u.id=a.user_id join plans pl on pl.id=a.plan_id left join photos p on p.user_id=a.user_id
  group by a.user_id,u.email,a.plan_id,a.quota_override,pl.storage_bytes order by 4 desc; end $$;
revoke all on function public.admin_usage() from public, anon; grant execute on function public.admin_usage() to authenticated;
