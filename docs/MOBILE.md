# Aplikasi Android & iPhone (Capacitor)

Status: **kerangka siap, belum pernah di-build** (butuh Android Studio / Xcode di komputer Anda; Xcode hanya ada di macOS).

## Langkah
1. `npm install` lalu `npx cap add android` dan `npx cap add ios`, lalu `npm run sync`.
2. `npm run android` / `npm run ios` membuka proyek native. Build & jalankan dari sana.

## Deep link login Google
- Skema: `com.lumen.photos://login-callback`.
- Supabase → Authentication → URL Configuration → Redirect URLs: tambahkan skema di atas (dan alamat web Anda).
- Android (`AndroidManifest.xml`, di `<activity>` utama): `<intent-filter><action android:name="android.intent.action.VIEW"/><category android:name="android.intent.category.DEFAULT"/><category android:name="android.intent.category.BROWSABLE"/><data android:scheme="com.lumen.photos"/></intent-filter>`
- iOS (`Info.plist`): `CFBundleURLTypes` dengan `CFBundleURLSchemes` = `com.lumen.photos`.
- `features.js` sudah menangani `appUrlOpen` dan menukar `code` menjadi sesi; `login.js` membuka browser sistem lewat plugin Browser.

## Izin foto/video
- iOS `Info.plist`: `NSPhotoLibraryUsageDescription`, `NSCameraUsageDescription`.
- Android 13+: `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`. Picker file native sudah dipakai lewat `<input type=file accept="image/*,video/*">` (WebView memanggil picker sistem).

## Belum ada (perlu pekerjaan native tambahan)
- **Backup otomatis di latar belakang** dan **notifikasi backup**: perlu plugin background task/upload native (mis. plugin background-upload atau kode Kotlin/Swift sendiri). WebView tidak bisa mengunggah saat aplikasi ditutup.
- **Deteksi Wi-Fi yang andal**: pasang `@capacitor/network` dan ganti `netOK()` di `features.js` agar membaca `Network.getStatus().connectionType`. Di browser iPhone, `navigator.connection` tidak tersedia, jadi opsi "Wi-Fi saja" tidak bisa memblokir data seluler di sana.
- Ikon & splash native: gunakan `@capacitor/assets` dengan logo resmi.
