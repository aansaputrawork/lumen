# MIKA Update 07 — Import Google Drive bawaan

## Perubahan
- Mengganti Google Picker iframe dengan pemilih file langsung di MIKA.
- Menampilkan foto/video dari Google Drive melalui Edge Function.
- Mendukung pencarian nama, multi-select, dan pagination (50 file per halaman).
- Unduhan file asli melewati Edge Function lalu disalin ke MIKA Cloud; file sumber di Drive tidak diubah.
- Menggunakan `drive.readonly` bersama `drive.file` dan `userinfo.email`.
- Menghapus ketergantungan pada Google Picker API, API key Picker, dan Project Number.
- Menaikkan cache service worker ke `mika-v12`.

## Penerapan
1. Salin isi ZIP ke folder utama repository MIKA dan izinkan file yang sama ditimpa.
2. Deploy Edge Function:
   ```bash
   supabase functions deploy drive --project-ref aglzcaqazhbgntahkfyy
   ```
3. Commit dan push perubahan frontend ke GitHub agar Vercel membangun ulang aplikasi.
4. Setelah deployment selesai, buka MIKA dan coba Upload → From Google Drive.

Catatan:
- Akun Google harus sudah menyetujui izin **See and download all your Google Drive files** (`drive.readonly`).
- Jika akun belum memberikan izin tersebut, putuskan lalu hubungkan kembali Google Drive dan setujui izin itu.
- Google OAuth app yang masih berstatus Testing tetap hanya dapat digunakan oleh akun yang terdaftar sebagai Test users.
- File impor disalin ke Supabase Storage sehingga memakai kuota MIKA Cloud.
