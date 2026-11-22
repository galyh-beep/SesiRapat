PANDUAN DEPLOY SESIRAPAT VERSI GOOGLE — Fase 5.4
================================================
Paket ini memindahkan SesiRapat ke ekosistem Google milikmu sendiri:
  - Database  : spreadsheet "SesiRapat_DB" (15 sheet, dibuat otomatis
    oleh kode — tidak perlu mengetik nama sheet/kolom manual)
  - Arsip     : folder Drive "SesiRapat_Arsip" (dokumen PDF/Docs hasil
    terbit, tanda tangan peserta, berkas impor)
  - Aplikasi  : Apps Script Web App (Code.gs + Index.html)
  - Login     : akun Google, email dipetakan ke 3 peran di sheet
    Pengguna — Admin, Notulis, Pimpinan
  - Presensi  : peserta presensi mandiri dari HP masing-masing lewat
    tautan publik STABIL per rapat (hanya ID rapat, tanpa kode 60
    detik — tidak kedaluwarsa dibagikan; kode diambil otomatis oleh
    server), anti-ganda, cap terlambat otomatis, jendela presensi
    jadwal −30 menit sampai rapat diakhiri + tenggang — sama seperti
    versi Muse.

Yang kamu butuhkan: akun Google (pribadi/lembaga) dan tiga berkas dari
Pengaturan SesiRapat versi Muse:
  1. Code.gs            (tombol Unduh Code.gs)
  2. Index.html         (tombol Unduh Index.html)
  3. Ekspor data JSON   (tombol Unduh Ekspor Data — hanya bila ingin
                         memindahkan data yang sudah ada)

LANGKAH 1 — BUAT PROYEK APPS SCRIPT
  1. Buka script.google.com, klik "Proyek baru" (New project).
  2. Beri nama proyek, misalnya "SesiRapat".
  3. (Dianjurkan) Buka Pengaturan proyek (ikon roda gigi) dan setel
     zona waktu ke "(GMT+07:00) Jakarta" agar jam presensi dan cap
     terlambat tepat.

LANGKAH 2 — TEMPEL CODE.GS
  1. Di editor, buka berkas Code.gs, hapus isinya, lalu tempel seluruh
     isi berkas Code.gs yang kamu unduh.
  2. Simpan (Ctrl+S).

LANGKAH 3 — BUAT BERKAS INDEX.HTML
  1. Klik tanda + di samping "Files" > pilih "HTML".
  2. Beri nama persis: Index  (tanpa ".html" — Apps Script menambahkan
     sendiri). Nama ini penting: kode memanggil berkas bernama "Index".
  3. Hapus isi bawaannya, tempel seluruh isi Index.html unduhan, simpan.

LANGKAH 4 — BUAT DATABASE (SEKALI SAJA)
  1. Di editor, pilih fungsi "buatDatabase" pada daftar fungsi di bilah
     atas, lalu klik "Run" (Jalankan).
  2. Setujui permintaan izin (akses Sheets + Drive) — ini akunmu
     sendiri dan kode berjalan di akunmu.
  3. Selesai: spreadsheet "SesiRapat_DB" terbuat dengan 15 sheet
     (Rapat, Kelompok, Peserta, Kehadiran, Notulensi, Tindak_Lanjut,
     Template, Dokumen, Pengguna, Log_Status, Pengaturan,
     Pembagian_Undangan, Antrean_Transkrip, Segmen_Transkrip,
     Log_Pengingat)
     lengkap dengan header-nya, folder Drive
     "SesiRapat_Arsip" terbuat, dan email kamu menjadi Admin pertama.
  Fungsi ini aman dijalankan ulang kapan pun untuk memeriksa struktur;
  data yang sudah ada tidak dihapus.

LANGKAH 5 — DEPLOY SEBAGAI WEB APP
  1. Klik "Deploy" > "New deployment" > pilih jenis "Web app".
  2. Isi: Description bebas (mis. "SesiRapat versi Google"),
     Execute as: "Me" (akun kamu),
     Who has access: "Anyone".
     Pilihan Anyone diperlukan supaya peserta bisa membuka halaman
     presensi publik tanpa akun Google. Halaman pengelola tetap
     terkunci: hanya email yang terdaftar di sheet Pengguna yang bisa
     masuk; pengunjung lain hanya melihat pesan "akses belum
     terdaftar" beserta emailnya.
  3. Klik Deploy, setujui izin bila diminta, lalu salin URL Web App
     yang berakhiran "/exec".

LANGKAH 6 — HUBUNGKAN & TES DARI SESIRAPAT VERSI CLAUDE
  1. Di SesiRapat versi Muse, buka Pengaturan > bagian "Migrasi ke
     Google".
  2. Tempel URL /exec ke kolom "URL Web App Google", klik Simpan URL.
  3. Klik "Tes koneksi" — aplikasi memanggil endpoint ping Web App-mu
     dan menampilkan hasilnya. Bila gagal, periksa: deployment sudah
     versi terbaru, akses "Anyone", dan URL yang ditempel adalah URL
     /exec (bukan /dev).

