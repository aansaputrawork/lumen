-- Migrasi Google Drive. Hanya MENAMBAH kolom/tabel; tidak menghapus atau mengubah data yang ada.
alter table public.photos
  add column if not exists storage_provider      text not null default 'supabase',
  add column if not exists storage_path          text,
  add column if not exists google_drive_file_id  text,
  add column if not exists backup_drive_file_id  text,
  add column if not exists backup_status         text not null default 'none',
  add column if not exists mime_type             text,
  add column if not exists file_size             bigint,
  add column if not exists original_file_name    text;
do $$ begin
  begin alter table public.photos add constraint photos_storage_provider_chk check (storage_provider in ('supabase','drive')); exception when duplicate_object then null; end;
  begin alter table public.photos add constraint photos_backup_status_chk check (backup_status in ('none','pending','done','failed')); exception when duplicate_object then null; end;
end $$;
-- Isi kolom baru untuk baris lama (jika ada)
update public.photos set storage_path = data->>'aid', mime_type = data->>'type', original_file_name = data->>'name',
  file_size = nullif(data->>'size','')::numeric::bigint
where storage_path is null and storage_provider = 'supabase' and data ? 'aid';
create index if not exists photos_backup_idx on public.photos (user_id, backup_status);

-- Koneksi Google per pengguna. Refresh token terenkripsi (AES-GCM) dan HANYA bisa diakses Edge Function (service role).
create table if not exists public.drive_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  google_email text, refresh_token_enc text not null,
  status text not null default 'connected' check (status in ('connected','expired','disconnected')),
  folder_id text, folder_name text, auto_backup boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.drive_connections enable row level security;   -- tanpa policy = klien tidak bisa membaca
revoke all on public.drive_connections from anon, authenticated;
