# PS Lite — Editor Foto Gaya Photoshop

Aplikasi editor foto **satu codebase untuk 3 platform**:

| Platform | Cara |
|---|---|
| **Browser / Mobile (PWA)** | Buka `index.html` atau serve via HTTP lalu "Install App" |
| **Desktop native** | Wrapper Electron di folder `desktop/` |
| **Android (APK)** | Konversi via Capacitor (lihat di bawah) |

## Fitur lengkap

- **Tools (kiri):** Pindah, Kotak Pilih (seleksi), **Lasso**, Pangkas, Kuas, Penghapus, Ember Cat (toleransi), **Gradasi**, Penetes Warna, Teks (font/tebal/miring), Bentuk (persegi/lingkaran/garis — isi/tepi), Zoom, Tangan
- **Kuas Komik / Webtoon (panel Kanan):** 20 preset — G-Pen, Mapping Pen, R-Pen Maru, Brush Pen, Tinta Air, Pensil, Cat Air, Airbrush, Arang, **Screentone** (titik besar/sedang/halus, garis, silang — pola sejajar dokumen), **Speed Lines**, Kilau/Star, Cipratan, Asap/Kabut, Gores Abstrak, Cahaya Lembut. Tekanan stylus (Pointer Events) didukung untuk pena ± tipis.
- **Lapisan:** tambah, duplikat, hapus, naik/turun, gabung ke bawah, ratakan, visibilitas, kunci, opasitas, 16 mode blend, rename, **folder (grup/ungroup)**: buat folder, masukkan lapisan, lepas dari folder, buka/tutup, sembunyikan seluruh folder (ikut ekspor PSD)
- **Penyesuaian (preview langsung):** Kecerahan/Kontras, Rona/Saturasi/Cahaya, **Levels**
- **Filter:** Blur, Blur Cepat, Perjelas, Invert, Grayscale, Sepia, Noise, **Mosaic, Emboss, Find Edges**
- **Transformasi:** **Free Transform (Ctrl+T)** — skala/putar/pindah; **Putar 90°/cermin kanvas**
- **Ekspor:** PNG, JPEG, **PSD (RGB 8-bit, lapisan + folder, RLE)** — bisa dibuka di Photoshop/Photopea/CSP; simpan/buka **proyek JSON** (semua lapisan utuh)
- **Lainnya:** Riwayat (undo/redo, klik langkah), grid, buka seret-dan-lepas, zoom roda mouse + **pinch zoom di HP**
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
| Ctrl+T | Free Transform (Enter = selesai, Esc = batal) |
| Ctrl+L / Ctrl+U | Levels / Hue-Saturation |
| Enter / Esc | terapkan / batalkan pangkasan |

## Struktur file

```
photoshop-lite/
├── index.html            # UI utama
├── style.css             # tema gelap + responsif (desktop & mobile)
├── app.js                # engine editor (tools, lapisan, folder, filter, riwayat, touch)
├── brushes.js            # engine brush komik/webtoon + 20 preset
├── psd.js                # penulis file PSD (lapisan + folder, PackBits RLE)
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
- Brush Photoshop (`.abr`) tidak bisa diimpor; brush di sini adalah engine sendiri yang dioptimalkan untuk komik/webtoon.
- PSD diekspor RGB 8-bit (bukan 16-bit), full-canvas per lapisan, blend mode & folder ikut. Import PSD belum didukung — pakai proyek JSON untuk menyimpan pekerjaan.
- Kanvas vertikal panjang (webtoon) didukung (maks 8000px per sisi saat buat dokumen).
