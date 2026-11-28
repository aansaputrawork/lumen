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
`features.js` (kuota, kelompok otomatis, duplikat), `admin.html`, `supabase/migrations/003_cloud_foundation.sql`, `capacitor.config.json` + `docs/MOBILE.md`. Login Google & cakupan fitur: lihat `docs/SETUP.md` bagian 5-6.

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

## Pembaruan: kalender video, preview, video Drive, tipografi
- **Kalender**: tiap tanggal memakai item terbaru hari itu, foto ATAU video (poster diambil dari frame videonya). Penanda kecil ▶ (dengan jumlah bila lebih dari 1 video) di pojok kiri atas kotak; angka kanan atas = total item (`calUI` di `gallery.js`).
- **Slider thumbnail** di preview: video memakai poster dari videonya + tanda ▶ (`thumb` di `gallery.js`).
- **Preview**: 
  - Frame foto/video **terkunci**: ukuran dihitung dari rasio `p.w/p.h` dan area yang sama (`fit()`), sehingga tidak membesar/mengecil saat thumbnail diganti foto penuh, saat video dimuat, saat menggeser, atau saat menu dibuka/ditutup. Area preview diperluas (ruang atas 62px, bawah 72px/134px bila ada slider; variabel `--pvb` di `gallery.css`).
  - Urutan bawah ke atas: **dock menu** (paling bawah) -> **slider** tepat di atasnya. Kategori pindah ke pojok kanan atas.
  - Dock berisi tombol toggle (⋯ / ˅). Ketuk untuk menampilkan semua aksi: Share, Favorite, Detail, Download, Delete. Pilihan terakhir diingat (`localStorage` kunci `pvMenu`; default tertutup).
- **Video Google Drive bisa diputar**: video yang hanya ada di Drive tidak punya URL file (URL-nya thumbnail), jadi dulu tidak bisa diputar. Sekarang Edge Function `drive` punya aksi `stream_url` + endpoint `GET /drive/stream` (URL bertanda tangan HMAC berumur 6 jam, mendukung header `Range` sehingga bisa seek). Klien memakai `vidSrc(p)` (`drive.js`); jika streaming gagal otomatis unduh lalu putar dari blob. Poster video Drive juga diambil lewat stream, tidak lagi mengunduh seluruh file. **Wajib deploy ulang Edge Function**: `supabase functions deploy drive` (tidak ada secret/konfigurasi baru; `verify_jwt = false` sudah ada).
- **Tipografi**: satu font untuk seluruh aplikasi lewat token `--font` (`style.css`), dan skala ukuran mengikuti halaman Album: judul halaman 28px/700, judul seksi 20px/700, judul kartu 17px/600, isi 15px/400, chip 14px, keterangan 12px. Pengecilan font khusus halaman Profile (`.pfp`) dihapus. Login, admin, popup dan preview memakai font yang sama.

## Pembaruan preview (dock & hapus)
- Nama/tanggal di atas preview: teks saja, tanpa kapsul (dengan bayangan tipis agar terbaca di atas foto).
- Dock rata kanan: tombol toggle tetap di kanan, aksi membuka ke arah kiri. Kategori (mis. Portraits) ada di paling kiri dock dengan gaya pil kaca yang sama; nama panjang dipotong dengan "…" saat menu dibuka.
- Dock berjarak 20px dari tepi bawah layar (`.pv-bot` padding-bottom di `gallery.css`; ubah juga `--pvb` agar area preview ikut menyesuaikan).
- Hapus foto/video (di preview maupun mode Select) kini meminta konfirmasi lewat dialog `confirmDelete` (gaya sama dengan dialog hapus permanen; teks bisa diatur lewat parameter ketiga `{title,sub,ok}`).

## Skala tipografi (final)
Satu font (`--font`) dan satu skala ukuran: **12** keterangan/badge, **13** label kecil, **14** chip & tombol sekunder, **15** isi & tombol utama, **17** judul kartu/sheet, **20** judul seksi & dialog, **28** judul halaman. Input teks tetap 16px (mencegah zoom otomatis di iOS). Judul besar pada kartu bulan/album sengaja relatif terhadap lebar kartu (`cqw`).

