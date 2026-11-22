# SesiRapat

**SesiRapat** — aplikasi rapat, presensi, dan notulensi untuk satu lembaga.
Rapat rapi, presensi tercatat, notulen jadi.

Versi paket saat ini: **Fase 5.4**

## Fitur

- **Rapat** — wizard buat rapat 3 langkah, Ruang Rapat Live (Mulai / Jeda / Akhiri), durasi dihitung dari waktu aktif saja.
- **Presensi** — QR berputar 60 detik + tautan presensi **stabil** (hanya ID rapat, tanpa kode — tidak kedaluwarsa saat dibagikan ke grup WA/Telegram), kode manual 6 digit, mode kios, mode Tamu, cap Terlambat otomatis, anti-ganda, status Izin/Alpa.
- **Notulen Studio** — dikte suara Bahasa Indonesia, unggah rekaman audio (.m4a/.mp3/.wav/.ogg/.webm, maks 200 MB) lalu ditranskrip Gemini per segmen ±3–4 menit, **proses latar belakang** (tab boleh ditutup, layar boleh dimatikan), lalu Susun AI menjadi Pembahasan / Keputusan / Tindak Lanjut, dan persetujuan pimpinan.
- **Tindak Lanjut** — pelacak tugas lintas rapat dengan penanda tenggat.
- **Template Studio** — impor template `.docx` berkop surat lembaga sendiri (placeholder `{{NAMA_RAPAT}}`, `{{BARIS_PESERTA}}`, `{{TTD}}`, dan lain-lain), terbit Notulensi + Lembar Presensi bernomor register sebagai Docs/PDF.
- **Fase 5 — Pelacak & Pengingat** — pengingat rapat H-3 / H-1 / hari-H (pagi 07:00, 5 jam dan 2 jam sebelum rapat), penanda tenggat tindak lanjut, rekap otomatis setelah rapat, geofence opsional per rapat, dan pengingat Telegram opsional.
- **Peran** — Admin, Notulis, Pimpinan. Halaman di luar akses suatu peran tidak dimunculkan sama sekali (Template Studio dan Pengaturan khusus Admin).

## ⚠️ Penting: ini BUKAN versi statis GitHub Pages

Repo ini berisi **paket Google Apps Script** (Code.gs + Index.html), bukan
aplikasi web statis. File-file di repo ini **tidak bisa langsung dibuka
sebagai situs** di GitHub Pages — Web App SesiRapat hanya jalan setelah
di-deploy di akun Google masing-masing (lihat cara deploy di bawah).

Setiap lembaga/pengguna memakai **akun Google dan databasenya sendiri**:
spreadsheet `SesiRapat_DB` dan folder Drive `SesiRapat_Arsip` dibuat
otomatis di Drive pemiliknya. Data satu pengguna tidak tercampur dengan
pengguna lain.

## Isi repo

| Berkas | Keterangan |
| --- | --- |
| `Code.gs` | Seluruh logika server (Apps Script): database, presensi, notulen, pengingat, penerbitan dokumen |
| `Index.html` | Seluruh tampilan Web App (beri nama `Index` di Apps Script) |
| `PANDUAN-DEPLOY.md` | Panduan deploy lengkap langkah demi langkah (sama dengan panduan di Pengaturan SesiRapat) |
| `README.md` | Berkas ini |

## Cara deploy (ringkas)

Panduan lengkap ada di `PANDUAN-DEPLOY.md`. Ringkasnya:

1. Buka [script.google.com](https://script.google.com) → **Proyek baru**, beri nama `SesiRapat`.
   Dianjurkan: atur zona waktu proyek ke `(GMT+07:00) Jakarta`.
2. **Code.gs** — hapus isi bawaan, tempel seluruh isi `Code.gs` dari repo ini, simpan.
3. **Index.html** — tambah berkas HTML baru, beri nama persis `Index`
   (tanpa `.html`), tempel seluruh isi `Index.html` dari repo ini, simpan.
4. **Buat database (sekali saja)** — di editor Apps Script, pilih fungsi
   `buatDatabase`, klik **Run**, setujui izin. Spreadsheet `SesiRapat_DB`
   (15 sheet + header) dan folder Drive `SesiRapat_Arsip` dibuat otomatis,
   dan email kamu menjadi **Admin pertama**. Fungsi ini aman dijalankan
   ulang — data yang sudah ada tidak dihapus.
5. **Deploy sebagai Web App** — Deploy → New deployment → Web app,
   *Execute as: Me*, *Who has access: Anyone* (perlu supaya peserta bisa
   membuka halaman presensi publik tanpa akun Google; halaman pengelola
   tetap terkunci untuk email yang terdaftar di sheet Pengguna). Salin URL
   yang berakhiran `/exec`.

## Fungsi sekali-jalan (jalankan sekali setelah deploy/update besar)

| Fungsi | Kapan dijalankan | Kegunaan |
| --- | --- | --- |
| `buatDatabase()` | Sekali saat instalasi awal, dan sekali lagi bila update menambah sheet/kolom baru | Membuat/memeriksa struktur `SesiRapat_DB` (15 sheet) + folder `SesiRapat_Arsip` |
| `pasangPemicuTranskrip()` | Sekali (Fase 4.11+) | Memasang pemicu waktu (tiap 1 menit) agar transkrip rekaman berjalan di latar belakang |
| `pasangPemicuPengingat()` | Sekali (Fase 5.0+) | Memasang pemicu waktu (tiap jam) agar pengingat H-3/H-1/hari-H terkirim otomatis |

Ketiga fungsi di atas dijalankan dari editor Apps Script (pilih nama
fungsinya di bilah atas, klik **Run**). Tidak perlu dijalankan ulang
setiap deploy — hanya sekali, kecuali ada pemberitahuan pada catatan
rilis bahwa struktur database berubah.

## Pengaturan setelah deploy

- **Pengguna & Peran** — tambah pengguna lewat sheet `Pengguna`
  (nama + email Google + peran Admin/Notulis/Pimpinan). Login memakai
  akun Google, tanpa password.
- **Kunci Gemini** — isi di Pengaturan Web App (dipakai untuk transkrip
  rekaman dan Susun AI). Tanpa kunci, transkrip audio tidak jalan.
- **Telegram (opsional)** — isi token bot + chat ID di Pengaturan bila
  ingin pengingat terkirim ke Telegram. Mati bawaan.
- **Jam pengingat** — bawaan 07:00, bisa diubah di Pengaturan; pengingat
  hari-H juga terkirim 5 jam dan 2 jam sebelum rapat dimulai.
- **Geofence (opsional)** — mati bawaan; bila diaktifkan per rapat,
  presensi mandiri hanya diterima dari dalam radius titik rapat.

## Catatan & batasan

- Tanda tangan peserta berupa gambar, bukan tanda tangan elektronik
  tersertifikasi (TTE).
- QR berputar adalah bukti kehadiran di sesi, bukan bukti lokasi
  (kecuali geofence diaktifkan).
- Dikte mikrofon di dalam Web App Google terblokir karena Web App
  berjalan di iframe `script.google.com` tanpa izin mikrofon — gunakan
  jalur **Unggah Rekaman Audio** untuk transkrip (rekam pakai perekam
  bawaan HP, unggah, lalu ditranskrip Gemini).
- Notifikasi sistem hanya muncul di perangkat penyelenggara setelah
  izin diberikan; peserta dijangkau lewat teks undangan WA/Telegram.
- Placeholder template dokumen (`{{BARIS_PESERTA}}`, `{{TTD}}`, dan
  lain-lain) tidak berubah sejak Fase 5.4 — template `.docx` lama tetap
  bisa dipakai.

## Lisensi

MIT — lihat `LICENSE`.