LANGKAH 7 — PINDAHKAN DATA LAMA (OPSIONAL)
  1. Di versi Muse: Pengaturan > Data & migrasi > Unduh Ekspor Data
     (JSON).
  2. Pilih salah satu jalur impor:
     a) Halaman Pengaturan Web App Google (khusus Admin): tempel isi
        JSON di bagian "Impor data", klik Impor Sekarang; atau
     b) Unggah berkas JSON ke folder Drive "SesiRapat_Arsip" dengan
        nama persis "sesirapat-ekspor.json", lalu dari spreadsheet
        SesiRapat_DB jalankan menu SesiRapat > "Impor data dari
        sesirapat-ekspor.json" (atau fungsi imporDataDariDrive() dari
        editor).
  3. Impor memetakan rapat, kelompok, peserta (kolom Kelompok terisi
     nama kelompoknya), kehadiran, notulen, tindak lanjut, metadata
     template, dokumen, riwayat pembagian undangan, dan pengaturan
     lembaga. Baris yang ID-nya sudah ada dilewati — impor aman
     diulang.
  Yang TIDAK ikut pindah: berkas .docx template dan gambar tanda
  tangan dari versi Muse (tersimpan sebagai blob di server Muse).
  Untuk template Google: buat/unggah Google Docs berisi kop dan
  placeholder yang sama ({{NAMA_RAPAT}}, {{PEMBAHASAN}},
  {{BARIS_PESERTA}}, dst.), lalu di sheet Template isi kolom docsId
  dengan ID dokumennya dan aktif = 1 untuk jenisnya.

LANGKAH 8 — TAMBAH PENGGUNA & PERAN
  1. Buka Web App, masuk ke menu Arsip > Pengaturan (khusus Admin),
     atau sunting langsung sheet Pengguna di SesiRapat_DB: satu baris
     per orang —
     email akun Google, nama, peran.
  2. Hak per peran:
     - Admin    : semua, termasuk pengguna, pengaturan, dan impor.
     - Notulis  : buat/ubah rapat, undang peserta, presensi kios,
                  susun & ajukan notulen, tindak lanjut, terbitkan
                  dokumen.
     - Pimpinan : melihat semua data, menyetujui/mengembalikan
                  notulen, menerbitkan dokumen.

CARA PAKAI SEHARI-HARI DI VERSI GOOGLE
  - Tampilannya sama seperti versi Muse: menu bawah 5 slot —
    Linimasa, Rapat, tombol tengah (FAB) yang berubah mengikuti
    halaman yang dibuka, Tindak Lanjut, dan Arsip.
      * Linimasa: sapaan, pencarian rapat, kartu rapat yang sedang
        berlangsung, tombol Buat Rapat Baru, daftar "Undangan belum
        dibagikan", rapat hari ini, akan datang, dan ringkasan tindak
        lanjut yang belum selesai.
      * FAB di Linimasa/Rapat: "+ Buat Rapat" — berubah menjadi
        "Presensi" (ikon QR, hijau teal) selama ada rapat berlangsung.
        Di Ruang Rapat FAB selalu "Presensi" menuju panel QR rapat itu;
        di Tindak Lanjut menjadi "+ Tambah Tugas"; di Arsip/Template/
        Pengaturan menjadi "Ekspor" (unduh ekspor data JSON, khusus
        Admin).
      * Tindak Lanjut kini halaman global: semua tugas lintas rapat
        dengan saringan Semua/Belum/Proses/Selesai dan formulir tambah
        tugas (pilih rapatnya).
      * Arsip berisi semua dokumen terbit lintas rapat (PDF/Docs +
        nomor register) dan pintu masuk ke Template, Pengaturan, Buku
        Peserta, dan Semua Rapat. Halaman Template menampilkan template
        Google Docs yang terdaftar di sheet Template beserta status
        Docs-nya.
  - Ruang Rapat > Presensi menampilkan QR + kode 6 karakter yang
    berputar tiap 60 detik. Sejak Fase 4.6 QR berisi tautan presensi
    STABIL rapat itu (URL Web App + ?presensi=<ID rapat>) — hanya ID
    rapat, TANPA kode, jadi tautan yang dibagikan ke grup WhatsApp/
    Telegram tidak pernah kedaluwarsa. Kode 6 karakter yang berputar
    hanya untuk presensi manual cadangan di ruangan.
  - Peserta memindai QR atau membuka tautan, mengisi namanya (saran
    otomatis dari daftar peserta), boleh menambah tanda tangan, lalu
    menekan "Catat Kehadiran Saya" — tanpa mengetik kode apa pun:
    halaman mengambil kode terbaru otomatis dari server tepat sebelum
    mencatat, dan bila kode kedaluwarsa di tengah pengisian, halaman
    mengambil kode baru dan mencoba sekali lagi sendiri.
  - Jendela presensi (sama di versi Muse dan Google): dibuka 30
    menit sebelum jam jadwal mulai (tombol Mulai Rapat bukan
    gerbangnya — peserta awal tetap bisa presensi), tepat waktu
    sampai jam mulai + toleransi terlambat (bawaan 15 menit, di
    Pengaturan), setelah itu tetap bisa presensi dengan status
    Terlambat beserta jam kedatangannya, sampai rapat diakhiri +
    masa tenggang toleransi yang sama. Presensi hanya ditolak bila
    rapat sedang Dijeda, belum masuk jendela, atau jendela sudah
    ditutup. Peserta yang belum hadir menjadi Alpa setelah jendela
    benar-benar ditutup (bukan tepat saat rapat diakhiri).
    Nama yang sudah hadir tidak bisa presensi dua kali.
  - Notulen disusun manual dari transkrip di versi Google (penyusunan
    AI dari transkrip tetap tersedia di versi Muse), diajukan
    Notulis, disetujui/dikembalikan Pimpinan.
  - Terbitkan Notulensi / Lembar Presensi dari tab Dokumen: nomor
    register SR/NOT atau SR/PRES + tahun-bulan + nomor urut dibuat
    otomatis, Google Docs + PDF tersimpan di folder SesiRapat_Arsip,
    dan barisnya tercatat di sheet Dokumen.
  - Surat undangan yang digenerate tetap berupa .doc sebagai versi
    bawaan sistem (dari aplikasi versi Muse); di versi Google,
    undangan dibagikan sebagai teks + tautan presensi dari panel
    Presensi (WhatsApp/Telegram/Salin).

