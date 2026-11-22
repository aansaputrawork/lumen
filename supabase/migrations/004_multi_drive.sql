-- Banyak akun Google Drive per pengguna. Hanya MENAMBAH/mengubah kunci; data lama dipertahankan.
-- 1) drive_connections: kunci utama pindah dari user_id ke id (uuid), 1 baris = 1 akun Google.
alter table public.drive_connections add column if not exists id uuid not null default gen_random_uuid();
alter table public.drive_connections add column if not exists is_default boolean not null default false;
do $$ begin
  if exists (select 1 from pg_constraint where conname = 'drive_connections_pkey' and conrelid = 'public.drive_connections'::regclass
             and (select array_agg(attname::text) from pg_attribute where attrelid = conrelid and attnum = any(conkey)) = array['user_id']) then
    alter table public.drive_connections drop constraint drive_connections_pkey;
    alter table public.drive_connections add primary key (id);
  end if;
end $$;
create unique index if not exists drive_conn_user_email on public.drive_connections (user_id, google_email);
create index if not exists drive_conn_user on public.drive_connections (user_id);
-- koneksi yang sudah ada = default
update public.drive_connections c set is_default = true
 where not exists (select 1 from public.drive_connections d where d.user_id = c.user_id and d.is_default)
   and c.id = (select d2.id from public.drive_connections d2 where d2.user_id = c.user_id order by d2.created_at limit 1);

-- 2) photos: file di Drive milik akun yang mana
alter table public.photos add column if not exists drive_conn_id uuid;
update public.photos p set drive_conn_id = c.id
  from public.drive_connections c
 where c.user_id = p.user_id and p.drive_conn_id is null and c.is_default
   and (p.google_drive_file_id is not null or p.backup_drive_file_id is not null);
create index if not exists photos_drive_conn_idx on public.photos (drive_conn_id);
