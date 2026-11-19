# MIKA Photos (Supabase + Google Drive)
Mulai dari `docs/SETUP.md`. Struktur: `index.html`, `style.css`, `app.js` (aplikasi asli + hook), `supabase-adapter.js`, `drive.js`, `config.js`,
`popup.css`, `login.css`, `login-config.js`, `cover.js`, `profile.js`, `preview.html`, `supabase/migrations/*.sql`, `supabase/functions/drive/index.ts`.
Tidak ada secret di repo ini; isi `config.js` (anon key) dan secret Edge Function sendiri.

## Tema MIKA
Warna diambil dari logo: merah `#CD0921` dan hitam `#0C0A0B`. Semua token ada di bagian atas `style.css` (`--ac` merah logo, `--ac2` merah terang untuk teks kecil, `--bg/--sf/--pill/--tx/--mu` permukaan & teks).
- **Profile > Appearance**: `Light`, `Dark`, `MIKA`. MIKA adalah default (pengganti mode "System"; nilai lama `system` otomatis jadi MIKA). Light/Dark tetap memakai aksen merah yang sama.
- Pop up kaca (`popup.css`, token `--pg-*`), halaman login (`login.css`) dan `admin.html` ikut palet yang sama.
- Warna bar browser/PWA: `theme-color` di `index.html` & `manifest.webmanifest` (`#0C0A0B`), berganti otomatis saat tema diubah.

## Halaman login
Pengaturan di **`login-config.js`**.
- **Image**: `assets/login-hero.png` (persegi 1200x1200, latar `#0C0A0B` supaya menyatu dengan halaman; tagline sudah ada di dalam image).
- **Logo kecil** di atas judul form: `assets/logo.png` (hapus file = huruf `logo.text`).
- **Ikon aplikasi/PWA**: `icons/icon-192.png`, `icons/icon-512.png` (dari `MIKA_photos-512.png`), `icons/maskable-512.png` (wordmark saja, dengan ruang aman untuk ikon adaptif Android).
- Foto lama ada di `assets/archive/`.
## Cover profil
`cover.js`: kotak atas Profil jadi cover. Ketuk cover lalu "Edit cover" (juga bisa langsung mengetuk area cover di Profil → Account → Edit profile): pilih dari library, upload, atau reset ke otomatis. Tidak ada lagi tombol "Edit cover" terpisah di Edit profile.
## Pop up (satu gaya kaca)
`popup.css`: semua pop up memakai gaya yang sama dengan pil "6 items" di cover (latar bening + blur + garis tipis putih + teks putih).
Ubah tampilan SEMUA pop up sekaligus lewat token `--pg-*` di bagian atas file itu. Cakupan: bottom sheet (menu, edit cover, rename, pilih foto, upload, folder Drive), action sheet, dialog hapus permanen, toast.
Kartu kaca & pesan error di halaman login: `login.css` (nilai yang sama).
Nama di cover profil: `.card.pf b` di `style.css` (angka `-4px` = seberapa turun melewati garis bawah cover).
## Preview
Buka `preview.html` (satu file, tanpa server/Supabase): login (isi email/password apa saja) lalu masuk ke aplikasi dengan foto demo. Data hanya di memori.
## PWA
`manifest.webmanifest`, `sw.js`, `icons/` (ikon buatan sendiri; ganti dengan logo resmi bila ada). `assets/demo/` = salinan foto demo yang tertanam di `app.js` (tidak dipakai kode).

## Baru
`features.js` (kuota, kelompok otomatis, duplikat, perangkat), `admin.html`, `supabase/migrations/003_cloud_foundation.sql`, `capacitor.config.json` + `docs/MOBILE.md`. Login Google & cakupan fitur: lihat `docs/SETUP.md` bagian 5-6.

## Galeri kalender & preview foto
`gallery.js` + `gallery.css`:
- **Detail bulan** (klik kartu bulan di Home): hanya bulan yang diklik yang tampil, berupa grid kalender 7 kolom (satu kotak per hari, dengan nama hari di atasnya). Hari berfoto menampilkan foto + angka (badge jika >1 foto), hari kosong redup. Ketuk hari: kotak menyala lalu foto hari itu terbuka di preview; saat preview ditutup, cahaya kotak meredup lagi.
- **Preview foto** (`LViewer`, dipakai semua tempat yang membuka foto): latar blur dari foto, tombol & bar aksi kaca, strip thumbnail, animasi terbang dari/ke thumbnail, zoom cubit/dobel-ketuk, ketuk sekali untuk sembunyikan kontrol, panah keyboard.
  - **Pil kategori** (mis. "People") tampil di atas strip thumbnail dan berganti sesuai foto saat digeser.
  - **Bar aksi**: Share, **Favorite** (hati; foto masuk album Favorites), **Detail** (ikon i; info foto + "Add to album…" + Rename), Download, Delete. Tombol album di bar dihapus; menambah ke album sekarang lewat sheet Detail atau mode Select.
  - **Favorites**: kartu pertama di tab Albums (dan baris Media Types > Favorites). Foto favorit diberi lencana hati kecil di grid.
  - **Video**: tombol play kaca melayang di tengah video (seperti galeri iPhone), ketuk video untuk jeda, ada penggeser waktu tipis di bawah video.
  - **Menutup**: tombol X, Esc, atau tarik ke bawah. Foto "terbang" kembali ke thumbnail/kotak hari asalnya sambil latar memudar (fungsi `closeP` di `gallery.js`). Jika thumbnail tidak terlihat di layar, foto memudar turun.
- **Cover profil**: ketuk cover untuk membuka pop up foto cover (kode di `cover.js`, gaya di `popup.css`).

## Profil
`profile.js` (+ gaya di akhir `popup.css`):
- **Edit profile**: satu pop up untuk foto profil, cover (ketuk area cover, tanpa tombol terpisah), dan display name (Profil -> Account -> Edit profile).
- **Photo categories**: satu pop up untuk kategori default saat upload dan kategorisasi otomatis foto yang sudah ada ("Other" saja atau semua foto). Logika AI-nya tetap di `features.js` (`LF.regroupRun`).

## Preview HTML
`preview.html` dibuat otomatis dari file project. Setelah mengubah kode, jalankan:
```
python3 scripts/build-preview.py
```
Data demo (foto, video, Supabase palsu) ada di `scripts/preview/`.

## Thumbnail video & album
- **Thumbnail video**: saat upload, frame video diambil jadi poster JPG (`mkVThumb` di `app.js`, disimpan di `th`, tidak menambah kuota). Video lama tanpa poster dibuat otomatis saat pertama tampil (`vtEnsure`) lalu disimpan. Kartu album/kategori **Motion** & **Videos**, baris Media Types, Recents, dan viewer memakai poster ini (sebelumnya `<img>` menunjuk file video sehingga rusak).
- **Nama album**: lebar teks "Moments" (`AREF`) pada ukuran acuan `AFS` (cqw) = batas maksimum lebar teks. Nama lebih panjang mengecil otomatis; kecilkan `AFS` kalau masih terasa mepet (fungsi `fs` di `app.js`).