MEMPERBARUI KODE DI KEMUDIAN HARI
  Bila ada Code.gs / Index.html versi baru: tempel ulang isinya di
  editor, lalu Deploy > Manage deployments > edit (ikon pensil) >
  Version: New version > Deploy. URL /exec tidak berubah. Menempel
  kode baru tanpa membuat versi deployment baru tidak mengubah Web
  App yang live.

  KHUSUS PEMBARUAN KE FASE 4.3 (paritas penuh + jeda rapat + presensi
  tamu): setelah menempel Code.gs terbaru, jalankan buatDatabase()
  SEKALI lagi dari editor. Fungsinya aman diulang: ia hanya menambah
  kolom header baru yang belum ada (pausedAt/pauseReason/pausedTotalMs
  di sheet Rapat, catatan di Log_Status, tamu di Kehadiran, suratUrl/
  suratFileName di Rapat, docxUrl di Dokumen) tanpa menghapus data.
  Setelah itu deploy sebagai versi baru seperti di atas.

  KHUSUS PEMBARUAN KE FASE 4.4 (perbaikan error sintaks): versi ini
  memperbaiki halaman Web App yang hanya menampilkan
  "SyntaxError: Unexpected identifier 'version'". Penyebabnya teks
  deklarasi XML di dalam Index.html terbaca sebagai kode oleh mesin
  template Apps Script. Cukup tempel ulang Code.gs + Index.html
  terbaru lalu deploy sebagai versi baru — buatDatabase() TIDAK
  perlu dijalankan ulang dan data tidak berubah.

  KHUSUS PEMBARUAN KE FASE 4.5 (kelompok peserta multi-kelompok):
  satu peserta kini boleh masuk BEBERAPA kelompok sekaligus (mis.
  dosen yang juga Dekan masuk kelompok Dosen dan Pimpinan). Di Buku
  Peserta, Kelompok pada form tambah/sunting peserta menjadi chips
  yang bisa dipilih banyak; kolom Kelompok di sheet Peserta kini
  menyimpan daftar nama dipisah "; " (mis. "Dosen; Pimpinan") —
  data lama berisi satu nama tetap terbaca sebagai satu kelompok.
  Impor Excel menerima beberapa kelompok dalam satu sel dipisah
  ";" atau ","; peserta yang sudah ada tidak digandakan, tetapi
  kelompok barisnya digabungkan ke data yang sudah ada. Mengundang
  dua kelompok yang tumpang tindih tidak menggandakan undangan
  orang yang sama. Cukup tempel ulang Code.gs + Index.html terbaru
  lalu deploy sebagai versi baru — buatDatabase() TIDAK perlu
  dijalankan ulang dan struktur sheet tidak berubah.

  KHUSUS PEMBARUAN KE FASE 4.6 (tautan presensi STABIL + jendela
  presensi): tautan undangan/presensi yang dibagikan ke WhatsApp/
  Telegram kini HANYA berisi ID rapat (?presensi=<ID rapat>) — tidak
  lagi membawa kode 60 detik yang membuat tautan cepat kedaluwarsa.
  QR di Ruang Rapat juga membuka tautan stabil yang sama; kode 6
  karakter yang berputar tetap ada untuk presensi manual cadangan
  di ruangan. Saat peserta membuka tautan, halaman mengambil kode
  presensi terbaru otomatis dari server tepat sebelum mencatat —
  peserta cukup isi nama + tanda tangan. Bila kode kedaluwarsa di
  tengah pengisian, halaman mengambil kode baru dan mencoba sekali
  lagi sendiri; error hanya muncul bila rapat dijeda, belum masuk
  jendela, atau sudah ditutup. Jendela presensi: dibuka 30 menit
  sebelum jam jadwal mulai (tombol Mulai bukan gerbangnya), tepat
  waktu sampai jam mulai + toleransi, setelah itu Terlambat sampai
  rapat diakhiri + masa tenggang toleransi; peserta yang belum
  hadir menjadi Alpa setelah jendela benar-benar ditutup, bukan
  tepat saat rapat diakhiri. Tautan LAMA yang sudah terlanjur
  dibagikan (yang masih membawa &kode=...) tetap membuka halaman
  presensi yang sama dan tetap bisa dipakai. Cukup tempel ulang
  Code.gs + Index.html terbaru lalu deploy sebagai versi baru —
  buatDatabase() TIDAK perlu dijalankan ulang dan struktur sheet
  tidak berubah.

  KHUSUS PEMBARUAN KE FASE 4.7 (perbaikan izin mikrofon Notulen
  Studio): dulu dikte hanya memakai SpeechRecognition tanpa pernah
  memanggil getUserMedia, sehingga prompt izin mikrofon Chrome TIDAK
  PERNAH muncul — semua pengaturan terlihat sudah diizinkan, status
  izin selamanya "Tanya", dan dikte tidak pernah bisa jalan. Kini
  tombol mikrofon dan tombol baru "Tes Mikrofon" memanggil
  getUserMedia({audio:true}) DULU dari ketukan tombol — itulah pemicu
  prompt izin Chrome yang sesungguhnya — baru dikte SpeechRecognition
  (id-ID) dimulai. Tes Mikrofon menampilkan status izin nyata (Belum
  diminta / Diizinkan / Ditolak / Tidak ada mic) yang tersimpan di
  perangkat, plus meteran level suara hidup selama mic aktif. Bila
  statusnya "Tanya"/Ditolak tapi prompt tidak muncul (Web App Google
  berjalan di dalam iframe sehingga Chrome kadang menahan prompt),
  Notulen Studio menampilkan panduan langkah di layar: buka di Chrome
  (bukan browser dalam aplikasi WhatsApp/Telegram), pastikan HTTPS,
  ketuk ikon gembok di address bar › Izin situs › Mikrofon › Izinkan,
  lalu muat ulang — tersedia tombol "Muat ulang halaman". Semua error
  dikte (not-allowed, no-speech, audio-capture, network, aborted)
  kini ditampilkan artinya + langkah perbaikannya dalam Bahasa
  Indonesia, tidak lagi gagal diam-diam. Tombol mikrofon Notulen
  Studio juga kini bundar besar 96px seperti versi Muse. Cukup
  tempel ulang Index.html terbaru (Code.gs hanya berubah nomor
  versi, boleh ikut ditempel ulang) lalu deploy sebagai versi baru —
  buatDatabase() TIDAK perlu dijalankan ulang.

  KHUSUS PEMBARUAN KE FASE 4.8 (tab Presensi disamakan dengan versi
  Muse): kartu "Presensi peserta" kini punya tombol "Tampilkan QR
  Presensi" / "Sembunyikan QR Presensi" di atas kartu, persis seperti
  versi Muse. QR + kode 6 karakter + hitung mundur berganti mulai
  dalam keadaan tersembunyi; ketuk tombolnya untuk menampilkan, ketuk
  lagi untuk menyembunyikan. Info jendela presensi, tautan presensi
  stabil, tombol Salin Tautan Presensi, dan ringkasan kehadiran
  selalu terlihat walau QR disembunyikan. Tombol Presensi (FAB) di
  menu bawah yang diketuk saat sudah berada di tab Presensi kini
  ikut menampilkan QR-nya. Ringkasan kehadiran di bawah kartu (Hadir
  · Izin · Alpa · Belum · Terlambat) kini tampil sebagai chip yang
  membungkus rapi mengikuti lebar layar, tidak lagi terpotong di
  layar HP sempit; tautan presensi stabil yang panjang juga kini
  dibungkus di dalam kartu. Cukup tempel ulang Index.html terbaru
  (Code.gs hanya berubah nomor versi, boleh ikut ditempel ulang)
  lalu deploy sebagai versi baru — buatDatabase() TIDAK perlu
  dijalankan ulang.

  KHUSUS PEMBARUAN KE FASE 4.9 (tombol QR dirapikan + hitung
  mundur kode mulus): bilah tombol "Tampilkan/Sembunyikan QR
  Presensi" kini berupa satu baris penuh yang rapi tepat di atas
  kartu QR — tombolnya membentang mengikuti lebar layar dengan
  teks status kecil yang konsisten di kanannya ("QR presensi
  tampil" saat QR terlihat, "QR presensi tersembunyi" saat
  disembunyikan) — tidak lagi menempel longgar di kiri atas.
  Hitung mundur "Kode berganti dalam N detik" juga diperbaiki:
  sebelumnya angka itu diambil mentah dari hasil polling server
  tiap 5 detik, sehingga tampilannya diam beberapa detik lalu
  melompat mengejar (macet-macet, lompat-lompat). Kini server
  mengirim tenggat nyata berakhirnya kode (expiresAt) dan layar
  menghitung sisa detik dari tenggat itu mengikuti jam sistem,
  diperbarui tepat tiap pergantian detik — angkanya turun satu
  per satu secara mulus, ada bilah kemajuan tipis yang ikut
  bergerak di bawah kode, token disegarkan tepat saat tenggatnya
  lewat (refresh tidak lagi me-reset atau melompati hitungan),
  dan saat kode berganti hitungan kembali ke 60 dengan mulus.
  Perbaikan yang sama juga diterapkan di versi Muse. Cukup
  tempel ulang Index.html + Code.gs terbaru (Code.gs kali ini
  ikut berubah: apiTokenPresensi mengirim expiresAt) lalu deploy
  sebagai versi baru — buatDatabase() TIDAK perlu dijalankan
  ulang.

  KHUSUS PEMBARUAN KE FASE 4.10 (Unggah Rekaman Audio —
  transkrip Gemini): Notulen Studio kini punya panel "Unggah
  Rekaman Audio" sebagai JALUR UTAMA transkrip di versi Google.
  Latar belakangnya: izin mikrofon browser tidak akan pernah bisa
  muncul di dalam Web App Google karena halaman berjalan di iframe
  script.google.com (batasan Chrome, bukan salah pengaturan HP),
  jadi dikte langsung memang tidak bisa diandalkan di sini. Alur
  barunya tetap sepenuhnya di dalam SesiRapat: rekam rapat dengan
  perekam bawaan HP (tanpa izin mic browser sama sekali), lalu
  unggah berkas audionya dari panel itu. Format yang didukung
  .m4a, .mp3, .wav, .ogg, .webm dengan ukuran maks 200 MB.
  Rekaman panjang — standar rapat 2–3 jam — otomatis dipecah
  peramban menjadi segmen ±3–4 menit (WAV dipecah per byte, MP3
  di batas frame, format lain dibaca & dipadatkan ke mono 16 kHz)
  dan ditranskrip Gemini segmen demi segmen dengan penanda
  "Segmen i dari N", jadi proses panjang terlihat kemajuannya
  dan tidak terasa macet. Transkrip terakumulasi tersimpan
  otomatis per segmen; bila jaringan putus di tengah, tombol
  "Lanjutkan dari Segmen Terakhir" meneruskan dari segmen yang
  gagal tanpa mengulang dari awal. Setelah selesai, transkrip
  ada di kolom Transkrip (bisa disunting) dan tombol "Susun
  dengan AI" memprosesnya menjadi Pembahasan / Keputusan /
  Tindak Lanjut persis seperti hasil dikte. Transkrip memakai
  kunci Gemini yang sama di Pengaturan; bila kunci belum diisi,
  pesan errornya menyebut itu dengan jelas. Karena satu sel
  Google Sheets maksimal 50.000 karakter sedangkan transkrip
  2–3 jam bisa ±150.000 karakter, transkrip panjang disimpan
  sebagai berkas teks "Transkrip Rapat <id>.txt" di folder Drive
  SesiRapat_Arsip (kolom baru transkripFileId di sheet
  Notulensi; sel transcript dikosongkan) dan dibaca utuh kembali
  oleh Notulen Studio maupun Susun AI. Untuk pembaruan ini:
  tempel ulang Code.gs + Index.html terbaru, jalankan
  buatDatabase() SEKALI lagi dari editor (aman diulang — hanya
  melengkapi kolom header transkripFileId yang baru, data tidak
  berubah), lalu deploy sebagai versi baru.

  KHUSUS PEMBARUAN KE FASE 4.11 (transkrip LATAR + hapus dokumen
  + menu mengikuti peran): tiga perubahan besar.
  (1) Transkrip rekaman audio kini PROSES LATAR. Panel "Unggah
  Rekaman Audio" di Notulen Studio tetap menjadi tempat mengunggah,
  tetapi segmen rekaman kini diunggah dulu ke subfolder "Segmen
  Audio" di Drive SesiRapat_Arsip, lalu SERVER Google yang
  mentranskripnya segmen demi segmen lewat pemicu waktu tiap
  1 menit. Setelah pengunggahan tuntas, tab boleh ditutup dan
  layar dimatikan — buka lagi kapan saja, kartu status di panel
  menunjukkan Mengantre / Berjalan segmen X dari Y / Selesai /
  Gagal (dengan pesan jelas dan tombol "Lanjutkan dari Segmen
  Terakhir"). Transkrip tergabung otomatis ke kolom Transkrip
  notulen; transkrip yang sudah ada sebelumnya (hasil dikte /
  ketikan) dipertahankan sebagai awalan, tidak tertimpa. Berkas
  audio segmen otomatis dibuang ke sampah setelah job selesai.
  (2) Tombol HAPUS dokumen terbit: setiap Notulensi dan Lembar
  Presensi yang sudah diterbitkan kini punya tombol Hapus — di
  Arsip dan di seksi Dokumen Ruang Rapat — dengan konfirmasi dua
  langkah. Dokumen hilang dari daftar arsip dan berkas PDF /
  Docs / DOCX-nya di Drive dipindah ke sampah; nomor register
  yang dihapus tidak dipakai ulang.
  (3) Menu dan halaman MENGIKUTI PERAN secara ketat: halaman di
  luar akses peran tidak dimunculkan sama sekali (bukan sekadar
  dinonaktifkan) dan ditolak bila dibuka langsung. Template
  Studio dan Pengaturan (termasuk unduh kode skrip, kunci Gemini,
  panduan deploy/migrasi, pengguna & peran) khusus Admin; Buku
  Peserta untuk Admin/Notulis; Pimpinan hanya membaca rapat,
  presensi, notulen (panel rekam/unggah/AI disembunyikan, isi
  hanya-baca) dan dokumen, memberi persetujuan notulen, dan
  memantau tindak lanjut. Tombol aksi kontekstual di menu bawah
  (Buat Rapat / Tambah Tugas / Ekspor) juga mengikuti peran.
  Untuk pembaruan ini: tempel ulang Code.gs + Index.html
  terbaru, jalankan buatDatabase() SEKALI lagi dari editor (dua
  sheet baru Antrean_Transkrip + Segmen_Transkrip ditambahkan —
  total 14 sheet — data lama tidak berubah; buatDatabase juga
  mencoba memasang pemicu transkrip otomatis), lalu jalankan
  fungsi pasangPemicuTranskrip() SEKALI dari editor (atau menu
  SesiRapat › "Pasang pemicu transkrip latar" di spreadsheet)
  sampai muncul pesan pemicu aktif, dan terakhir deploy sebagai
  versi baru.

  KHUSUS PEMBARUAN KE FASE 5.0 (Pelacak & Pengingat): empat hal
  baru, semuanya opsional dan tidak mengubah alur yang sudah
  berjalan.
  (1) Pengingat rapat otomatis H-3, H-1, dan hari-H tampil di
  seksi "Pengingat" di Linimasa, lengkap dengan tombol Buka Rapat
  dan Bagikan Undangan. Jam pengingat diatur Admin di Pengaturan
  › "Pengingat & Telegram" (bawaan 07:00 pagi): setelah jam itu,
  Linimasa juga memunculkan notifikasi sistem di perangkat
  penyelenggara bila izin notifikasi browser sudah diberikan.
  Peserta tanpa akun tetap hanya dijangkau lewat teks undangan
  WhatsApp/Telegram — tidak ada notifikasi langsung ke HP peserta.
  (2) Pengingat tindak lanjut: tugas yang lewat tenggat ditandai
  merah "Lewat tenggat · N hari", yang jatuh tempo hari ini /
  besok (H-1) / 3 hari lagi (H-3) ditandai juga, di halaman Tindak
  Lanjut maupun Linimasa, terurut paling mendesak di atas, dengan
  tombol langsung ke tugasnya.
  (3) Rekap otomatis: begitu rapat diakhiri, rekap terbentuk —
  ringkasan kehadiran (Hadir / Terlambat / Izin / Alpa dari total
  undangan), keputusan dari notulen, dan tindak lanjut yang belum
  selesai — tampil di Linimasa (3 terbaru), di Arsip, dan di Ruang
  Rapat, dengan tombol "Bagikan Rekap" (share sistem / salin teks
  siap tempel ke grup WhatsApp/Telegram).
  (4) Dua opsi yang mati secara bawaan: GEOFENCE presensi per
  rapat (kartu "Geofence presensi" di seksi Presensi rapat:
  tentukan titik lokasi rapat + radius, presensi mandiri peserta
  hanya diterima dari perangkat di dalam radius itu; presensi
  kios/manual penyelenggara tidak dibatasi) dan PENGINGAT
  TELEGRAM (Pengaturan › "Pengingat & Telegram": isi token bot
  dari @BotFather + Chat ID tujuan, hidupkan, lalu pemicu
  pengingat tiap 1 jam mengirim pengingat jatuh tempo sekali per
  tonggak — tercatat di sheet Log_Pengingat agar tidak terkirim
  ganda). Setiap jenis pengingat (rapat / tindak lanjut / rekap)
  bisa dimatikan sendiri-sendiri di Pengaturan.
  Untuk pembaruan ini: tempel ulang Code.gs + Index.html
  terbaru, jalankan buatDatabase() SEKALI lagi dari editor (4
  kolom geofence baru di sheet Rapat + sheet baru Log_Pengingat
  ditambahkan — total 15 sheet — data lama tidak berubah;
  buatDatabase juga mencoba memasang pemicu pengingat otomatis),
  lalu jalankan fungsi pasangPemicuPengingat() SEKALI dari
  editor (atau menu SesiRapat › "Pasang pemicu pengingat
  Telegram" di spreadsheet) sampai muncul pesan pemicu aktif —
  pemicu ini hanya benar-benar mengirim bila kanal Telegram
  dihidupkan di Pengaturan — dan terakhir deploy sebagai versi
  baru.

  KHUSUS PEMBARUAN KE FASE 5.1 (pengingat hari-H tiga kali +
  info versi): dua hal baru.
  (1) Pengingat rapat pada HARI-H kini dikirim TIGA kali: pagi
  hari pada jam pengingat yang diatur (bawaan 07:00), 5 jam
  sebelum jam mulai rapat, dan 2 jam sebelum jam mulai rapat.
  Masing-masing hanya terkirim sekali per rapat (tercatat di
  sheet Log_Pengingat dengan tonggak Hari-H / H-5J / H-2J),
  tampil di seksi Pengingat Linimasa (kartu rapat hari ini
  menampilkan ketiga jam kirimnya), sebagai notifikasi sistem
  di perangkat penyelenggara setelah waktunya tiba, dan lewat
  Telegram bila kanal Telegram dihidupkan — pengingat 5 jam &
  2 jam dikirim pemicu pengingat pada waktunya sendiri, tidak
  menunggu jam pengingat pagi. Ketiganya bisa dimatikan
  sendiri-sendiri di Pengaturan › "Pengingat & Telegram" ›
  "Pengingat khusus hari-H (tiga kali)" — mematikan satu tidak
  mematikan dua lainnya, dan pengingat H-3/H-1 tetap mengikuti
  tombol "Pengingat rapat".
  (2) Info VERSI yang sedang berjalan kini tampil jelas supaya
  kamu bisa memastikan deployment-mu sudah yang terbaru:
  Pengaturan Web App ini (kartu "Tentang versi Google ini")
  menampilkan nomor versi paket yang sedang berjalan, Linimasa
  menampilkannya di bagian bawah, dan Tes koneksi dari
  Pengaturan SesiRapat versi Muse melaporkan nomor versi yang
  sama dari jawaban ping Web App. Versi paket saat ini: Fase
  5.1. Bila nomor di Web App-mu lebih kecil, berarti Code.gs /
  Index.html belum ditempel ulang atau deployment belum
  diperbarui ke versi baru.
  Untuk pembaruan ini: tempel ulang Code.gs + Index.html
  terbaru lalu deploy sebagai versi baru. buatDatabase() TIDAK
  perlu dijalankan lagi — tidak ada sheet atau kolom baru;
  setelan hari-H yang baru tersimpan sebagai baris kunci-biasa
  di sheet Pengaturan dan otomatis bernilai hidup (bawaan)
  sampai kamu mengubahnya.

  KHUSUS PEMBARUAN KE FASE 5.2 (perapian tampilan Web App):
  dua perbaikan tampilan dari laporan tangkapan layar.
  (1) Bilah tombol biru "Tampilkan/Sembunyikan QR Presensi" di
  seksi Presensi kini punya jarak atas yang cukup dari tab
  seksi (Presensi / Notulen / Tindak Lanjut / Dokumen) di
  atasnya — sebelumnya menempel mentok ke tab itu. Posisi dan
  tampilannya kini sama seperti versi Muse: satu baris penuh
  tepat di atas kartu QR, tombol membentang, teks status kecil
  di kanannya.
  (2) Semua kotak centang kini menempel rapi di KIRI teks
  labelnya dengan jarak yang wajar — sebelumnya kotak centang
  (mis. "Aktifkan geofence untuk rapat ini") tampil di tengah
  baris, jauh dari labelnya, karena aturan lebar input umum
  ikut meregangkannya. Perbaikan ini berlaku untuk semua
  kotak centang: geofence di seksi Presensi, "Jadikan template
  aktif" di Template Studio, dan semua tombol di Pengaturan ›
  "Pengingat & Telegram" (pengingat rapat / tindak lanjut /
  rekap, tiga pengingat hari-H, dan Telegram).
  Versi paket saat ini: Fase 5.2.
  Untuk pembaruan ini: cukup tempel ulang Index.html terbaru
  (Code.gs hanya berubah nomor versi, boleh ikut ditempel
  ulang) lalu deploy sebagai versi baru. buatDatabase() TIDAK
  perlu dijalankan lagi — tidak ada sheet atau kolom baru.

  KHUSUS PEMBARUAN KE FASE 5.3 (laman Presensi disamakan
  dengan versi Muse):
  (1) Ringkasan kehadiran di kartu QR seksi Presensi kini
  berupa KARTU rekap seperti versi Muse — satu kartu per
  keterangan dengan angka besar berwarna (Hadir hijau, Belum
  gelap, Izin biru, Alpa merah), bukan lagi baris chip teks.
  Kartu Terlambat (kuning tua) hanya muncul bila ada peserta
  yang terlambat.
  (2) Kartu baru "Presensi Tamu / Peserta Baru" di seksi
  Presensi, berdampingan dengan kartu Undang peserta — persis
  alur versi Muse: penyelenggara mencatat tamu yang tidak
  ada di daftar undangan (nama dengan saran dari Buku Peserta,
  NIP/jabatan/unit dan tanda tangan opsional); kehadirannya
  tercatat berlabel Tamu dengan anti-ganda dan cap Terlambat
  otomatis, dan tamu bisa disimpan ke Buku Peserta dari Papan
  hadir. Tamu juga tetap bisa presensi mandiri lewat tautan
  stabil (mode Tamu di halaman presensi peserta).
  Versi paket saat ini: Fase 5.3.
  Untuk pembaruan ini: tempel ulang Code.gs + Index.html
  terbaru lalu deploy sebagai versi baru. buatDatabase()
  TIDAK perlu dijalankan lagi — tidak ada sheet atau kolom
  baru.

  KHUSUS PEMBARUAN KE FASE 5.4 (PDF presensi tampil sebagai
  kartu + area tanda tangan tanpa garis tabel):
  (1) PDF Lembar Presensi yang diterbitkan dari dokumen
  bawaan (tanpa template Google Docs aktif) kini tampil
  sebagai KARTU: satu kartu lebar per peserta berisi No,
  Nama, NIP, Jabatan, Unit, Status, Jam Hadir, dan Tanda
  Tangan — tidak ada lagi kolom sempit yang membuat teks
  Jabatan/Unit terpotong per huruf atau NIP terbelah.
  Berkas Google Docs + DOCX hasil terbit yang sama TETAP
  berupa tabel seperti sebelumnya, jadi tetap bisa
  disunting. Bila kamu memakai template Google Docs aktif,
  PDF mengikuti desain template-mu sendiri apa adanya —
  tampilan kartu hanya berlaku untuk dokumen bawaan.
  Notulensi tidak memakai tabel peserta (daftar hadirnya
  berupa teks), jadi bentuk PDF-nya tidak berubah.
  (2) Area tanda tangan kini bersih tanpa garis kotak
  tabel di semua hasil terbit: blok tanda tangan penutup
  (Notulis / Pimpinan Rapat) tidak lagi bergaris kotak
  pada Notulensi maupun Presensi, di PDF maupun Docs/DOCX;
  area tanda tangan di dalam kartu PDF juga tanpa garis.
  (3) PLACEHOLDER TIDAK BERUBAH: {{BARIS_PESERTA}}, {{NO}},
  {{NAMA}}, {{NIP}}, {{JABATAN}}, {{UNIT}}, {{STATUS}},
  {{JAM_HADIR}}, {{TERLAMBAT}}, {{TTD}}, dan semua
  placeholder lain dipakai persis seperti sebelumnya.
  Template Google Docs yang sudah kamu buat TIDAK perlu
  diubah dan tetap terbit seperti biasa.
  Versi paket saat ini: Fase 5.4.
  Untuk pembaruan ini: tempel ulang Code.gs + Index.html
  terbaru lalu deploy sebagai versi baru. buatDatabase()
  TIDAK perlu dijalankan lagi — tidak ada sheet atau kolom
  baru.
PEMECAHAN MASALAH SINGKAT
  - Halaman hanya menampilkan "SyntaxError: Unexpected identifier
    'version'": itu bug paket Fase 4.3 — unduh ulang Code.gs +
    Index.html Fase 4.4 dari Pengaturan SesiRapat versi Muse,
    tempel ulang keduanya, lalu deploy sebagai versi baru.
  - "SesiRapat_DB belum dibuat": jalankan buatDatabase() sekali lagi
    dari editor.
  - Tes koneksi gagal / halaman menampilkan kode mentah: deployment
    belum versi terbaru atau akses bukan Anyone — ulangi Langkah 5
    dengan versi baru.
  - Peserta tidak menemukan namanya: pastikan ia sudah diundang ke
    rapat itu (tab Presensi > Undang peserta).
  - Kode presensi ditolak: sejak Fase 4.6 peserta yang membuka
    tautan/QR tidak memakai kode sama sekali — halaman mengambil
    kode terbaru otomatis dari server dan mencoba ulang sendiri
    bila kedaluwarsa, jadi pesan ini seharusnya tidak lagi muncul
    di halaman peserta. Kode manual 6 karakter hanya untuk
    presensi cadangan di ruangan: gunakan kode yang sedang tampil
    (sistem menerima kode jendela saat ini dan jendela sebelumnya).
  - Presensi ditolak dengan pesan jendela: presensi dibuka 30 menit
    sebelum jam jadwal mulai, ditutup saat rapat diakhiri + masa
    tenggang toleransi, dan ditolak selama rapat Dijeda — periksa
    jam rapat dan statusnya di Ruang Rapat.
  - Transkrip latar tidak berjalan / status berhenti di Mengantre
    (Fase 4.11): pemicu waktunya belum terpasang. Jalankan fungsi
    pasangPemicuTranskrip() dari editor Apps Script sampai muncul
    pesan "Pemicu transkrip latar aktif", atau buka spreadsheet
    SesiRapat_DB › menu SesiRapat › "Pasang pemicu transkrip
    latar". Periksa juga kunci Gemini di Pengaturan — tanpa kunci,
    pekerja latar tidak mengerjakan antrean. Status tiap job
    tercatat di sheet Antrean_Transkrip dan Segmen_Transkrip.
  - Dokumen terbit yang salah tidak bisa dihapus dari HP: tombol
    Hapus hanya tampil untuk peran Admin/Notulis dan hanya di
    paket Fase 4.11 ke atas — pastikan Code.gs + Index.html sudah
    ditempel ulang dan deployment sudah versi baru.
  - Menu Template / Pengaturan / Buku Peserta tidak muncul: itu
    memang perilaku Fase 4.11 — halaman mengikuti peran akun yang
    masuk (Template + Pengaturan khusus Admin, Buku Peserta
    Admin/Notulis). Masuk dengan akun Admin bila perlu membukanya.
  - Dikte Notulen Studio tidak jalan / izin mic selalu "Tanya"
    (Fase 4.7): buka Notulen Studio, ketuk "Tes Mikrofon" — tombol
    itu memanggil getUserMedia yang memicu prompt izin Chrome.
    Bila prompt tetap tidak muncul: buka Web App di aplikasi Chrome
    (bukan browser dalam WhatsApp/Telegram), ketuk ikon gembok di
    address bar › Izin situs › Mikrofon › Izinkan, lalu muat ulang
    halaman (ada tombolnya di panel Mikrofon Notulen Studio).
    Catatan Fase 4.10: di Web App Google prompt izin mic memang
    terblokir iframe secara permanen, jadi jalur yang dianjurkan
    adalah "Unggah Rekaman Audio" — rekam dengan perekam bawaan
    HP, unggah berkasnya, Gemini yang mentranskrip.
  - Transkrip rekaman audio gagal (Fase 4.10): bila pesannya
    "Kunci Gemini belum diisi", Admin mengisi kunci API Gemini di
    Pengaturan Web App dulu. Bila berhenti di tengah segmen,
    ketuk "Lanjutkan dari Segmen Terakhir" — segmen yang sudah
    selesai tidak diulang. Bila pesannya berkas terlalu besar
    (maks 200 MB) atau tidak bisa dibaca peramban, pecah rekaman
    menjadi beberapa bagian di bawah 14 MB per bagian lalu unggah
    satu per satu, atau ubah formatnya menjadi .mp3.
  - Pengingat Telegram tidak terkirim (Fase 5): periksa empat hal —
    (1) kanal Telegram dihidupkan + token bot dan Chat ID terisi di
    Pengaturan › "Pengingat & Telegram" (ketuk "Tes Kirim Telegram"
    untuk memastikan bot bisa mengirim ke chat itu; untuk grup,
    bot harus sudah ditambahkan ke grup dan Chat ID grup diawali
    tanda minus); (2) pemicu pengingat terpasang — jalankan
    pasangPemicuPengingat() dari editor atau menu SesiRapat di
    spreadsheet; (3) waktunya sudah tiba — pengingat pagi, H-3/H-1,
    tindak lanjut, dan rekap menunggu jam pengingat (bawaan 07:00)
    lewat, sedangkan pengingat hari-H 5 jam & 2 jam sebelum mulai
    (Fase 5.1) dikirim pada waktunya sendiri; pemicu memeriksa
    tiap 1 jam; (4) jenis pengingatnya tidak dimatikan di
    Pengaturan. Pengiriman tercatat di sheet Log_Pengingat; satu
    tonggak hanya dikirim sekali.
  - Presensi peserta ditolak geofence (Fase 5): pesannya
    menampilkan jarak perangkat dari titik rapat dan radiusnya.
    Penyebab umum: GPS HP belum akurat (tunggu beberapa detik di
    tempat terbuka lalu ketuk "Periksa Lokasi Saya" lagi), izin
    lokasi browser ditolak, atau radius terlalu kecil untuk gedung
    besar — naikkan radius di kartu Geofence presensi rapat itu
    (mis. 150–250 m), atau matikan geofence bila tidak diperlukan.
    Presensi kios/manual oleh penyelenggara tidak dibatasi
    geofence.
