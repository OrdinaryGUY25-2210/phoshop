# PS Lite — Editor Foto Gaya Photoshop

Aplikasi editor foto **satu codebase untuk 3 platform**:

| Platform | Cara |
|---|---|
| **Browser / Mobile (PWA)** | Buka `index.html` atau serve via HTTP lalu "Install App" |
| **Desktop native** | Wrapper Electron di folder `desktop/` |
| **Android (APK)** | Konversi via Capacitor (lihat di bawah) |

## Fitur lengkap

- **Tools (kiri):** Pindah, Kotak Pilih (seleksi), Pangkas, Kuas (ukuran/kekerasan/opasitas), Penghapus, Ember Cat (toleransi), Penetes Warna, Teks (font/tebal/miring), Bentuk (persegi/lingkaran — isi/tepi), Zoom, Tangan
- **Lapisan:** tambah, duplikat, hapus, naik/turun, gabung ke bawah, ratakan, visibilitas, kunci, opasitas, 16 mode blend (multiply, screen, overlay, dll.), rename (klik ganda)
- **Penyesuaian (preview langsung):** Kecerahan/Kontras, Rona/Saturasi/Cahaya
- **Filter:** Blur, Blur Cepat, Perjelas, Invert, Grayscale, Sepia, Noise
- **Lainnya:** Riwayat (undo/redo, klik langkah), grid, simpan PNG/JPEG, buka seret-dan-lepas, zoom roda mouse + **pinch zoom di HP**
- **UI responsif:** desktop = toolbar kiri + panel kanan; HP = toolbar bawah + panel laci (tombol ☰ Panel)

## Cara menjalankan

### 1. Langsung (termudah)
Klik dua kali `index.html` — buka di browser. (PWA/offline butuh HTTP, lihat bawah.)

### 2. PWA (bisa di-install, offline)
```bash
cd photoshop-lite
npx serve .          # atau: python -m http.server 8080
```
Buka `http://localhost:3000` (cek terminal untuk port), lalu:
- **Chrome/Edge desktop:** ikon Install di address bar
- **HP:** menu browser → **Tambahkan ke layar utama / Install app**

### 3. Desktop (Electron)
```bash
cd photoshop-lite\desktop
npm install          # sekali saja, unduh Electron
npm start
```

### 4. Android (APK via Capacitor)
Prasyarat: [Android Studio](https://developer.android.com/studio) + JDK (terpasang bersamaan).
```bash
cd photoshop-lite
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap sync android
npx cap add android          # membuat folder android/ (sekali saja)
npx cap sync android
cd android
.\gradlew assembleDebug      # hasil APK: android\app\build\outputs\apk\debug\app-debug.apk
```
Install APK ke HP (`adb install …`) atau langsung Run dari Android Studio.
`capacitor.config.json` sudah disiapkan (appId `com.pslite.editor`).

## Pintasan keyboard

| Tombol | Aksi |
|---|---|
| V M C B E G I T U Z H | pilih tool |
| Ctrl+Z / Ctrl+Y | Urungkan / Ulangi |
| Ctrl+S | Simpan PNG |
| Ctrl+N / Ctrl+O | Baru / Buka |
| Ctrl+A / Ctrl+D | Pilih semua / batalkan |
| Del / Alt+Del / Ctrl+Del | Hapus isi / isi warna depan / belakang |
| [ dan ] | kecilkan / besarkan kuas |
| X / D | tukar / reset warna |
| Spasi (tahan) | geser kanvas |
| Ctrl+0 / Ctrl+1 | pas di layar / 100% |
| Enter / Esc | terapkan / batalkan pangkasan |

## Struktur file

```
photoshop-lite/
├── index.html            # UI utama
├── style.css             # tema gelap + responsif (desktop & mobile)
├── app.js                # engine editor (tools, lapisan, filter, riwayat, touch)
├── manifest.webmanifest  # manifest PWA
├── sw.js                 # service worker (offline)
├── gen-icons.js          # generator icon PNG opsional: node gen-icons.js
├── icons/icon.svg        # icon aplikasi
├── capacitor.config.json # config build Android
└── desktop/              # app Electron
    ├── main.cjs
    └── package.json
```

## Catatan
- Icon default SVG (cukup untuk Chrome/Edge). Ingin PNG? jalankan `node gen-icons.js`, lalu tambahkan entri PNG di `manifest.webmanifest`.
- Riwayat menyimpan 30 langkah terakhir per dokumen.
- Kanvas besar + banyak lapisan bisa memakan RAM — dokumen ≤ ~4000px nyaman di HP.
