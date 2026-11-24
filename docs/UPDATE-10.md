# MIKA Update 10 — Google Drive Albums

## Yang berubah
- Google Drive kini ditelusuri dari tab **Albums** MIKA. Tidak ada halaman Google Drive Gallery terpisah atau tombol **Open gallery**.
- Setiap akun Drive yang terhubung muncul sebagai pintu masuk. Folder dan subfolder ditampilkan mengikuti struktur asli Google Drive.
- Foto dan video tampil langsung di dalam folder. Preview menggunakan viewer MIKA dan membaca file sumber dari Google Drive; membuka/meninjau file tidak menyalinnya ke Supabase.
- Di dalam folder, pengguna dapat membuat subfolder, mengganti nama folder, dan memindahkan folder beserta isinya ke Google Drive Trash. Folder di Trash masih dapat dipulihkan melalui Google Drive.
- Profile → Google Drive tetap berisi koneksi akun, Update permissions, Make default, Disconnect, Auto backup, dan pengaturan backup.
- Baris Devices di Profile dihapus dan pencatatan perangkat baru dihentikan. Tabel lama tidak dihapus.
- Tombol Sign out tunggal tetap ada di Profile → Account.
- Service worker cache dinaikkan ke `mika-v15` dan memuat `drive-albums.js`.

## File yang berubah
- `drive-albums.js` — integrasi folder, subfolder, foto/video, thumbnail, preview, create/rename/trash.
- `drive.js` — API untuk modul Albums, streaming video multi-akun, hapus halaman Gallery terpisah.
- `supabase/functions/drive/index.ts` — daftar video dan aksi memindahkan folder ke Trash.
- `app.js` — menampilkan Drive Albums di tab Albums dan menghapus Devices dari Profile.
- `features.js` — menghentikan pencatatan perangkat.
- `index.html`, `gallery.css`, `sw.js` — script, gaya, dan cache PWA.
- `README.md` dan `docs/SETUP.md` — dokumentasi.

## Langkah pemasangan
1. Tarik perubahan frontend dari GitHub atau salin file update ke repository MIKA.
2. Deploy ulang Supabase Edge Function:
   ```bash
   supabase functions deploy drive --project-ref <PROJECT_REF>
   ```
3. Pastikan scope Google OAuth `https://www.googleapis.com/auth/drive` sudah ditambahkan di Google Cloud. Jika belum menyetujui izin baru di MIKA, buka Profile → Google Drive → **Update permissions**, pilih akun yang sama, lalu setujui.
4. Tunggu Vercel selesai deploy. Tutup lalu buka ulang MIKA agar service worker mengambil cache `mika-v15`.
5. Buka Albums → Google Drive Albums → pilih akun. Uji buka folder/subfolder, foto, video, buat folder, rename, dan pindahkan folder uji ke Trash.

## Catatan keamanan dan perilaku
- Memindahkan folder ke Trash juga memindahkan seluruh isi folder. Ini bukan penghapusan permanen; konfirmasi ditampilkan sebelum tindakan.
- File Google Drive tetap berada di Google Drive. MIKA hanya mengambil thumbnail/isi untuk ditampilkan atau diputar.
- Jika koneksi akun Drive terputus atau izin OAuth kedaluwarsa, sambungkan kembali akun melalui Profile.
- Pencatatan perangkat baru dihentikan, tetapi data lama pada tabel `devices` tidak dihapus.
