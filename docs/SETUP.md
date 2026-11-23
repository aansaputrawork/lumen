# Setup MIKA Photos + Supabase + Google Drive

Isi ZIP tidak memuat secret apa pun. Semua nilai di bawah **Anda isi sendiri**.

## 1. Supabase
1. Buat project di https://supabase.com. Catat **Project URL** dan **anon key** (Project Settings → API).
2. Authentication → Providers → Email: aktifkan. (Opsional: matikan "Confirm email" untuk uji coba.)
3. SQL Editor: jalankan berurutan `supabase/migrations/001_base_tables.sql` lalu `002_google_drive.sql`.
   Keduanya hanya menambah tabel/kolom (IF NOT EXISTS) dan aman untuk database yang sudah berjalan.
4. Isi `config.js`: `SUPABASE_URL` dan `SUPABASE_ANON_KEY`. Jangan pernah mengisi service_role key di sini.

## 2. Google Cloud (OAuth)
1. https://console.cloud.google.com → buat project.
2. APIs & Services → Library → aktifkan **Google Drive API**.
3. OAuth consent screen: User type External, isi nama aplikasi & email. Tambahkan scope
   `.../auth/drive.file` dan `.../auth/userinfo.email`. Saat status *Testing*, tambahkan email Anda di **Test users**
   (refresh token pada mode Testing kedaluwarsa tiap 7 hari; publish ke *Production* untuk penggunaan normal.
   `drive.file` termasuk scope non-sensitif sehingga umumnya tanpa verifikasi penuh, tetapi tetap cek kebijakan Google terbaru).
4. Credentials → Create Credentials → OAuth client ID → **Web application**.
   - Authorized redirect URI: `https://<PROJECT_REF>.supabase.co/functions/v1/drive/callback`
   - Authorized JavaScript origins: alamat tempat aplikasi di-host.
5. Simpan **Client ID** dan **Client Secret** (Secret hanya untuk Edge Function, bukan frontend).

## 3. Deploy Edge Function
```bash
npm i -g supabase            # atau lihat dokumentasi CLI
supabase login && supabase link --project-ref <PROJECT_REF>
openssl rand -base64 32      # hasilnya = TOKEN_ENC_KEY
cp supabase/.env.example supabase/.env   # isi 4 nilai, jangan di-commit
supabase secrets set --env-file supabase/.env
supabase functions deploy drive --no-verify-jwt
```
`APP_URL` = alamat aplikasi persis (dengan `/` akhir), dipakai untuk CORS dan redirect setelah OAuth.

## 4. Jalankan aplikasi
Aplikasi adalah situs statis (`index.html`, `style.css`, `app.js`, `supabase-adapter.js`, `drive.js`, `config.js`).
Lokal: `python3 -m http.server 8080` lalu set `APP_URL=http://localhost:8080/` dan tambahkan origin itu di Google Cloud.
Produksi: host di Netlify/Vercel/Cloudflare Pages/GitHub Pages.

## Cara kerja
- **Auth/DB/Storage Supabase** diakses lewat `supabase-adapter.js`, yang meniru API runtime lama sehingga seluruh UI/fitur lama tidak berubah.
- **Supabase + Drive**: file ke bucket privat `photos`, lalu dicadangkan ke folder Drive. Jika backup gagal, foto tetap tersimpan, ditandai *Backup gagal*, dan bisa dicoba ulang dari Profil → Google Drive.
- **Supabase saja**: hanya bucket Supabase.
- **Drive saja**: file asli hanya di Drive (browser mengunggah langsung ke Google lewat sesi resumable yang dibuat Edge Function). Metadata tetap di tabel `photos` (`storage_provider='drive'`).
  Sebuah **thumbnail 900px** tetap disimpan di Supabase supaya galeri cepat; pratinjau besar memakai thumbnail itu, dan **Download** mengambil file asli dari Drive lewat Edge Function.
- Token: refresh token Google dienkripsi AES-GCM di tabel `drive_connections` (tidak bisa dibaca klien). Browser hanya menyimpan sesi Supabase standar.

## Batasan yang perlu Anda ketahui
- Scope **drive.file** (paling terbatas): aplikasi hanya melihat file/folder yang ia buat sendiri. Maka "pilih folder" = pilih/buat folder buatan MIKA Photos; folder lama Anda tidak muncul. Alternatif (Google Picker) butuh API key & token di browser dan tidak dipakai demi keamanan.
- **Berbagi folder**: tombol *Bagikan* membuka folder di Google Drive, lalu Anda memakai tombol Bagikan resmi Drive. Aplikasi tidak mengubah izin dan tidak pernah membuat apa pun publik.
- Video belum didukung untuk mode *Drive saja* (hanya gambar).
- Menghapus permanen foto tidak menghapus salinan di Google Drive (disengaja, agar aman).
- "Backup otomatis" = pilihan default upload menjadi *Supabase + Google Drive*. Foto lama dicadangkan lewat tombol *Cadangkan* di Profil.
- Kolom `settings` tidak diubah; pengaturan Drive disimpan di `drive_connections`.
- Upload resumable langsung ke Google membutuhkan CORS dari Google dengan header Origin yang diteruskan Edge Function. **Uji ini pertama kali** (lihat checklist).

