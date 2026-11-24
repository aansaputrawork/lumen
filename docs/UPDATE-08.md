# MIKA Update 08 — Galeri Google Drive langsung

## Perubahan
- Menambahkan tombol **Open gallery** pada setiap akun Google Drive yang terhubung.
- MIKA menampilkan folder dan subfolder sesuai struktur asli Google Drive.
- Folder dapat dibuka bertingkat dan navigasi breadcrumb mengikuti jalur folder.
- Foto ditampilkan langsung dari Google Drive menggunakan thumbnail dan pratinjau file asli.
- Mendukung pagination untuk folder dengan banyak isi.
- Tampilan ini bersifat baca-saja: tidak mengimpor, menyalin, memindahkan, mengubah, atau menghapus file Google Drive.
- Fitur **Import from Google Drive** tetap tersedia dan tidak diubah.
- Cache service worker dinaikkan ke `mika-v13`.

## Penerapan
1. Salin isi ZIP ke folder utama repository MIKA dan izinkan file yang sama ditimpa.
2. Deploy Edge Function:
   ```bash
   supabase functions deploy drive --project-ref aglzcaqazhbgntahkfyy
   ```
3. Commit dan push perubahan frontend ke GitHub agar Vercel membangun ulang aplikasi.
4. Buka Profile → Google Drive → **Open gallery**.

Catatan:
- Akun Google harus terhubung dan memiliki izin Drive yang sebelumnya digunakan MIKA.
- Folder dan foto yang terlihat mengikuti izin akses akun Google yang dipilih.
- Galeri dibuka per folder; ketuk subfolder untuk melihat isi folder tersebut.
- Fitur ini menampilkan foto/gambar. Video tetap tersedia melalui galeri dan fitur Drive yang sudah ada, tetapi belum ditambahkan ke tampilan folder langsung ini.
