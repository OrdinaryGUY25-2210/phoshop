# PS Lite — Editor Foto Gaya Photoshop

Aplikasi editor foto **satu codebase untuk 3 platform**:

| Platform | Cara |
|---|---|
| **Browser / Mobile (PWA)** | Buka `index.html` atau serve via HTTP lalu "Install App" |
| **Desktop native** | Wrapper Electron di folder `desktop/` |
| **Android (APK)** | Konversi via Capacitor (lihat di bawah) |

## Fitur lengkap

- **Tools (kiri):** Pindah, Kotak Pilih (seleksi), **Lasso**, **Tongkat Sihir (W)** — toleransi, berdekatan/global, sampel semua lapisan, Pangkas, Kuas, Penghapus, Ember Cat (toleransi), **Gradasi**, Penetes Warna, Teks (font/tebal/miring), Bentuk (persegi/lingkaran/garis — isi/tepi), Zoom, Tangan
- **Seleksi lanjutan:** Balikkan Seleksi (Ctrl+Shift+I), **Feather/haluskan tepi**, **Perluas/Kontraksi** seleksi; seleksi berbasis mask (hasil tongkat sihir) dipakai untuk isi/hapus/pindah
- **Clipboard:** **Potong / Salin / Tempel** (Ctrl+X / Ctrl+C / Ctrl+V) — tempel jadi objek mengambang yang bisa digeser lalu Enter untuk menetapkan
- **Gaya Lapisan (Fx):** **tepi/outline**, **bayangan jatuh (drop shadow)**, **cahaya luar (glow)** — non-destruktif, ikut ekspor PNG/JPEG/WebP
- **Mask lapisan:** "Mask dari Seleksi" (non-destruktif), aktif/nonaktif, hapus — tombol **M** di panel Lapisan (klik kanan tombol M = hapus mask)
- **Buka PSD (Ctrl+Alt+O / menu Berkas):** impor `.psd` 8 & 16-bit (RGB/Grayscale) — lapisan, nama, opasitas, blend mode, visibilitas, dan **folder** ikut terbaca (RLE/non-kompres)
- **Kuas Komik / Webtoon (panel Kanan):** **44 preset** — Pena Komik (G-Pen, Mapping, R-Pen Maru, Brush Pen, Tinta Air, Pena Bulu, Pena Kering, Tinta Cepat, Tinta Tebal, Fineliner), Tekstur (Pensil, Cat Air, Airbrush, Arang, Pastel, Krayon, Spons, Kuas Kering, Kapur), **Screentone** (titik besar/sedang/halus/45°/rapat/jumbo, garis, garis tegak, silang, kisi, bintik — pola sejajar dokumen), **Efek Webtoon** (Speed Lines, Garis Vertikal, Kilau/Star, Kilau Bintang, Cipratan, Cipratan Besar, Ledakan, Kilat, Bintik Cahaya, Asap/Kabut, Asap Tebal, Gores Abstrak, Goresan Emosi, Cahaya Lembut) + **pencarian & filter kategori**. Tekanan stylus (Pointer Events) didukung untuk pena ± tipis.
- **Panel fleksibel:** seret pembatas antara kanvas & panel untuk mengubah **lebar**, dan seret pembatas **horizontal antar panel** untuk mengubah **tinggi** tiap panel (atas–bawah) — semuanya tersimpan otomatis. Klik judul panel untuk buka/tutup; **klik dua kali judul = mode solo** (panel itu mendominasi, panel lain dilipat); reset lebar/tinggi via klik dua kali pembatas atau **Tampilan → Panel**.
- **Lapisan:** tambah, duplikat, hapus, naik/turun, gabung ke bawah, ratakan, visibilitas, kunci, opasitas, 16 mode blend, rename, **folder (grup/ungroup)**: buat folder, masukkan lapisan, **lepas satu per satu (⊟)**, buka/tutup, sembunyikan seluruh folder (ikut ekspor PSD). **Setiap teks otomatis jadi lapisan sendiri** ("Teks: …") sehingga bisa dipindah/di-ungroup per item.
- **Penyesuaian (preview langsung):** Kecerahan/Kontras, Rona/Saturasi/Cahaya, **Levels**, **Exposure, Vibrance/Saturasi, Color Balance, Threshold, Posterize**, plus sekali-klik **Auto Tone** & **Auto Kontras**
- **Filter:** Blur, Blur Cepat, Perjelas, Invert, Grayscale, Sepia, Noise, **Mosaic, Emboss, Find Edges, Motion Blur, Reduce Noise, Clouds (awan)**
- **Transformasi:** **Free Transform (Ctrl+T)** — skala/putar/pindah; **Putar 90°/cermin kanvas**
- **Dokumen & rasio:** dialog Baru punya **preset ukuran** (HD, Full HD, feed 1:1, story 9:16, webtoon 800×1280 / 1600×2560, A4 300dpi) dan **chip rasio** (1:1, 4:3, 3:2, 16:9, 9:16, 3:4, 2:3, A4, A4-L, Webtoon) dengan kunci otomatis + tukar orientasi; **Pangkas (C)** punya pilihan rasio; **Ukuran Gambar** punya kunci rasio.
- **Ekspor lengkap (Ctrl+Shift+S):** **PNG / JPEG / WebP / PSD 8-bit / PSD 16-bit**, skala 25–300%, kualitas JPEG/WebP, latar transparan/putih/hitam (JPEG otomatis putih), nama file ber-timestamp. PSD selalu menyertakan seluruh lapisan + folder + blend mode + opasitas + visibilitas.
- **Ekspor cepat:** PNG, JPEG, PSD 8/16-bit via menu Berkas; simpan/buka **proyek JSON** (semua lapisan utuh)
- **Snap (menempel):** saat menggeser lapisan/seleksi & menggambar bentuk, tepi/titik tengah menempel ke tepi kanvas, titik tengah, dan garis grid (Tampilan → Snap, toleransi 6 px layar)
- **Mode fokus (Tab):** sembunyikan menu, toolbar, options bar, dan panel agar kanvas penuh
- **Font kustom:** tombol **＋ Font…** di options bar Teks / menu **Font** — muat `.ttf/.otf/.woff` dari file; panduan permanen di `fonts/README.md` dan menu **Font → Panduan Font**
- **Menu klik kanan:** klik kanan di kanvas (potong/salin/tempel, seleksi, transformasi, Fx, mask, ukuran kanvas, snap/grid, ekspor, autosave) dan klik kanan di baris lapisan (ganti nama, duplikat, hapus, gabung, Fx, mask, **edit teks**, visibilitas, kunci, folder)
- **Teks bisa diedit ulang:** klik kanan lapisan teks → **Edit Teks…** (isi, ukuran, warna) — badge **T** di panel lapisan
- **Ukuran Kanvas…:** perbesar/perkecil area kanvas dengan **jangkar 9 posisi** tanpa mengubah isi
- **Autosave & pemulihan:** cadangan otomatis tiap 60 detik (localStorage, ≤4,5 MB) + tawaran **Pulihkan** saat aplikasi dibuka; manual via menu Bantuan / klik kanan
- **Riwayat** kini 50 langkah; **format proyek JSON v2** ikut menyimpan gaya (Fx), teks, dan mask
- **Lainnya:** grid, buka seret-dan-lepas (gambar/PSD/proyek; tahan **Alt** untuk impor sebagai lapisan), zoom roda mouse + **pinch zoom di HP**
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
| V M L W C B E G N I T U Z H | pilih tool |
| Ctrl+Z / Ctrl+Y | Urungkan / Ulangi |
| Ctrl+S / Ctrl+Shift+S | Simpan PNG / Ekspor lengkap |
| Ctrl+N / Ctrl+O / Ctrl+Alt+O | Baru / Buka / Buka PSD |
| Ctrl+A / Ctrl+D | Pilih semua / batalkan |
| Ctrl+X / Ctrl+C / Ctrl+V | Potong / Salin / Tempel |
| Ctrl+Shift+I | Balikkan seleksi |
| Del / Alt+Del / Ctrl+Del | Hapus isi / isi warna depan / belakang |
| [ dan ] | kecilkan / besarkan kuas |
| X / D | tukar / reset warna |
| Spasi (tahan) | geser kanvas |
| Ctrl+0 / Ctrl+1 | pas di layar / 100% |
| Ctrl+T | Free Transform (Enter = selesai, Esc = batal) |
| Ctrl+L / Ctrl+U | Levels / Hue-Saturation |
| Enter / Esc | terapkan / batalkan pangkasan |
| Tab | mode fokus (sembunyikan/tampilkan panel) |

