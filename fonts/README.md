# Folder Font

Taruh file font permanen di folder ini (`.ttf`, `.otf`, `.woff`, `.woff2`).

## Cara menambah font permanen

1. Salin file font ke folder `fonts/` ini, misalnya `fonts/Komika.ttf`.
2. Buka `style.css` dan tambahkan aturan `@font-face` (satu blok per font):

```css
@font-face {
  font-family: "Komika";
  src: url("fonts/Komika.ttf");
}
```

3. Buka `app.js`, cari baris `const BASE_FONTS = [...]` di bagian atas, lalu tambahkan
   nama font-nya, misalnya:

```js
const BASE_FONTS = ["Arial", "Georgia", "...", "Komika"];
```

4. Muat ulang aplikasi. Font akan muncul di dropdown **Teks (T)** dan ikut terpaket
   ke build Electron (`npx electron-packager`) maupun Android (`npx cap sync`).

## Cara cepat (tanpa mengubah file)

Di aplikasi: tool **Teks (T)** → tombol **＋ Font…** di options bar, atau menu
**Font → Tambah Font dari File…**. Font langsung aktif, tetapi hanya untuk sesi
tersebut (perlu ditambahkan ulang setelah aplikasi ditutup).

## Catatan lisensi

Gunakan hanya font yang lisensinya mengizinkan penggunaan dan distribusi.