## Checklist uji
1. Daftar/masuk → upload foto "Supabase saja" → muncul di galeri, bisa dibuka/diunduh.
2. Profil → Google Drive → Hubungkan → izinkan → status "Terhubung" dan folder "MIKA Photos" ada di Drive.
3. Upload "Supabase + Drive" → file muncul di Supabase dan di folder Drive; lencana "S + Drive".
4. Upload "Drive saja" → file hanya di Drive; lencana "Drive"; Download mengembalikan file asli.
5. Putus internet saat upload → pesan koneksi + tombol Ulangi. Cabut akses di myaccount.google.com/permissions → status "Sesi kedaluwarsa" + Hubungkan ulang. Hapus folder di Drive → pesan "Folder tidak ditemukan".

## 5. Login Google (baru)
1. Google Cloud → OAuth client **Web** (boleh yang sama dengan Drive, atau baru). Tambahkan Authorized redirect URI: `https://<PROJECT_REF>.supabase.co/auth/v1/callback`.
2. Supabase → Authentication → Providers → **Google**: aktifkan, isi Client ID & Secret.
3. Supabase → Authentication → URL Configuration: **Site URL** = alamat aplikasi; **Redirect URLs** = alamat aplikasi (dan `com.lumen.photos://login-callback` untuk aplikasi native).
4. Klien memakai alur PKCE (`?code=`), jadi tautan reset password dan login Google kembali ke halaman yang sama.
Catatan: login Google (identitas) terpisah dari "Hubungkan Google Drive" (izin file). Keduanya perlu dihubungkan sendiri-sendiri.

## 6. Migrasi 003 (paket, kuota, metadata, admin)
Jalankan `supabase/migrations/003_cloud_foundation.sql` setelah 001 dan 002. Fitur: tabel `plans` (contoh Free/Pro/Business), `user_accounts`, kuota & batas ukuran file di database, kolom metadata terstruktur, `devices`, `shared_links`, `subscriptions`, `payments`, dan fungsi `admin_usage()`.
Jadikan akun admin: `update public.user_accounts set role='admin' where user_id='<UUID>';` lalu buka `admin.html`.
Upload file >6 MB memakai TUS (resumable) lewat `tus-js-client`; batas ukuran per file tetap mengikuti **Storage → Settings → Upload file size limit** di Supabase.

## Cakupan fitur (jujur)
Sudah berfungsi di kode: kuota per paket, pengelompokan otomatis (AI di browser), upload resumable >6 MB, "Wi-Fi saja" (Chrome Android), duplikat, daftar perangkat, login Google, dasbor admin sederhana.
Hanya skema database (belum ada UI/server): tautan berbagi, password album, album privat, langganan, pembayaran. Pembayaran (mis. Midtrans/Xendit untuk IDR) butuh akun merchant dan webhook Edge Function yang menulis `subscriptions`/`payments`.
Belum ada: backup yang berjalan saat aplikasi tertutup (butuh aplikasi native), build Android/iOS, pencarian pintar berbasis isi foto.

## 7. Banyak akun Google Drive (migrasi 004)
1. SQL Editor: jalankan `supabase/migrations/004_multi_drive.sql` (setelah 001-003). Aman untuk data lama: koneksi Drive yang sudah ada otomatis menjadi akun *default* dan foto lama diberi `drive_conn_id`-nya.
2. Deploy ulang fungsi: `supabase functions deploy drive --no-verify-jwt`.
3. Di aplikasi: Profile > Google Drive > **Add another Google Drive** (Google akan menampilkan pemilih akun). Tiap akun punya folder sendiri; satu akun ditandai **Default** (tujuan upload bawaan dan backup otomatis). Saat upload ke Drive dan ada lebih dari satu akun, muncul pilihan **Google Drive account**.
4. Tiap foto/video mengingat akun Drive miliknya (`photos.drive_conn_id`), jadi pemutaran, unduhan, dan streaming selalu memakai akun yang benar. Memutus satu akun tidak mengganggu akun lain.

## 8. Import from Drive (menu Upload > From Google Drive)
File di Drive tidak bisa dijelajahi bebas karena scope `drive.file` (sengaja dibatasi). Impor memakai **Google Picker**: file yang Anda pilih di jendela Picker otomatis boleh diakses aplikasi. File **tidak disalin**; hanya dicatat di perpustakaan (thumbnail dibuat), dan menghapusnya dari MIKA tidak menghapus file di Drive.
Konfigurasi sekali saja:
1. Google Cloud Console (project yang sama dengan OAuth): **APIs & Services > Library** > aktifkan **Google Picker API**.
2. **Credentials > Create credentials > API key**. Batasi key: *Websites* = alamat aplikasi Anda dan `https://docs.google.com/*`; *API restrictions* = Google Picker API dan Google Drive API. Pastikan kedua API tersebut aktif di project yang sama.
3. Catat **Project number** (Dashboard > Project info).
4. Set secret lalu deploy ulang:
```
supabase secrets set PICKER_API_KEY=... PROJECT_NUMBER=...
supabase functions deploy drive --no-verify-jwt
```
Tanpa dua secret ini, tombol "From Google Drive" menampilkan pesan bahwa impor belum disiapkan.