## Struktur file

```
photoshop-lite/
├── index.html            # UI utama
├── style.css             # tema gelap + responsif (desktop & mobile)
├── app.js                # engine editor (tools, lapisan, folder, filter, riwayat, touch)
├── brushes.js            # engine brush komik/webtoon + 44 preset
├── psd.js                # penulis file PSD 8/16-bit (lapisan + folder, PackBits RLE)
├── manifest.webmanifest  # manifest PWA
├── sw.js                 # service worker (offline)
├── gen-icons.js          # generator icon PNG opsional: node gen-icons.js
├── icons/icon.svg        # icon aplikasi
├── fonts/                # taruh font permanen + README cara menambah
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
- PSD diekspor **RGB 8-bit atau 16-bit** (pilih di menu Berkas), full-canvas per lapisan, blend mode & folder ikut. PSD 16-bit memakai nilai 8-bit yang diperhalus ke 0–65535 (bukan data 16-bit asli dari kanvas). Import PSD belum didukung — pakai proyek JSON untuk menyimpan pekerjaan.
- **Menambah font:** cara cepat lewat **＋ Font…** (hanya sesi berjalan) atau permanen: salin file ke `fonts/`, tambah `@font-face` di `style.css`, lalu tambahkan namanya ke `BASE_FONTS` di `app.js` — lihat `fonts/README.md`.
- Kanvas vertikal panjang (webtoon) didukung (maks 8000px per sisi saat buat dokumen).
