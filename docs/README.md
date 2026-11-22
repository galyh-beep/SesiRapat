# SesiRapat — Versi Statis / PWA (folder `pwa/`)

Versi statis SesiRapat yang bisa diinstal di HP — **tanpa server, tanpa akun Google**.
Data hanya tersimpan di `localStorage` perangkat yang membukanya.

## Isi folder ini

| Berkas | Keterangan |
| --- | --- |
| `index.html` | Seluruh aplikasi (wizard rapat, Buku Peserta, Ruang Rapat Live + presensi QR, Notulen Studio, tindak lanjut, Template Studio, Arsip, Pengaturan) |
| `manifest.json` | Manifest PWA (nama, ikon, warna tema) |
| `sw.js` | Service worker — cache offline |
| `icon-192.png` / `icon-512.png` | Ikon aplikasi |

## Cara install dari GitHub Pages

1. Di repo ini: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, branch `main`, folder **`/pwa`**, Save.
2. Tunggu ±1 menit, lalu buka `https://galyh-beep.github.io/sesirapat/pwa/` di **Chrome HP**.
3. Ketuk banner/tombol **Install**, atau menu ⋮ → **Install aplikasi** / **Tambahkan ke Layar Utama**.
4. Buka dari ikon SesiRapat di layar utama — aplikasi jalan offline setelah pertama kali dimuat.

## Batasan (jujur)

- **Satu perangkat saja.** Tidak ada presensi lintas perangkat lewat tautan publik dan tidak ada sinkronisasi antar perangkat — itu hanya ada di versi Google (paket `Code.gs` + `Index.html` di root repo ini, Fase 5.4).
- Pindah perangkat: pakai **ekspor/impor JSON** di Pengaturan.
- Susun AI / transkrip Gemini butuh kunci Gemini sendiri di Pengaturan; tanpa kunci, pakai susun manual.
- Dikte mikrofon jalan di Chrome HP (bukan di dalam iframe Web App Google).

## Versi

Versi statis ini mengikuti SesiRapat Fase 5.4 (2026-11-22).