## Video di Google Drive: batas yang perlu diketahui
- Video diputar lewat endpoint `/drive/stream` (mendukung Range, jadi bisa seek). **Setiap video yang diputar melewati Edge Function**, sehingga ikut menghabiskan *egress* dan jumlah *invocation* Supabase (Free plan: 5 GB egress dan 500.000 invocation per bulan, dihitung bersama semua pemakaian lain). Peramban meminta video per potongan (Range), jadi satu kali putar bisa berarti beberapa invocation.
- Format: MP4 (H.264/AAC) dan WebM aman di semua peramban. HEVC/H.265 (.mov dari iPhone) hanya diputar di Safari/sebagian perangkat; Chrome/Firefox mungkin tidak bisa. Aplikasi tidak melakukan transcoding.
- Kuota unduh harian Google Drive tetap berlaku untuk file yang sangat sering diakses.


### Import from Google Drive (copy into MIKA Cloud)

The Import from Google Drive action uses Google Picker to select image/video files, then downloads each selected original (directly from Google using the Picker token, falling back to the authenticated `drive` Edge Function if the direct request fails) and uploads it into the user's Supabase Storage. The source file in Google Drive is left unchanged. Imported media therefore consumes the user's MIKA Cloud storage quota. The import is performed sequentially while MIKA is open; large files require sufficient browser memory and an available network connection.


## 9. Perbaikan Import dari Google Drive (Update 06)
- Unduhan file asli kini langsung dari Google (token Picker, dengan refresh otomatis bila kedaluwarsa), sehingga video/foto besar tidak lagi dibatasi waktu/egress Edge Function. Jika akses langsung gagal, otomatis memakai `import_download` seperti sebelumnya. **Edge Function tidak berubah, tidak perlu deploy ulang.**
- Seluruh jalur impor tidak lagi bergantung pada fungsi global yang mungkin belum ada (`mkThumb`, `mkVThumb`, `autoCat`, `CATS`, `save`, `assets`); bila tidak ada, dipakai fallback sehingga impor tidak gagal diam-diam dan tidak menghapus file yang sudah terunggah.
- Pesan galat lebih jelas (mis. kuota MIKA Cloud tidak lagi tertulis "Google Drive penuh"), tanggal EXIF terbaca di Safari, progres unduhan tampil, dan file yang sudah ada (berdasarkan ID Drive) dilewati.

## 10. Backup otomatis (Update 06)
Profile > Google Drive > **Automatic backup**. Semua berjalan **selama MIKA terbuka** (peramban tidak mengizinkan web app memindai galeri saat tertutup).
1. **Cloud → Drive**: bila *Auto backup to Drive* pada akun default aktif, file MIKA Cloud yang belum tercadangkan (termasuk yang gagal) dikirim ke Drive otomatis saat aplikasi dibuka, kembali ke depan, atau online lagi. Foto lama ikut tercadangkan sekali.
2. **HP → MIKA Cloud (+ Drive)** lewat dua jalur:
   - **Watch a phone folder**: pilih satu folder sekali (File System Access API; tersedia di Chrome/Edge desktop, **belum di Chrome Android/iOS**). File baru (atau semua file, pilihan saat mengaktifkan) diunggah otomatis; setelah browser di-restart, izin folder perlu disetujui lagi dengan satu ketukan (*Allow*).
   - **Share target** (Android, PWA terpasang): di galeri pilih foto > Bagikan > MIKA; file masuk antrean dan dicadangkan otomatis. Tambahkan ini ke `manifest.webmanifest`:
```json
"share_target": {
  "action": "./share-target",
  "method": "POST",
  "enctype": "multipart/form-data",
  "params": { "files": [ { "name": "media", "accept": ["image/*", "video/*"] } ] }
}
```
   Setelah itu pasang ulang PWA (atau hapus lalu pasang) agar Android membaca manifest baru.
3. **Wi-Fi only** (aktif bawaan; memakai `navigator.connection`, hanya tersedia di Chrome/Android) dan tujuan *MIKA Cloud + Drive* atau *MIKA Cloud only*.
4. Duplikat dicegah dengan sidik jari `nama|ukuran|tanggal-ubah` (kolom di `data.src_fp`, tanpa migrasi) dan kecocokan nama+ukuran dengan foto yang sudah ada. Foto yang sebelumnya diunggah dengan kompresi/ukuran berbeda bisa terunggah sekali lagi.
5. Untuk backup sungguhan di latar belakang (galeri HP, saat aplikasi tertutup), perlu pembungkus native (mis. Capacitor + plugin background upload). Kode `ingest()` di `drive.js` bisa dipakai ulang.

File yang berubah: `drive.js`, `supabase-adapter.js` (opsi `f._mode`, `LSB.docs/loaded`), `sw.js` (v11, share target). Tidak ada migrasi SQL baru.
