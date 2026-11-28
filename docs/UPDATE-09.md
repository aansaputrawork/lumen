# MIKA Update 09 — Google Drive Gallery

## Yang berubah
- Google Drive Gallery memakai layout masonry dan tema MIKA yang sama dengan galeri utama.
- Folder dan subfolder tetap mengikuti struktur asli Google Drive. Breadcrumb, refresh, dan pagination tetap tersedia.
- Preview foto menggunakan komponen `LViewer` milik MIKA: zoom, swipe, dan filmstrip thumbnail. Foto dibaca langsung dari Google Drive; tidak diimpor ke Supabase.
- Folder dapat dibuat di lokasi yang sedang dibuka dan diganti namanya melalui tombol `···`. Tidak ada aksi hapus folder atau foto.
- Service worker cache version dinaikkan agar file frontend terbaru diambil setelah deployment.

## File yang berubah
- `drive.js` — UI Google Drive Gallery, create folder, rename folder, dan preview integration.
- `gallery.js` — dukungan preview read-only dengan pemuatan foto resolusi penuh sesuai kebutuhan.
- `gallery.css` — styling yang mengikuti tema dan masonry MIKA.
- `sw.js` — cache version `mika-v14`.
- `supabase/functions/drive/index.ts` — OAuth scope `drive`, validasi scope, create folder, dan rename folder.
- `docs/SETUP.md`, `README.md` — dokumentasi scope dan alur baru.

## Langkah pemasangan
1. Salin seluruh isi ZIP Update 09 ke folder utama repository MIKA, lalu pilih Replace untuk file yang sama.
2. Di Google Cloud Console → APIs & Services → OAuth consent screen → Data Access, tambahkan scope `https://www.googleapis.com/auth/drive` dan simpan. Pastikan akun pengguna terdaftar sebagai Test user jika aplikasi masih Testing.
3. Deploy Edge Function: `supabase functions deploy drive --project-ref aglzcaqazhbgntahkfyy`.
4. Commit dan push perubahan frontend ke GitHub agar Vercel deploy.
5. Setelah deployment, buka MIKA → Profile → Google Drive → **Update permissions**. Pilih akun Google yang sama dan setujui izin baru. Callback akan memperbarui koneksi akun yang sama; tidak perlu menghapus folder atau file Drive.
6. Buka **Open gallery**. Coba buat folder, rename folder, buka foto, swipe, zoom, dan unduh foto.

## Catatan izin Google
Scope `drive` memberi aplikasi akses yang lebih luas ke file dan folder Google Drive dibanding scope sebelumnya. MIKA hanya menjalankan tindakan yang dipilih pengguna pada galeri (membaca foto, membuat folder, mengganti nama folder); tidak ada aksi hapus di UI. Google mengategorikan scope ini sebagai restricted. Aplikasi untuk pengguna umum dapat memerlukan verifikasi Google dan persyaratan tambahan. Jika aplikasi External masih berstatus Testing, refresh token dapat kedaluwarsa setelah 7 hari sehingga akun mungkin perlu diotorisasi ulang.

## Pengujian
Pemeriksaan sintaks JavaScript dijalankan untuk `drive.js` dan `gallery.js`. Deployment Supabase, OAuth consent baru, dan akses terhadap akun Google pengguna perlu diuji setelah pemasangan.
