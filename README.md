# StockFinder

StockFinder adalah web app sederhana untuk creator: satu pencarian menggabungkan hasil **Pexels** dan **Pixabay** untuk foto dan video.

## Fitur

- Search Pexels + Pixabay dari satu kolom.
- All / Photos / Videos.
- Filter orientation: landscape / portrait / square.
- Popular / latest.
- Preview foto dan video.
- Download file melalui backend.
- Favorite tersimpan di browser (localStorage).
- Attribution/source links pada hasil.
- API key disimpan di `.env`, tidak di frontend.
- Cache server 24 jam untuk mengurangi request berulang.

## Menjalankan

1. Install Node.js 20+.
2. Salin `.env.example` menjadi `.env`.
3. Isi:

```env
PEXELS_API_KEY=...
PIXABAY_API_KEY=...
PORT=3000
```

4. Install dependency:

```bash
npm install
```

5. Jalankan:

```bash
npm start
```

6. Buka `http://localhost:3000`.

Mode developer:

```bash
npm run dev
```

## Catatan API

Pexels dan Pixabay punya kebijakan penggunaan API dan rate limit masing-masing. UI StockFinder menampilkan link sumber, dan backend hanya mem-proxy URL file dari host yang diizinkan.

Jangan commit file `.env` ke GitHub.

Sebelum deploy publik, review kembali terms/API guidelines Pexels dan Pixabay karena kebijakan dapat berubah.