## Pembaruan: preview tanpa frame, geser bulan, animasi UI
- **Preview tanpa frame**: foto/video tampil apa adanya (tanpa kotak, sudut membulat, bayangan, atau latar). Ukuran dihitung dari rasio asli file dan diskalakan muat di area di atas slider/dock (`fit()` di `gallery.js`, ruang bawah `--pvb` di `gallery.css`). Seek bar video ikut menempel di tepi bawah video.
- **Kalender geser antar bulan** (`gallery.js`, blok "GESER ANTAR BULAN"): seret kiri/kanan (touch/mouse), panah kiri/kanan di keyboard, atau geser horizontal di trackpad. Bulan lama meluncur keluar, bulan baru masuk dari sisi lawan, judul bulan memudar halus; dibatasi dari bulan foto terawal sampai bulan terbaru/bulan ini (di batas ada gerakan "menolak" kecil). `calGo(+1/-1)` bisa dipanggil dari kode lain.
- **Edit profile**: bagian cover dihapus (cover diedit dengan mengetuk cover di Profile).
- **Animasi UI (`motion.js` + bagian "MOTION" di `style.css`)**, semua mati bila perangkat memilih *reduce motion*:
  1. Transisi halaman berarah: pindah tab ke kanan = halaman masuk dari kanan, ke kiri = dari kiri; masuk/keluar sub-halaman (mis. kalender) = maju/mundur.
  2. Navigasi bawah: pil merah meluncur dari tab lama ke tab baru.
  3. Segmented control (Profile > Appearance): thumb meluncur.
  4. Bilah penyimpanan (Profile) terisi dari 0.
  5. Umpan balik sentuh: kartu, baris, hari kalender, dan foto mengecil sedikit saat ditekan; kartu terangkat saat hover (desktop).
  6. Baris daftar (Albums/Profile) muncul berurutan; gulir horizontal kartu/pil kategori halus.
  7. Preview: cincin pulsa saat menandai favorit, ikon toggle dock berputar saat membuka/menutup.
  Animasi yang sudah ada sebelumnya tetap: kartu muncul, sheet/dialog/toast, foto masuk berurutan di grid, centang seleksi, buka/tutup preview, geser slider, dock membuka ke kiri.

## Pembaruan: sudut preview, banyak Drive, impor dari Drive
- **Preview**: gambar/video tampil tanpa frame tapi dengan sudut membulat 26px yang mengikuti bentuk gambar asli untuk ukuran/rasio apa pun (radius mengecil proporsional hanya untuk gambar sangat kecil). Lihat `fit()` di `gallery.js`.
- **Banyak akun Google Drive**: tiap akun punya koneksi sendiri (`drive_connections.id`), folder, dan penanda *Default*. Foto menyimpan akun asalnya (`photos.drive_conn_id`). UI di Profile > Google Drive; pilihan akun tujuan muncul di sheet Upload. Perlu migrasi `004_multi_drive.sql` dan deploy ulang fungsi `drive` (lihat `docs/SETUP.md` bagian 7).
- **Menu Upload**: bila ada Drive terhubung, ikon upload menampilkan *From this device* dan *From Google Drive*. Impor memakai pemilih file bawaan MIKA dan Drive API melalui Edge Function (lihat `docs/SETUP.md` bagian 8). Fungsi: `uploadMenu`, `D.imp`, `D.doImport` di `drive.js`; aksi server `list_media`, `import_info`, `import_download`, `import_thumb`.
- **Streaming video Drive**: URL stream kini terikat ke akun Drive dan membawa tipe MIME agar Safari/Chrome memutar dengan benar.

## Google Drive Albums (Update 10)
- Folder dan subfolder Google Drive dibuka langsung dari halaman **Albums** MIKA; hierarki dan nama folder mengikuti Google Drive.
- Foto dan video ditampilkan serta dipratinjau langsung dari Google Drive. File tidak disalin ke Supabase hanya karena dibuka.
- Folder dapat dibuat, diganti nama, atau dipindahkan ke Google Drive Trash (termasuk isinya).
- Pengaturan koneksi, izin OAuth, akun default, dan backup tetap ada di Profile → Google Drive. Tidak ada lagi halaman terpisah atau tombol Open gallery.
- Modul baru: `drive-albums.js`; cache PWA dinaikkan ke `mika-v15`. Deploy ulang Edge Function `drive` setelah update.

## Pembaruan 11: download, progres, kategori Drive
- `download.js`: `LDL.save` (download benar di iPhone/PWA/WebView, tidak lagi pindah ke halaman gambar) dan `LProg` (kartu progres tunggal yang stabil, dipakai impor, backup, kategori Drive, simpan ke galeri).
- Kategori foto Drive: Profile > Google Drive > "Sort Drive photos into categories", atau tombol "Add to categories" di Albums > Google Drive. File asli tetap di Drive; kuota MIKA Cloud tidak terpakai oleh foto yang hanya ada di Drive.
- Baris Account/Folder/Open rata kanan; "Watch folder" hanya tampil di peramban desktop; "Send to" diganti "Back up to" dengan penjelasan. Cache PWA `mika-v27`.
