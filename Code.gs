// =====================================================================
// SesiRapat — Code.gs (paket Google)
// ---------------------------------------------------------------------
// Muara rancangan SesiRapat di ekosistem Google:
//   - Database : spreadsheet "SesiRapat_DB" (dibuat oleh buatDatabase())
//   - Arsip    : folder Drive "SesiRapat_Arsip" (dokumen PDF/Docs hasil
//                terbit, tanda tangan peserta, berkas impor JSON)
//   - Web App  : berkas ini + berkas HTML bernama "Index"
//   - Login    : akun Google; email dipetakan ke peran di sheet
//                Pengguna (Admin, Notulis, Pimpinan)
//   - Presensi : peserta presensi mandiri lintas perangkat lewat tautan
//                publik STABIL ?presensi=<ID rapat> (Fase 4.6: hanya ID
//                rapat, TANPA kode 60 detik — tidak kedaluwarsa saat
//                dibagikan ke grup WA/Telegram; halaman publik mengambil
//                kode terbaru otomatis dari server). Kode manual di
//                Ruang Rapat tetap berputar 60 detik. Jendela presensi:
//                dibuka jadwal mulai −30 menit, tepat waktu sampai
//                jadwal + toleransi, setelah itu Terlambat sampai rapat
//                diakhiri + masa tenggang toleransi; anti-ganda.
//   - Notulen  : Unggah Rekaman Audio — rekaman dari perekam bawaan
//                HP ditranskrip Gemini per segmen di Notulen Studio
//                (jalur utama versi Google karena mic browser
//                terblokir iframe); sejak Fase 4.11 transkripnya
//                PROSES LATAR: segmen diunggah ke Drive, lalu pemicu
//                waktu server (prosesAntreanTranskrip, tiap 1 menit)
//                yang mengerjakan — tab boleh ditutup, progres per
//                segmen terlihat lagi saat halaman dibuka. Transkrip
//                panjang disimpan sebagai berkas teks di Drive
//                SesiRapat_Arsip.
//   - Peran    : menu, halaman, dan tombol mengikuti peran pengguna —
//                halaman di luar akses peran tidak dimunculkan dan
//                ditolak server (Template Studio + Pengaturan khusus
//                Admin, Buku Peserta Admin/Notulis).
//
// Cara pakai pertama kali:
//   1. Tempel seluruh berkas ini sebagai Code.gs.
//   2. Buat berkas HTML bernama "Index", tempel Index.html dari
//      Pengaturan SesiRapat.
//   3. Jalankan fungsi buatDatabase() sekali (tombol Run di editor) dan
//      setujui izin — database + folder arsip dibuat otomatis, email
//      kamu menjadi Admin pertama.
//   4. Deploy sebagai Web App (Execute as: Me, Access: Anyone) lalu
//      tempel URL /exec ke Pengaturan SesiRapat versi Muse dan klik
//      Tes koneksi.
// =====================================================================

var NAMA_DB = 'SesiRapat_DB';
var NAMA_ARSIP = 'SesiRapat_Arsip';
var NAMA_BERKAS_IMPOR = 'sesirapat-ekspor.json';
var ZONA = 'Asia/Jakarta';
var VERSI_PAKET = 'Fase 5.4';

// Definisi sheet + header. buatDatabase() menulis header ini persis —
// jangan mengetik manual supaya tidak ada salah ketik nama kolom.
var HEADERS = {
  'Rapat': ['id', 'nama', 'jenis', 'tanggal', 'jamMulai', 'jamSelesai', 'tempat', 'pimpinan', 'notulis', 'agenda', 'nomorUndangan', 'status', 'secret', 'startedAt', 'endedAt', 'createdAt', 'suratUrl', 'suratFileName', 'pausedAt', 'pauseReason', 'pausedTotalMs', 'geofenceAktif', 'geofenceLat', 'geofenceLng', 'geofenceRadius'],
  'Kelompok': ['id', 'nama', 'createdAt'],
  'Peserta': ['id', 'nama', 'nip', 'jabatan', 'unit', 'kelompok', 'createdAt'],
  'Kehadiran': ['id', 'meetingId', 'personId', 'nama', 'nip', 'jabatan', 'unit', 'status', 'invitedAt', 'checkinAt', 'late', 'method', 'signatureUrl', 'tamu'],
  'Notulensi': ['id', 'meetingId', 'transcript', 'pembahasan', 'keputusan', 'status', 'catatanPimpinan', 'disetujuiOleh', 'disetujuiPada', 'updatedAt', 'transkripFileId'],
  'Tindak_Lanjut': ['id', 'meetingId', 'uraian', 'penanggungJawab', 'tenggatText', 'tenggatDate', 'status', 'source', 'createdAt', 'doneAt'],
  'Template': ['id', 'jenis', 'nama', 'versi', 'kopLines', 'placeholders', 'docsId', 'fileName', 'aktif', 'createdAt'],
  'Dokumen': ['id', 'meetingId', 'jenis', 'nomorRegister', 'templateId', 'pdfUrl', 'docsUrl', 'createdAt', 'docxUrl'],
  'Pengguna': ['email', 'nama', 'peran', 'pin'],
  'Log_Status': ['id', 'meetingId', 'dari', 'ke', 'waktu', 'catatan'],
  'Pengaturan': ['kunci', 'nilai'],
  'Pembagian_Undangan': ['id', 'meetingId', 'kanal', 'jumlahPenerima', 'createdAt'],
  'Antrean_Transkrip': ['id', 'meetingId', 'namaFile', 'status', 'totalSegmen', 'segmenSelesai', 'pesanError', 'dibuatPada', 'diubahPada', 'prefixFileId'],
  'Segmen_Transkrip': ['id', 'jobId', 'indeks', 'fileId', 'mimeType', 'status', 'teks', 'pesanError'],
  'Log_Pengingat': ['id', 'jenis', 'refId', 'tonggak', 'kanal', 'terkirimPada']
};
var SHEET_NAMES = ['Rapat', 'Kelompok', 'Peserta', 'Kehadiran', 'Notulensi', 'Tindak_Lanjut', 'Template', 'Dokumen', 'Pengguna', 'Log_Status', 'Pengaturan', 'Pembagian_Undangan', 'Antrean_Transkrip', 'Segmen_Transkrip', 'Log_Pengingat'];

// ---------------------------------------------------------------------
// Utilitas dasar
// ---------------------------------------------------------------------

function str_(v) {
  if (v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, ZONA, "yyyy-MM-dd'T'HH:mm:ss");
  }
  return String(v);
}

function num_(v) {
  var n = Number(v);
  return isNaN(n) ? 0 : n;
}

function trim_(s) {
  var t = String(s === null || s === undefined ? '' : s);
  var a = 0, b = t.length;
  while (a < b && t.charCodeAt(a) <= 32) a++;
  while (b > a && t.charCodeAt(b - 1) <= 32) b--;
  return t.slice(a, b);
}

function sekarangIso_() {
  return new Date().toISOString();
}

// Token presensi: FNV-1a 32-bit atas "secret:windowIndex" — sama persis
// dengan versi Muse, window = menit epoch (berputar tiap 60 detik).
function hashToken_(input) {
  var h = 0x811c9dc5;
  for (var i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  var s = (h >>> 0).toString(36).toUpperCase();
  while (s.length < 7) s = '0' + s;
  return s.slice(-6);
}

function tokenPresensi_(secret, windowIndex) {
  return hashToken_(secret + ':' + windowIndex);
}

function windowSekarang_() {
  return Math.floor(new Date().getTime() / 60000);
}

function tokenValid_(secret, kode) {
  var w = windowSekarang_();
  var k = String(kode || '').toUpperCase();
  return k === tokenPresensi_(secret, w) || k === tokenPresensi_(secret, w - 1);
}

var HARI_ = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
var BULAN_ = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function bagianTanggal_(tanggal) {
  var p = String(tanggal || '').split('-');
  return { y: num_(p[0]) || 1970, m: num_(p[1]) || 1, d: num_(p[2]) || 1 };
}

function tanggalPanjang_(tanggal) {
  var b = bagianTanggal_(tanggal);
  var dow = new Date(Date.UTC(b.y, b.m - 1, b.d)).getUTCDay();
  return HARI_[dow] + ', ' + b.d + ' ' + BULAN_[b.m - 1] + ' ' + b.y;
}

function tanggalSingkat_(tanggal) {
  var b = bagianTanggal_(tanggal);
  return b.d + ' ' + BULAN_[b.m - 1] + ' ' + b.y;
}

function jamDariIso_(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return Utilities.formatDate(d, ZONA, 'HH:mm');
}

function parseTanggalJam_(tanggal, jam) {
  var b = bagianTanggal_(tanggal);
  var j = String(jam || '00:00').split(':');
  return new Date(b.y, b.m - 1, b.d, num_(j[0]), num_(j[1]));
}

// Jendela presensi (Fase 4.6 — rumus yang sama dengan versi Muse,
// gabungan jadwal + sampai rapat ditutup):
//   - Dibuka: jam jadwal mulai − 30 menit. Tombol Mulai Rapat BUKAN
//     gerbang pembuka — peserta awal bisa presensi sejak jadwal−30
//     menit walau rapat belum dinyatakan dimulai.
//   - Tepat waktu: sampai jam jadwal mulai + toleransi terlambat.
//   - Lewat dari itu: tetap bisa presensi, tercatat Terlambat, sampai
//     rapat ditutup.
//   - Ditutup: saat rapat diakhiri (endedAt) + toleransi yang sama
//     (masa tenggang — BUKAN jam jadwal selesai, karena rapat bisa
//     molor). Selama masa tenggang status jendela 'lewat'.
// Presensi ditolak selama rapat Dijeda dan sebelum jendela dibuka.
function jendelaPresensi_(m) {
  var tol = parseInt(getPengaturan_('toleransi_terlambat', '15'), 10);
  if (isNaN(tol)) tol = 15;
  var mulai = parseTanggalJam_(str_(m.tanggal), str_(m.jamMulai));
  var bukaAt = new Date(mulai.getTime() - 30 * 60000);
  var batasAt = new Date(mulai.getTime() + tol * 60000);
  var tutupAt = null;
  if (m.endedAt) {
    var akhir = new Date(m.endedAt);
    if (!isNaN(akhir.getTime())) tutupAt = new Date(akhir.getTime() + tol * 60000);
  }
  var now = new Date();
  var st = str_(m.status);
  var tenggang = st === 'Selesai' && tutupAt != null && now.getTime() <= tutupAt.getTime();
  var status;
  if (st === 'Selesai') status = tenggang ? 'lewat' : 'ditutup';
  else if (st === 'Dijeda') status = 'dijeda';
  else if (now.getTime() < bukaAt.getTime()) status = 'segera';
  else if (now.getTime() <= batasAt.getTime()) status = 'dibuka';
  else status = 'lewat';
  var fmt = function (d) { return Utilities.formatDate(d, ZONA, 'HH:mm'); };
  var buka = fmt(bukaAt);
  var batas = fmt(batasAt);
  var tutup = tutupAt ? fmt(tutupAt) : '';
  var statusText =
    status === 'segera' ? 'Segera dibuka' :
    status === 'dibuka' ? 'Dibuka' :
    status === 'lewat' ? (tenggang
      ? 'Masa tenggang — rapat sudah diakhiri, presensi masih dibuka sampai ' + tutup + ' WIB (tercatat Terlambat)'
      : 'Lewat batas tepat waktu — masih bisa, tercatat Terlambat') :
    status === 'dijeda' ? 'Dijeda' : 'Ditutup';
  return {
    buka: buka, batasTepatWaktu: batas, tutup: tutup,
    status: status, statusText: statusText,
    label: 'Presensi dibuka ' + buka + ' WIB · tepat waktu sampai ' + batas +
      ' · ditutup ' + (tutup ? 'pukul ' + tutup + ' WIB' : tol + ' menit setelah rapat diakhiri')
  };
}

// Finalisasi Alpa tertunda: mengakhiri rapat TIDAK langsung menandai
// sisa undangan sebagai Alpa, karena jendela presensi masih punya masa
// tenggang (endedAt + toleransi). Fungsi ini — dipanggil dari jalur
// baca — menandai sisa 'Undangan' sebagai Alpa hanya setelah jendela
// benar-benar ditutup.
function finalisasiAlpa_(m) {
  if (str_(m.status) !== 'Selesai' || !m.endedAt) return;
  var tol = parseInt(getPengaturan_('toleransi_terlambat', '15'), 10);
  if (isNaN(tol)) tol = 15;
  var akhir = new Date(m.endedAt);
  if (isNaN(akhir.getTime())) return;
  if (new Date().getTime() <= akhir.getTime() + tol * 60000) return;
  var kd = sheetData_('Kehadiran').rows;
  for (var i = 0; i < kd.length; i++) {
    if (num_(kd[i].meetingId) === num_(m.id) && str_(kd[i].status) === 'Undangan') {
      updateRowById_('Kehadiran', kd[i].id, { status: 'Alpa' });
    }
  }
}

// ---------------------------------------------------------------------
// Fase 5 — Pelacak & Pengingat: tonggak rapat (H-3/H-1/hari-H), status
// tenggat tindak lanjut, rekap otomatis, geofence, Telegram opsional.
// Semantiknya sama persis dengan versi Muse: tonggak dihitung murni
// dari tanggal tersimpan vs hari ini; yang disimpan hanya log
// pengiriman Telegram (sheet Log_Pengingat) agar tidak terkirim ganda.
// ---------------------------------------------------------------------

function selisihHari_(dariTanggal, keTanggal) {
  var a = bagianTanggal_(dariTanggal);
  var b = bagianTanggal_(keTanggal);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000);
}

function hariIni_() {
  return Utilities.formatDate(new Date(), ZONA, 'yyyy-MM-dd');
}

// Tonggak pengingat rapat untuk hari ini: {tonggak, sisaHari} atau null.
function tonggakRapat_(m, today) {
  if (str_(m.status) === 'Selesai') return null;
  var sisa = selisihHari_(today, str_(m.tanggal));
  if (sisa === 3) return { tonggak: 'H-3', sisaHari: 3 };
  if (sisa === 1) return { tonggak: 'H-1', sisaHari: 1 };
  if (sisa === 0) return { tonggak: 'Hari-H', sisaHari: 0 };
  return null;
}

// Status tenggat tindak lanjut terbuka: {jenis, hari} atau null.
// jenis: 'lewat' | 'hari-ini' | 'h-1' | 'h-3'.
function statusTenggat_(f, today) {
  if (str_(f.status) === 'Selesai') return null;
  var tg = str_(f.tenggatDate);
  if (!tg) return null;
  var sisa = selisihHari_(today, tg);
  if (sisa < 0) return { jenis: 'lewat', hari: -sisa };
  if (sisa === 0) return { jenis: 'hari-ini', hari: 0 };
  if (sisa === 1) return { jenis: 'h-1', hari: 1 };
  if (sisa === 3) return { jenis: 'h-3', hari: 3 };
  return null;
}

function labelTenggat_(s) {
  if (!s) return '';
  if (s.jenis === 'lewat') return 'Lewat tenggat · ' + s.hari + ' hari';
  if (s.jenis === 'hari-ini') return 'Tenggat hari ini';
  if (s.jenis === 'h-1') return 'Tenggat besok (H-1)';
  return 'Tenggat 3 hari lagi (H-3)';
}

function pengingatSetelan_() {
  function flag(kunci, bawaan) {
    var v = getPengaturan_(kunci, '');
    if (v === '') return bawaan;
    return v === '1';
  }
  var jam = getPengaturan_('pengingat_jam', '07:00');
  if (!/^\d{2}:\d{2}$/.test(jam)) jam = '07:00';
  return {
    rapat: flag('pengingat_rapat', true),
    tindak: flag('pengingat_tindak', true),
    rekap: flag('pengingat_rekap', true),
    // Fase 5.1 — tiga pengingat hari-H, masing-masing bisa dimatikan
    // sendiri-sendiri (bawaan semuanya hidup).
    hariHPagi: flag('pengingat_hh_pagi', true),
    hariH5Jam: flag('pengingat_hh_5jam', true),
    hariH2Jam: flag('pengingat_hh_2jam', true),
    jam: jam,
    telegramAktif: flag('telegram_aktif', false)
  };
}

function hhmmDariDate_(d) {
  return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
}

// Waktu mulai rapat sebagai Date (zona waktu skrip = ZONA).
function instanMulai_(m) {
  var b = bagianTanggal_(str_(m.tanggal));
  var jm = str_(m.jamMulai).split(':');
  return new Date(b.y, b.m - 1, b.d, Number(jm[0] || 0), Number(jm[1] || 0));
}

// Fase 5.1 — tiga pengingat hari-H satu rapat: pagi pada jam
// pengingat (PAGI), 5 jam sebelum mulai (H-5J), 2 jam sebelum
// mulai (H-2J) — hanya jenis yang hidup di Pengaturan. pukul =
// jam kirim 'HH:MM'; sejak = ISO waktu kirimnya (bisa jatuh di
// hari sebelumnya untuk rapat sangat pagi).
function pengingatHariH_(m, setelan) {
  var out = [];
  var mulai = instanMulai_(m);
  if (setelan.hariHPagi) {
    var b = bagianTanggal_(str_(m.tanggal));
    var jp = setelan.jam.split(':');
    var pagi = new Date(b.y, b.m - 1, b.d, Number(jp[0] || 7), Number(jp[1] || 0));
    out.push({ kode: 'PAGI', pukul: setelan.jam, sejak: pagi.toISOString() });
  }
  if (setelan.hariH5Jam) {
    var t5 = new Date(mulai.getTime() - 5 * 3600000);
    out.push({ kode: 'H-5J', pukul: hhmmDariDate_(t5), sejak: t5.toISOString() });
  }
  if (setelan.hariH2Jam) {
    var t2 = new Date(mulai.getTime() - 2 * 3600000);
    out.push({ kode: 'H-2J', pukul: hhmmDariDate_(t2), sejak: t2.toISOString() });
  }
  return out;
}

// Jarak haversine dua koordinat, dalam meter (geofence presensi).
function jarakMeter_(lat1, lng1, lat2, lng2) {
  var R = 6371000;
  var rad = function (d) { return d * Math.PI / 180; };
  var dLat = rad(lat2 - lat1);
  var dLng = rad(lng2 - lng1);
  var a = Math.pow(Math.sin(dLat / 2), 2) +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.pow(Math.sin(dLng / 2), 2);
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

// Rekap otomatis rapat selesai — bentuknya sama dengan versi Muse:
// ringkasan kehadiran, keputusan notulen, tindak lanjut terbuka, dan
// teks siap bagikan.
function rekapRapat_(m) {
  finalisasiAlpa_(m);
  var c = hitungKehadiran_(m.id);
  var nd = sheetData_('Notulensi').rows;
  var keputusan = [];
  for (var i = 0; i < nd.length; i++) {
    if (num_(nd[i].meetingId) !== num_(m.id)) continue;
    var baris = str_(nd[i].keputusan).split('\n');
    for (var b = 0; b < baris.length; b++) {
      var t = trim_(baris[b].replace(/^[-•0-9.)\s]+/, ''));
      if (t) keputusan.push(t);
    }
  }
  var fd = sheetData_('Tindak_Lanjut').rows;
  var terbuka = [];
  for (var j = 0; j < fd.length; j++) {
    if (num_(fd[j].meetingId) !== num_(m.id)) continue;
    if (str_(fd[j].status) === 'Selesai') continue;
    terbuka.push({
      id: num_(fd[j].id), uraian: str_(fd[j].uraian),
      penanggungJawab: str_(fd[j].penanggungJawab),
      tenggatText: str_(fd[j].tenggatText), tenggatDate: str_(fd[j].tenggatDate)
    });
  }
  var lines = [
    '📋 *REKAP RAPAT — SesiRapat*',
    '*' + str_(m.nama) + '*',
    '🗓️ ' + tanggalPanjang_(m.tanggal) + ' · ' + str_(m.jamMulai) + ' WIB' + (str_(m.tempat) ? ' · ' + str_(m.tempat) : ''),
    '',
    '👥 Kehadiran: Hadir ' + c.hadir + ' (terlambat ' + c.terlambat + ') · Izin ' + c.izin + ' · Alpa ' + c.alpa + ' · dari ' + c.undangan + ' undangan'
  ];
  if (keputusan.length) {
    lines.push('', '✅ *Keputusan:*');
    for (var k = 0; k < keputusan.length; k++) lines.push((k + 1) + '. ' + keputusan[k]);
  } else {
    lines.push('', '✅ Keputusan: belum tercatat di notulen.');
  }
  if (terbuka.length) {
    lines.push('', '📌 *Tindak lanjut belum selesai (' + terbuka.length + '):*');
    for (var t2 = 0; t2 < terbuka.length; t2++) {
      var f2 = terbuka[t2];
      lines.push('• ' + f2.uraian + (f2.penanggungJawab ? ' — ' + f2.penanggungJawab : '') + (f2.tenggatText ? ' (' + f2.tenggatText + ')' : f2.tenggatDate ? ' (' + tanggalSingkat_(f2.tenggatDate) + ')' : ''));
    }
  } else {
    lines.push('', '📌 Tindak lanjut: semua sudah selesai. 🎉');
  }
  return {
    meetingId: num_(m.id), nama: str_(m.nama), tanggal: str_(m.tanggal),
    tanggalPanjang: tanggalPanjang_(m.tanggal), jamMulai: str_(m.jamMulai),
    tempat: str_(m.tempat), undangan: c.undangan, hadir: c.hadir,
    izin: c.izin, alpa: c.alpa, belum: c.belum, terlambat: c.terlambat,
    keputusan: keputusan, tindakTerbuka: terbuka, teks: lines.join('\n')
  };
}

// --- Telegram opsional (mati bawaan) ---------------------------------

function kirimTelegram_(teks) {
  var token = trim_(getPengaturan_('telegram_bot_token', ''));
  var chatId = trim_(getPengaturan_('telegram_chat_id', ''));
  if (!token || !chatId) {
    return { ok: false, detail: 'Token bot atau Chat ID Telegram belum diisi di Pengaturan.' };
  }
  try {
    var res = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ chat_id: chatId, text: teks }),
      muteHttpExceptions: true
    });
    var kode = res.getResponseCode();
    var data = {};
    try { data = JSON.parse(res.getContentText() || '{}'); } catch (e) { data = {}; }
    if (kode === 200 && data.ok) return { ok: true, detail: 'Terkirim.' };
    return {
      ok: false,
      detail: 'Telegram menolak (HTTP ' + kode + (data.description ? ': ' + data.description : '') + '). Periksa token bot dan Chat ID.'
    };
  } catch (e2) {
    return { ok: false, detail: 'Tidak dapat menjangkau Telegram (' + String(e2 && e2.message ? e2.message : e2) + ').' };
  }
}

function sudahTerkirim_(jenis, refId, tonggak) {
  var d = sheetData_('Log_Pengingat').rows;
  for (var i = 0; i < d.length; i++) {
    if (str_(d[i].jenis) === jenis && num_(d[i].refId) === num_(refId) && str_(d[i].tonggak) === tonggak) return true;
  }
  return false;
}

function catatTerkirim_(jenis, refId, tonggak) {
  appendRow_('Log_Pengingat', {
    id: nextId_('Log_Pengingat'), jenis: jenis, refId: refId,
    tonggak: tonggak, kanal: 'Telegram', terkirimPada: sekarangIso_()
  });
}

// Pekerja pengingat Telegram — dijalankan pemicu waktu tiap jam
// (pasangPemicuPengingat). Mengirim tonggak yang jatuh tempo HARI INI
// sekali per tonggak (Log_Pengingat). Tonggak pagi (H-3/H-1/hari-H
// pagi), tindak lanjut, dan rekap menunggu jam pengingat lewat;
// pengingat hari-H 5 jam & 2 jam sebelum mulai (Fase 5.1) dikirim
// pada waktunya sendiri — bisa lebih pagi dari jam pengingat.
// Tanpa pemicu / tanpa Telegram aktif, fungsi ini tidak melakukan
// apa pun dan pengingat tetap tampil di Linimasa + notifikasi
// perangkat saat Web App dibuka.
function prosesPengingat() {
  var setelan = pengingatSetelan_();
  if (!setelan.telegramAktif) return 'Pengingat Telegram mati.';
  if (!trim_(getPengaturan_('telegram_bot_token', '')) || !trim_(getPengaturan_('telegram_chat_id', ''))) {
    return 'Token bot / Chat ID Telegram belum lengkap.';
  }
  var jamNow = Utilities.formatDate(new Date(), ZONA, 'HH:mm');
  var jamLewat = jamNow >= setelan.jam;
  var today = hariIni_();
  var nowMs = new Date().getTime();
  var terkirim = 0;
  function kirimSekali(jenis, refId, tonggak, teks) {
    if (sudahTerkirim_(jenis, refId, tonggak)) return;
    var res = kirimTelegram_(teks);
    if (res.ok) {
      catatTerkirim_(jenis, refId, tonggak);
      terkirim++;
    }
  }
  var rd = sheetData_('Rapat').rows;
  var namaRapat = {};
  for (var n = 0; n < rd.length; n++) namaRapat[num_(rd[n].id)] = str_(rd[n].nama);
  if (setelan.rapat) {
    for (var i = 0; i < rd.length; i++) {
      var t = tonggakRapat_(rd[i], today);
      if (!t) continue;
      var detailRapat =
        tanggalPanjang_(rd[i].tanggal) + ' · ' + str_(rd[i].jamMulai) + ' WIB' +
        (str_(rd[i].tempat) ? '\nTempat: ' + str_(rd[i].tempat) : '') +
        (str_(rd[i].pimpinan) ? '\nPimpinan: ' + str_(rd[i].pimpinan) : '') +
        '\n\nSiapkan presensi dan undangannya dari SesiRapat.';
      if (t.tonggak === 'Hari-H') {
        // Hari-H pagi — pada jam pengingat, seperti sebelumnya.
        if (jamLewat && setelan.hariHPagi) {
          kirimSekali('rapat', num_(rd[i].id), 'Hari-H',
            '⏰ Pengingat rapat (HARI INI)\n\n' + str_(rd[i].nama) + '\n' + detailRapat);
        }
        // Fase 5.1 — 5 jam & 2 jam sebelum mulai: jendela kirimnya
        // dari waktu tonggaknya sampai rapat dimulai.
        var mulaiMs = instanMulai_(rd[i]).getTime();
        if (setelan.hariH5Jam && nowMs >= mulaiMs - 5 * 3600000 && nowMs < mulaiMs) {
          kirimSekali('rapat', num_(rd[i].id), 'H-5J',
            '⏰ Pengingat rapat (5 JAM LAGI)\n\n' + str_(rd[i].nama) + '\n' + detailRapat);
        }
        if (setelan.hariH2Jam && nowMs >= mulaiMs - 2 * 3600000 && nowMs < mulaiMs) {
          kirimSekali('rapat', num_(rd[i].id), 'H-2J',
            '⏰ Pengingat rapat (2 JAM LAGI)\n\n' + str_(rd[i].nama) + '\n' + detailRapat);
        }
        continue;
      }
      if (!jamLewat) continue;
      var label = t.tonggak === 'H-1' ? 'BESOK' : '3 HARI LAGI';
      kirimSekali('rapat', num_(rd[i].id), t.tonggak,
        '⏰ Pengingat rapat (' + label + ')\n\n' + str_(rd[i].nama) + '\n' + detailRapat);
    }
  }
  if (jamLewat && setelan.tindak) {
    var fd = sheetData_('Tindak_Lanjut').rows;
    for (var j = 0; j < fd.length; j++) {
      var s = statusTenggat_(fd[j], today);
      if (!s) continue;
      var tonggak = s.jenis === 'lewat' ? 'LEWAT-' + str_(fd[j].tenggatDate)
        : s.jenis === 'hari-ini' ? 'Hari-H' : s.jenis === 'h-1' ? 'H-1' : 'H-3';
      var label2 = s.jenis === 'lewat' ? 'LEWAT TENGGAT ' + s.hari + ' HARI'
        : s.jenis === 'hari-ini' ? 'TENGGAT HARI INI'
        : s.jenis === 'h-1' ? 'TENGGAT BESOK' : 'TENGGAT 3 HARI LAGI';
      kirimSekali('tindak', num_(fd[j].id), tonggak,
        '📌 Pengingat tindak lanjut (' + label2 + ')\n\n' + str_(fd[j].uraian) +
        '\nDari rapat: ' + (namaRapat[num_(fd[j].meetingId)] || '') +
        (str_(fd[j].penanggungJawab) ? '\nPenanggung jawab: ' + str_(fd[j].penanggungJawab) : '') +
        (str_(fd[j].tenggatDate) ? '\nTenggat: ' + tanggalSingkat_(fd[j].tenggatDate) : '') +
        '\n\nTandai selesai dari menu Tindak Lanjut SesiRapat bila sudah tuntas.');
    }
  }
  if (jamLewat && setelan.rekap) {
    for (var k = 0; k < rd.length; k++) {
      if (str_(rd[k].status) !== 'Selesai' || !rd[k].endedAt) continue;
      var akhir = new Date(rd[k].endedAt);
      if (isNaN(akhir.getTime())) continue;
      if (Utilities.formatDate(akhir, ZONA, 'yyyy-MM-dd') !== today) continue;
      kirimSekali('rekap', num_(rd[k].id), 'REKAP', rekapRapat_(rd[k]).teks);
    }
  }
  return 'Selesai: ' + terkirim + ' pengingat terkirim.' +
    (jamLewat ? '' : ' (Pengingat pagi/tindak/rekap menunggu jam pengingat ' + setelan.jam + '; pengingat 5 jam & 2 jam sebelum mulai diperiksa pada waktunya sendiri.)');
}

// Memasang pemicu waktu tiap 1 jam untuk prosesPengingat (idempoten).
function pasangPemicuPengingat_() {
  var pemicu = ScriptApp.getProjectTriggers();
  for (var i = 0; i < pemicu.length; i++) {
    if (pemicu[i].getHandlerFunction() === 'prosesPengingat') return true;
  }
  ScriptApp.newTrigger('prosesPengingat').timeBased().everyHours(1).create();
  return true;
}

// Jalankan SEKALI dari editor Apps Script (atau menu SesiRapat di
// spreadsheet) untuk mengaktifkan pengiriman pengingat Telegram.
function pasangPemicuPengingat() {
  var pesan = pasangPemicuPengingat_()
    ? 'Pemicu pengingat aktif: prosesPengingat berjalan tiap 1 jam.'
    : 'Pemicu pengingat sudah terpasang sebelumnya.';
  try { SpreadsheetApp.getUi().alert(pesan); } catch (e) { /* dipanggil dari editor */ }
  return pesan;
}

// ---------------------------------------------------------------------
// Akses database (spreadsheet SesiRapat_DB) dan folder arsip
// ---------------------------------------------------------------------

function db_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SESIRAPAT_DB_ID');
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { /* cari ulang */ }
  }
  var files = DriveApp.searchFiles("title = '" + NAMA_DB + "' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false");
  if (files.hasNext()) {
    var f = files.next();
    props.setProperty('SESIRAPAT_DB_ID', f.getId());
    return SpreadsheetApp.openById(f.getId());
  }
  throw new Error('SesiRapat_DB belum dibuat. Jalankan fungsi buatDatabase() sekali dari editor Apps Script.');
}

function sheet_(nama) {
  var sh = db_().getSheetByName(nama);
  if (!sh) throw new Error('Sheet "' + nama + '" tidak ada. Jalankan buatDatabase() dari editor Apps Script.');
  return sh;
}

function sheetData_(nama) {
  var sh = sheet_(nama);
  var headers = HEADERS[nama];
  var values = sh.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var obj = { _row: i + 1 };
    var kosong = true;
    for (var c = 0; c < headers.length; c++) {
      obj[headers[c]] = values[i][c];
      if (values[i][c] !== '' && values[i][c] !== null) kosong = false;
    }
    if (!kosong) rows.push(obj);
  }
  return { sh: sh, headers: headers, rows: rows };
}

function appendRow_(nama, obj) {
  var sh = sheet_(nama);
  var headers = HEADERS[nama];
  var row = [];
  for (var c = 0; c < headers.length; c++) {
    var v = obj[headers[c]];
    row.push(v === undefined || v === null ? '' : v);
  }
  var r = sh.getLastRow() + 1;
  var range = sh.getRange(r, 1, 1, headers.length);
  range.setNumberFormat('@');
  range.setValues([row]);
  return r;
}

function updateRowById_(nama, id, patch) {
  var d = sheetData_(nama);
  for (var i = 0; i < d.rows.length; i++) {
    if (num_(d.rows[i].id) === num_(id)) {
      var merged = {};
      for (var c = 0; c < d.headers.length; c++) {
        var h = d.headers[c];
        merged[h] = patch[h] !== undefined ? patch[h] : d.rows[i][h];
      }
      var row = [];
      for (var k = 0; k < d.headers.length; k++) {
        var v = merged[d.headers[k]];
        row.push(v === undefined || v === null ? '' : v);
      }
      var range = d.sh.getRange(d.rows[i]._row, 1, 1, d.headers.length);
      range.setNumberFormat('@');
      range.setValues([row]);
      return true;
    }
  }
  return false;
}

function deleteRowById_(nama, id) {
  var d = sheetData_(nama);
  for (var i = 0; i < d.rows.length; i++) {
    if (num_(d.rows[i].id) === num_(id)) {
      d.sh.deleteRow(d.rows[i]._row);
      return true;
    }
  }
  return false;
}

function findRow_(nama, kolom, nilai) {
  var d = sheetData_(nama);
  for (var i = 0; i < d.rows.length; i++) {
    if (String(d.rows[i][kolom]) === String(nilai)) return d.rows[i];
  }
  return null;
}

function nextId_(nama) {
  var d = sheetData_(nama);
  var max = 0;
  for (var i = 0; i < d.rows.length; i++) max = Math.max(max, num_(d.rows[i].id));
  return max + 1;
}

function folderArsip_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SESIRAPAT_ARSIP_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* buat ulang */ }
  }
  var it = DriveApp.getFoldersByName(NAMA_ARSIP);
  var folder = it.hasNext() ? it.next() : DriveApp.createFolder(NAMA_ARSIP);
  props.setProperty('SESIRAPAT_ARSIP_ID', folder.getId());
  return folder;
}

function folderTtd_() {
  var root = folderArsip_();
  var it = root.getFoldersByName('Tanda Tangan');
  return it.hasNext() ? it.next() : root.createFolder('Tanda Tangan');
}

// Subfolder tempat segmen audio antrean transkrip latar (Fase 4.11)
// disimpan sementara; berkas segmen dibuang ke sampah begitu job-nya
// selesai agar Drive tidak menumpuk audio mentah.
function folderSegmen_() {
  var root = folderArsip_();
  var it = root.getFoldersByName('Segmen Audio');
  return it.hasNext() ? it.next() : root.createFolder('Segmen Audio');
}

function getPengaturan_(kunci, bawaan) {
  var d = sheetData_('Pengaturan');
  for (var i = 0; i < d.rows.length; i++) {
    if (String(d.rows[i].kunci) === kunci) return str_(d.rows[i].nilai);
  }
  return bawaan || '';
}

function setPengaturan_(kunci, nilai) {
  var d = sheetData_('Pengaturan');
  for (var i = 0; i < d.rows.length; i++) {
    if (String(d.rows[i].kunci) === kunci) {
      d.sh.getRange(d.rows[i]._row, 2).setNumberFormat('@');
      d.sh.getRange(d.rows[i]._row, 2).setValue(nilai);
      return;
    }
  }
  appendRow_('Pengaturan', { kunci: kunci, nilai: nilai });
}

function logStatus_(meetingId, dari, ke, catatan) {
  appendRow_('Log_Status', { id: nextId_('Log_Status'), meetingId: meetingId, dari: dari, ke: ke, waktu: sekarangIso_(), catatan: catatan || '' });
}

// ---------------------------------------------------------------------
// buatDatabase(): membuat SesiRapat_DB + seluruh sheet/header + folder
// SesiRapat_Arsip. Jalankan SEKALI dari editor (atau menu SesiRapat di
// spreadsheet). Aman dijalankan ulang: sheet/header yang sudah ada
// tidak ditimpa, data tidak dihapus.
// ---------------------------------------------------------------------

function buatDatabase() {
  var props = PropertiesService.getScriptProperties();
  var ss = null;
  var idTersimpan = props.getProperty('SESIRAPAT_DB_ID');
  if (idTersimpan) {
    try { ss = SpreadsheetApp.openById(idTersimpan); } catch (e) { ss = null; }
  }
  if (!ss) {
    var files = DriveApp.searchFiles("title = '" + NAMA_DB + "' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false");
    if (files.hasNext()) ss = SpreadsheetApp.openById(files.next().getId());
  }
  if (!ss) ss = SpreadsheetApp.create(NAMA_DB);
  props.setProperty('SESIRAPAT_DB_ID', ss.getId());

  for (var i = 0; i < SHEET_NAMES.length; i++) {
    var nama = SHEET_NAMES[i];
    var sh = ss.getSheetByName(nama);
    if (!sh) sh = ss.insertSheet(nama);
    var headers = HEADERS[nama];
    var barisPertama = sh.getRange(1, 1, 1, headers.length).getValues()[0];
    var kosong = true;
    for (var c = 0; c < headers.length; c++) {
      if (barisPertama[c] !== '' && barisPertama[c] !== null) { kosong = false; break; }
    }
    if (kosong) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      sh.setFrozenRows(1);
    } else {
      // Lengkapi sel header yang masih kosong (kolom baru dari versi
      // paket yang lebih baru, mis. suratUrl / docxUrl) tanpa mengubah
      // header yang sudah ada — aman untuk database lama.
      var berubah = false;
      for (var h = 0; h < headers.length; h++) {
        if (barisPertama[h] === '' || barisPertama[h] === null) {
          barisPertama[h] = headers[h];
          berubah = true;
        }
      }
      if (berubah) sh.getRange(1, 1, 1, headers.length).setValues([barisPertama]);
    }
  }
  var bawaan = ss.getSheetByName('Sheet1');
  if (bawaan && ss.getSheets().length > 1 && bawaan.getLastRow() === 0) {
    ss.deleteSheet(bawaan);
  }

  folderArsip_();
  folderTtd_();
  folderSegmen_();

  // Pemicu waktu transkrip latar (Fase 4.11): coba pasang otomatis;
  // bila gagal (mis. izin belum lengkap), Admin bisa memasangnya dari
  // menu SesiRapat di spreadsheet atau menjalankan pasangPemicuTranskrip
  // dari editor.
  var infoPemicu = '';
  try {
    infoPemicu = pasangPemicuTranskrip_()
      ? ' Pemicu transkrip latar aktif (tiap 1 menit).'
      : '';
  } catch (eP) {
    infoPemicu = ' Pemicu transkrip latar belum terpasang — jalankan pasangPemicuTranskrip() dari editor atau menu SesiRapat di spreadsheet.';
  }

  // Pemicu pengingat Telegram (Fase 5): dicoba pasang otomatis juga;
  // hanya benar-benar mengirim bila kanal Telegram dihidupkan di
  // Pengaturan Web App.
  try {
    if (pasangPemicuPengingat_()) infoPemicu += ' Pemicu pengingat aktif (tiap 1 jam).';
  } catch (eG) {
    infoPemicu += ' Pemicu pengingat belum terpasang — jalankan pasangPemicuPengingat() dari editor atau menu SesiRapat di spreadsheet.';
  }

  var email = '';
  try { email = Session.getEffectiveUser().getEmail() || ''; } catch (e) { email = ''; }
  var pengguna = sheetData_('Pengguna');
  if (pengguna.rows.length === 0 && email) {
    appendRow_('Pengguna', { email: email, nama: '', peran: 'Admin', pin: '' });
  }
  if (!getPengaturan_('toleransi_terlambat', '')) setPengaturan_('toleransi_terlambat', '15');
  if (!getPengaturan_('jendela_presensi', '')) setPengaturan_('jendela_presensi', '30');
  if (!getPengaturan_('pengingat_jam', '')) setPengaturan_('pengingat_jam', '07:00');

  var pesan = 'SesiRapat_DB siap: ' + SHEET_NAMES.length + ' sheet (' + SHEET_NAMES.join(', ') + '). ' +
    'Folder Drive "' + NAMA_ARSIP + '" siap.' + infoPemicu + ' ' +
    (email ? 'Email ' + email + ' terdaftar sebagai Admin pertama bila sheet Pengguna masih kosong. ' : '') +
    'Lanjutkan dengan Deploy sebagai Web App.';
  try { SpreadsheetApp.getUi().alert(pesan); } catch (e) { /* dipanggil dari editor */ }
  return pesan;
}

function onOpen() {
  try {
    SpreadsheetApp.getUi().createMenu('SesiRapat')
      .addItem('Buat / periksa database SesiRapat_DB', 'buatDatabase')
      .addItem('Pasang pemicu transkrip latar', 'pasangPemicuTranskrip')
      .addItem('Pasang pemicu pengingat Telegram', 'pasangPemicuPengingat')
      .addItem('Impor data dari ' + NAMA_BERKAS_IMPOR, 'imporDataDariDrive')
      .addToUi();
  } catch (e) { /* bukan konteks spreadsheet */ }
}

// ---------------------------------------------------------------------
// Login Google + peran (sheet Pengguna)
// ---------------------------------------------------------------------

function penggunaAktif_() {
  var email = '';
  try { email = Session.getActiveUser().getEmail() || ''; } catch (e) { email = ''; }
  if (!email) return { email: '', nama: '', peran: '', terdaftar: false };
  var d = sheetData_('Pengguna');
  for (var i = 0; i < d.rows.length; i++) {
    if (String(d.rows[i].email).toLowerCase() === email.toLowerCase()) {
      return { email: email, nama: str_(d.rows[i].nama) || email, peran: str_(d.rows[i].peran) || 'Pimpinan', terdaftar: true };
    }
  }
  return { email: email, nama: '', peran: '', terdaftar: false };
}

function wajibMasuk_() {
  var u = penggunaAktif_();
  if (!u.terdaftar) {
    throw new Error('Email ' + (u.email || '(tidak terbaca)') + ' belum terdaftar di sheet Pengguna SesiRapat_DB. Minta Admin menambahkan email ini dengan peran yang sesuai.');
  }
  return u;
}

function wajibPeran_(daftarPeran) {
  var u = wajibMasuk_();
  if (daftarPeran.indexOf(u.peran) === -1) {
    throw new Error('Peran ' + u.peran + ' tidak berhak melakukan tindakan ini.');
  }
  return u;
}

// ---------------------------------------------------------------------
// Pintu masuk Web App
// ---------------------------------------------------------------------

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var params = (e && e.parameter) || {};
  if (params.aksi === 'ping') {
    return jsonOut_({ status: 'ok', app: 'SesiRapat', versi: VERSI_PAKET, waktu: sekarangIso_() });
  }
  var t = HtmlService.createTemplateFromFile('Index');
  t.presensiId = params.presensi || '';
  t.presensiKode = params.kode || '';
  t.webAppUrl = '';
  try { t.webAppUrl = ScriptApp.getService().getUrl() || ''; } catch (err) { t.webAppUrl = ''; }
  return t.evaluate()
    .setTitle('SesiRapat')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  var body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { body = {}; }
  if (body.aksi === 'ping') {
    return jsonOut_({ status: 'ok', app: 'SesiRapat', versi: VERSI_PAKET, waktu: sekarangIso_() });
  }
  return jsonOut_({ status: 'error', pesan: 'Aksi tidak dikenal.' });
}

// ---------------------------------------------------------------------
// Serialisasi baris sheet menjadi objek untuk tampilan
// ---------------------------------------------------------------------

function rapatOut_(m) {
  return {
    id: num_(m.id), nama: str_(m.nama), jenis: str_(m.jenis), tanggal: str_(m.tanggal),
    tanggalPanjang: tanggalPanjang_(m.tanggal), jamMulai: str_(m.jamMulai), jamSelesai: str_(m.jamSelesai),
    tempat: str_(m.tempat), pimpinan: str_(m.pimpinan), notulis: str_(m.notulis), agenda: str_(m.agenda),
    nomorUndangan: str_(m.nomorUndangan), status: str_(m.status),
    startedAt: str_(m.startedAt), endedAt: str_(m.endedAt),
    suratUrl: str_(m.suratUrl), suratFileName: str_(m.suratFileName),
    pausedAt: m.pausedAt ? new Date(m.pausedAt).toISOString() : null,
    pauseReason: str_(m.pauseReason), pausedTotalMs: num_(m.pausedTotalMs),
    geofenceAktif: num_(m.geofenceAktif) === 1,
    geofenceLat: m.geofenceLat === '' || m.geofenceLat === null || m.geofenceLat === undefined ? null : num_(m.geofenceLat),
    geofenceLng: m.geofenceLng === '' || m.geofenceLng === null || m.geofenceLng === undefined ? null : num_(m.geofenceLng),
    geofenceRadius: num_(m.geofenceRadius) || 100,
    jendela: jendelaPresensi_(m)
  };
}

function hitungKehadiran_(meetingId) {
  var d = sheetData_('Kehadiran');
  var h = { undangan: 0, hadir: 0, izin: 0, alpa: 0, belum: 0, terlambat: 0 };
  for (var i = 0; i < d.rows.length; i++) {
    var a = d.rows[i];
    if (num_(a.meetingId) !== num_(meetingId)) continue;
    h.undangan++;
    if (a.status === 'Hadir') { h.hadir++; if (num_(a.late) === 1) h.terlambat++; }
    else if (a.status === 'Izin') h.izin++;
    else if (a.status === 'Alpa') h.alpa++;
    else h.belum++;
  }
  return h;
}

function kehadiranOut_(a) {
  return {
    id: num_(a.id), meetingId: num_(a.meetingId), personId: num_(a.personId),
    nama: str_(a.nama), nip: str_(a.nip), jabatan: str_(a.jabatan), unit: str_(a.unit),
    status: str_(a.status), checkinAt: str_(a.checkinAt), jamHadir: jamDariIso_(a.checkinAt),
    late: num_(a.late) === 1, method: str_(a.method), signatureUrl: str_(a.signatureUrl),
    invitedAt: str_(a.invitedAt), tamu: num_(a.tamu) === 1
  };
}

// ---------------------------------------------------------------------
// API halaman pengelola (dipanggil lewat google.script.run)
// ---------------------------------------------------------------------

function apiInfoPengguna() {
  var u = penggunaAktif_();
  return { email: u.email, nama: u.nama, peran: u.peran, terdaftar: u.terdaftar };
}

function apiDaftarRapat() {
  wajibMasuk_();
  var d = sheetData_('Rapat');
  var out = [];
  for (var i = 0; i < d.rows.length; i++) {
    finalisasiAlpa_(d.rows[i]);
    var m = rapatOut_(d.rows[i]);
    m.counts = hitungKehadiran_(m.id);
    out.push(m);
  }
  out.sort(function (a, b) {
    var ka = a.tanggal + ' ' + a.jamMulai;
    var kb = b.tanggal + ' ' + b.jamMulai;
    return ka < kb ? 1 : ka > kb ? -1 : 0;
  });
  return { meetings: out };
}

// Jumlah peserta rapat ini yang undangannya belum tercakup pembagian:
// diundang setelah pembagian terakhir, atau belum pernah ada pembagian
// (baris lama tanpa invitedAt dianggap tercakup oleh pembagian mana pun).
function belumDibagikan_(meetingId) {
  var shares = sheetData_('Pembagian_Undangan').rows;
  var lastShare = '';
  for (var i = 0; i < shares.length; i++) {
    if (num_(shares[i].meetingId) !== num_(meetingId)) continue;
    var ca = str_(shares[i].createdAt);
    if (ca > lastShare) lastShare = ca;
  }
  var kd = sheetData_('Kehadiran').rows;
  var count = 0;
  for (var j = 0; j < kd.length; j++) {
    var a = kd[j];
    if (num_(a.meetingId) !== num_(meetingId)) continue;
    var inv = str_(a.invitedAt);
    if (!inv) { if (!lastShare) count++; }
    else if (!lastShare || inv > lastShare) count++;
  }
  return count;
}

// Data Linimasa versi Google — halaman yang sama dengan versi Muse:
// rapat berlangsung, rapat hari ini, akan datang, undangan belum
// dibagikan, dan ringkasan tindak lanjut yang belum selesai.
function apiBeranda() {
  wajibMasuk_();
  var today = Utilities.formatDate(new Date(), ZONA, 'yyyy-MM-dd');
  var d = sheetData_('Rapat');
  var semua = [];
  for (var i = 0; i < d.rows.length; i++) {
    finalisasiAlpa_(d.rows[i]);
    var m = rapatOut_(d.rows[i]);
    m.counts = hitungKehadiran_(m.id);
    semua.push(m);
  }
  var live = null;
  var hariIni = [];
  var akanDatang = [];
  for (var j = 0; j < semua.length; j++) {
    var r = semua[j];
    if ((r.status === 'Berlangsung' || r.status === 'Dijeda') && !live) live = r;
    if (r.tanggal === today) hariIni.push(r);
    else if (r.tanggal > today) akanDatang.push(r);
  }
  hariIni.sort(function (a, b) { return a.jamMulai < b.jamMulai ? -1 : a.jamMulai > b.jamMulai ? 1 : 0; });
  akanDatang.sort(function (a, b) {
    var ka = a.tanggal + ' ' + a.jamMulai, kb = b.tanggal + ' ' + b.jamMulai;
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });

  var undanganBelum = [];
  for (var k = 0; k < semua.length; k++) {
    var mm = semua[k];
    if (mm.status === 'Selesai') continue;
    var belum = belumDibagikan_(mm.id);
    if (belum > 0) {
      undanganBelum.push({
        meetingId: mm.id, nama: mm.nama, tanggalPanjang: mm.tanggalPanjang,
        jamMulai: mm.jamMulai, belumDibagikan: belum
      });
    }
  }

  var namaRapat = {};
  for (var n = 0; n < semua.length; n++) namaRapat[semua[n].id] = semua[n].nama;
  var fd = sheetData_('Tindak_Lanjut').rows;
  var terbuka = [];
  for (var f = 0; f < fd.length; f++) {
    var fu = fd[f];
    if (str_(fu.status) === 'Selesai') continue;
    var stFu = statusTenggat_(fu, today);
    terbuka.push({
      id: num_(fu.id), meetingId: num_(fu.meetingId),
      meetingNama: namaRapat[num_(fu.meetingId)] || '(rapat terhapus)',
      uraian: str_(fu.uraian), penanggungJawab: str_(fu.penanggungJawab),
      tenggatText: str_(fu.tenggatText), tenggatDate: str_(fu.tenggatDate),
      status: str_(fu.status),
      tenggatStatus: stFu, tenggatLabel: labelTenggat_(stFu)
    });
  }
  terbuka.sort(function (a, b) {
    var ka = a.tenggatDate || '9999', kb = b.tenggatDate || '9999';
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });

  // Fase 5 — pengingat: tonggak rapat hari ini, tindak lanjut yang
  // lewat/mendekati tenggat, rekap rapat selesai terbaru, dan setelan
  // pengingat aktif (untuk notifikasi perangkat di Linimasa).
  var setelan = pengingatSetelan_();
  var pengingatRapat = [];
  if (setelan.rapat) {
    for (var pr = 0; pr < semua.length; pr++) {
      var tg = tonggakRapat_(semua[pr], today);
      if (!tg) continue;
      // Fase 5.1 — rapat hari-H membawa daftar tiga pengingatnya
      // (pagi / 5 jam sebelum / 2 jam sebelum, hanya yang hidup);
      // bila ketiganya mati, rapat tidak muncul di seksi Pengingat.
      var hh = null;
      if (tg.tonggak === 'Hari-H') {
        hh = pengingatHariH_(semua[pr], setelan);
        if (!hh.length) continue;
      }
      pengingatRapat.push({
        meetingId: semua[pr].id, nama: semua[pr].nama,
        tanggalPanjang: semua[pr].tanggalPanjang, jamMulai: semua[pr].jamMulai,
        tempat: semua[pr].tempat, tonggak: tg.tonggak, sisaHari: tg.sisaHari,
        hariH: hh
      });
    }
    pengingatRapat.sort(function (a, b) { return a.sisaHari - b.sisaHari; });
  }
  var pengingatTindak = [];
  if (setelan.tindak) {
    var fd2 = sheetData_('Tindak_Lanjut').rows;
    for (var pt = 0; pt < fd2.length; pt++) {
      var st2 = statusTenggat_(fd2[pt], today);
      if (!st2) continue;
      pengingatTindak.push({
        id: num_(fd2[pt].id), meetingId: num_(fd2[pt].meetingId),
        meetingNama: namaRapat[num_(fd2[pt].meetingId)] || '(rapat terhapus)',
        uraian: str_(fd2[pt].uraian), penanggungJawab: str_(fd2[pt].penanggungJawab),
        tenggatText: str_(fd2[pt].tenggatText), tenggatDate: str_(fd2[pt].tenggatDate),
        tenggatStatus: st2, tenggatLabel: labelTenggat_(st2)
      });
    }
    var rankT = { 'lewat': 0, 'hari-ini': 1, 'h-1': 2, 'h-3': 3 };
    pengingatTindak.sort(function (a, b) {
      var ra = rankT[a.tenggatStatus.jenis], rb = rankT[b.tenggatStatus.jenis];
      if (ra !== rb) return ra - rb;
      return a.tenggatDate < b.tenggatDate ? -1 : a.tenggatDate > b.tenggatDate ? 1 : 0;
    });
  }
  var rekapTerbaru = [];
  if (setelan.rekap) {
    var selesaiList = [];
    for (var rk = 0; rk < d.rows.length; rk++) {
      if (str_(d.rows[rk].status) === 'Selesai') selesaiList.push(d.rows[rk]);
    }
    selesaiList.sort(function (a, b) {
      var ka2 = str_(a.tanggal) + ' ' + str_(a.jamMulai), kb2 = str_(b.tanggal) + ' ' + str_(b.jamMulai);
      return ka2 < kb2 ? 1 : ka2 > kb2 ? -1 : 0;
    });
    for (var rk2 = 0; rk2 < Math.min(3, selesaiList.length); rk2++) {
      rekapTerbaru.push(rekapRapat_(selesaiList[rk2]));
    }
  }

  return {
    versi: VERSI_PAKET,
    tanggalHariIni: today,
    tanggalPanjangHariIni: tanggalPanjang_(today),
    liveMeeting: live,
    rapatHariIni: hariIni,
    rapatAkanDatang: akanDatang.slice(0, 5),
    undanganBelum: undanganBelum,
    tindakTerbuka: terbuka.slice(0, 5),
    jumlahTindakTerbuka: terbuka.length,
    pengingatRapat: pengingatRapat,
    pengingatTindak: pengingatTindak,
    rekapTerbaru: rekapTerbaru,
    pengingatSetelan: {
      rapatAktif: setelan.rapat, tindakAktif: setelan.tindak,
      rekapAktif: setelan.rekap, jam: setelan.jam,
      telegramAktif: setelan.telegramAktif
    },
    semuaRapat: semua
  };
}

// Semua tindak lanjut lintas rapat (halaman Tindak Lanjut global),
// lengkap dengan daftar rapat untuk formulir tambah tugas.
function apiSemuaTindakLanjut() {
  wajibMasuk_();
  var rd = sheetData_('Rapat').rows;
  var namaRapat = {};
  var meetings = [];
  for (var i = 0; i < rd.length; i++) {
    namaRapat[num_(rd[i].id)] = str_(rd[i].nama);
    meetings.push({ id: num_(rd[i].id), nama: str_(rd[i].nama) });
  }
  meetings.sort(function (a, b) { return b.id - a.id; });
  var fd = sheetData_('Tindak_Lanjut').rows;
  var todayTl = hariIni_();
  var items = [];
  for (var j = 0; j < fd.length; j++) {
    var f = fd[j];
    var stTl = statusTenggat_(f, todayTl);
    items.push({
      id: num_(f.id), meetingId: num_(f.meetingId),
      meetingNama: namaRapat[num_(f.meetingId)] || '(rapat terhapus)',
      uraian: str_(f.uraian), penanggungJawab: str_(f.penanggungJawab),
      tenggatText: str_(f.tenggatText), tenggatDate: str_(f.tenggatDate),
      status: str_(f.status), source: str_(f.source),
      tenggatStatus: stTl, tenggatLabel: labelTenggat_(stTl)
    });
  }
  var peringkat = { 'Belum': 0, 'Proses': 1, 'Selesai': 2 };
  var peringkatTenggat = { 'lewat': 0, 'hari-ini': 1, 'h-1': 2, 'h-3': 3 };
  items.sort(function (a, b) {
    var ra = peringkat[a.status] !== undefined ? peringkat[a.status] : 3;
    var rb = peringkat[b.status] !== undefined ? peringkat[b.status] : 3;
    if (ra !== rb) return ra - rb;
    // Fase 5: urgensi tenggat mengambang ke atas dalam status yang sama.
    var ta = a.tenggatStatus ? peringkatTenggat[a.tenggatStatus.jenis] : 4;
    var tb = b.tenggatStatus ? peringkatTenggat[b.tenggatStatus.jenis] : 4;
    if (ta !== tb) return ta - tb;
    var ka = a.tenggatDate || '9999', kb = b.tenggatDate || '9999';
    if (ka !== kb) return ka < kb ? -1 : 1;
    return b.id - a.id;
  });
  return { items: items, meetings: meetings };
}

// Semua dokumen terbit lintas rapat (halaman Arsip) + rekap otomatis
// rapat selesai (Fase 5).
function apiDaftarArsip() {
  wajibMasuk_();
  var rd = sheetData_('Rapat').rows;
  var namaRapat = {};
  for (var i = 0; i < rd.length; i++) namaRapat[num_(rd[i].id)] = str_(rd[i].nama);
  var dd = sheetData_('Dokumen').rows;
  var out = [];
  for (var j = 0; j < dd.length; j++) {
    var dk = dd[j];
    out.push({
      id: num_(dk.id), meetingId: num_(dk.meetingId),
      meetingNama: namaRapat[num_(dk.meetingId)] || '(rapat terhapus)',
      jenis: str_(dk.jenis), nomorRegister: str_(dk.nomorRegister),
      pdfUrl: str_(dk.pdfUrl), docsUrl: str_(dk.docsUrl), createdAt: str_(dk.createdAt),
      docxUrl: str_(dk.docxUrl)
    });
  }
  out.sort(function (a, b) { return b.id - a.id; });
  var rekap = [];
  if (pengingatSetelan_().rekap) {
    var selesaiRows = [];
    for (var k = 0; k < rd.length; k++) {
      if (str_(rd[k].status) === 'Selesai') selesaiRows.push(rd[k]);
    }
    selesaiRows.sort(function (a, b) {
      var ka = str_(a.tanggal) + ' ' + str_(a.jamMulai), kb = str_(b.tanggal) + ' ' + str_(b.jamMulai);
      return ka < kb ? 1 : ka > kb ? -1 : 0;
    });
    for (var r2 = 0; r2 < Math.min(20, selesaiRows.length); r2++) {
      rekap.push(rekapRapat_(selesaiRows[r2]));
    }
  }
  return { documents: out, rekap: rekap };
}

// Daftar template dokumen dari sheet Template (halaman Template).
// Template Studio khusus Admin (Fase 4.11) — peran lain tidak bisa
// membaca daftarnya sama sekali, sejalan dengan halamannya yang tidak
// dimunculkan untuk mereka.
function apiDaftarTemplate() {
  wajibPeran_(['Admin']);
  var td = sheetData_('Template').rows;
  var out = [];
  for (var i = 0; i < td.length; i++) {
    var t = td[i];
    var docsIdT = trim_(str_(t.docsId));
    var ph = [];
    try { ph = JSON.parse(str_(t.placeholders) || '[]'); } catch (e) { ph = []; }
    out.push({
      id: num_(t.id), jenis: str_(t.jenis), nama: str_(t.nama), versi: num_(t.versi),
      docsIdAda: !!docsIdT, fileName: str_(t.fileName),
      docsUrl: docsIdT ? 'https://docs.google.com/document/d/' + docsIdT + '/edit' : '',
      placeholders: ph,
      aktif: num_(t.aktif) === 1
    });
  }
  out.sort(function (a, b) { return a.id - b.id; });
  return { templates: out };
}

// ---------------------------------------------------------------------
// Template Studio versi Google — template adalah Google Docs berkop.
// Pendaftaran memvalidasi placeholder wajib di dalam dokumennya
// (Notulensi: {{NAMA_RAPAT}}, {{PEMBAHASAN}}, {{KEPUTUSAN}}; Presensi:
// {{NAMA_RAPAT}}, {{BARIS_PESERTA}}), sama seperti Template Studio
// versi Muse.
// ---------------------------------------------------------------------

var PLACEHOLDER_WAJIB_ = {
  Notulensi: ['{{NAMA_RAPAT}}', '{{PEMBAHASAN}}', '{{KEPUTUSAN}}'],
  Presensi: ['{{NAMA_RAPAT}}', '{{BARIS_PESERTA}}']
};

function ekstrakDocsId_(teks) {
  var t = trim_(teks || '');
  var marker = '/document/d/';
  var i = t.indexOf(marker);
  if (i >= 0) {
    var sisa = t.slice(i + marker.length);
    var potong = sisa.indexOf('/');
    return potong >= 0 ? sisa.slice(0, potong) : sisa;
  }
  return t;
}

function placeholderDok_(docsId) {
  var doc = DocumentApp.openById(docsId);
  var teks = doc.getBody().getText();
  var hd = doc.getHeader();
  if (hd) teks += ' ' + hd.getText();
  var ft = doc.getFooter();
  if (ft) teks += ' ' + ft.getText();
  var ketemu = {};
  var mulai = 0;
  while (true) {
    var a = teks.indexOf('{{', mulai);
    if (a < 0) break;
    var b = teks.indexOf('}}', a);
    if (b < 0) break;
    ketemu[teks.slice(a, b + 2).toUpperCase()] = true;
    mulai = b + 2;
  }
  var daftar = [];
  for (var k in ketemu) daftar.push(k);
  return daftar;
}

function matikanTemplateLain_(jenis, kecualiId) {
  var td = sheetData_('Template').rows;
  for (var i = 0; i < td.length; i++) {
    if (str_(td[i].jenis) === jenis && num_(td[i].id) !== num_(kecualiId) && num_(td[i].aktif) === 1) {
      updateRowById_('Template', td[i].id, { aktif: 0 });
    }
  }
}

function apiSimpanTemplate(data) {
  wajibPeran_(['Admin']);
  data = data || {};
  var jenis = data.jenis === 'Presensi' ? 'Presensi' : 'Notulensi';
  var nama = trim_(data.nama || '');
  if (!nama) throw new Error('Nama template wajib diisi.');
  var docsId = ekstrakDocsId_(data.docsId || '');
  if (!docsId) throw new Error('ID atau URL Google Docs template wajib diisi.');
  var daftar;
  try {
    daftar = placeholderDok_(docsId);
  } catch (e) {
    throw new Error('Google Docs template tidak bisa dibuka. Periksa ID/URL-nya dan pastikan dokumen dapat diakses oleh akun pemilik deployment.');
  }
  var wajib = PLACEHOLDER_WAJIB_[jenis];
  var kurang = [];
  for (var i = 0; i < wajib.length; i++) {
    if (daftar.indexOf(wajib[i]) === -1) kurang.push(wajib[i]);
  }
  if (kurang.length) {
    throw new Error('Placeholder wajib belum ada di dokumen: ' + kurang.join(', ') + '. Tambahkan dulu di Google Docs template, lalu daftarkan lagi.');
  }
  var aktif = data.aktif ? 1 : 0;
  if (data.id) {
    updateRowById_('Template', data.id, {
      jenis: jenis, nama: nama, docsId: docsId,
      placeholders: JSON.stringify(daftar), aktif: aktif
    });
    if (aktif) matikanTemplateLain_(jenis, num_(data.id));
    return { ok: true, id: num_(data.id), placeholders: daftar };
  }
  var id = nextId_('Template');
  appendRow_('Template', {
    id: id, jenis: jenis, nama: nama, versi: 1, kopLines: '[]',
    placeholders: JSON.stringify(daftar), docsId: docsId, fileName: '',
    aktif: aktif, createdAt: sekarangIso_()
  });
  if (aktif) matikanTemplateLain_(jenis, id);
  return { ok: true, id: id, placeholders: daftar };
}

function apiSetTemplateAktif(id) {
  wajibPeran_(['Admin']);
  var t = findRow_('Template', 'id', id);
  if (!t) throw new Error('Template tidak ditemukan.');
  updateRowById_('Template', id, { aktif: 1 });
  matikanTemplateLain_(str_(t.jenis), num_(id));
  return { ok: true };
}

function apiHapusTemplate(id) {
  wajibPeran_(['Admin']);
  deleteRowById_('Template', id);
  return { ok: true };
}

// Membuat Google Docs contoh berisi kop lembaga + semua placeholder
// (termasuk {{BARIS_PESERTA}} di tabel presensi) di folder arsip, lalu
// mendaftarkannya sebagai template tidak aktif — padanan tombol "Unduh
// template contoh" di versi Muse, dalam bentuk Docs yang bisa langsung
// disunting kopnya.
function apiBuatTemplateContoh(jenis) {
  wajibPeran_(['Admin']);
  jenis = jenis === 'Presensi' ? 'Presensi' : 'Notulensi';
  var doc = DocumentApp.create('Contoh Template ' + jenis + ' SesiRapat');
  var body = doc.getBody();
  body.setFontFamily('Times New Roman');
  var kop = [
    getPengaturan_('lembaga_nama', ''), getPengaturan_('lembaga_unit', ''),
    [getPengaturan_('lembaga_alamat', ''), getPengaturan_('lembaga_telepon', '')].filter(function (s) { return s; }).join(' · ')
  ].filter(function (s) { return s; });
  if (!kop.length) kop = ['NAMA LEMBAGA', 'Unit / Sekretariat', 'Alamat · Telepon'];
  for (var i = 0; i < kop.length; i++) {
    var p = body.appendParagraph(kop[i]);
    p.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    if (i === 0) { p.setFontSize(14); p.setBold(true); }
  }
  body.appendHorizontalRule();
  var judul = body.appendParagraph(jenis === 'Notulensi' ? 'NOTULENSI RAPAT' : 'LEMBAR PRESENSI');
  judul.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  judul.setBold(true);
  body.appendParagraph('Nomor Register: {{NOMOR_REGISTER}}');
  body.appendParagraph('Nama Rapat: {{NAMA_RAPAT}}');
  body.appendParagraph('Jenis: {{JENIS_RAPAT}}');
  body.appendParagraph('Hari/Tanggal: {{HARI}}, {{TANGGAL_RAPAT}}');
  body.appendParagraph('Waktu: {{JAM_MULAI}} – {{JAM_SELESAI}} WIB');
  body.appendParagraph('Tempat: {{TEMPAT}}');
  body.appendParagraph('Pimpinan: {{PIMPINAN_RAPAT}}');
  body.appendParagraph('Notulis: {{NOTULIS}}');
  body.appendParagraph('Agenda: {{AGENDA}}');
  body.appendParagraph('');
  if (jenis === 'Notulensi') {
    body.appendParagraph('Pembahasan').setBold(true);
    body.appendParagraph('{{PEMBAHASAN}}');
    body.appendParagraph('Keputusan').setBold(true);
    body.appendParagraph('{{KEPUTUSAN}}');
    body.appendParagraph('Tindak Lanjut').setBold(true);
    body.appendParagraph('{{TINDAK_LANJUT}}');
    body.appendParagraph('');
    body.appendParagraph('Daftar hadir: {{DAFTAR_HADIR}}');
  } else {
    body.appendParagraph('Hadir {{JUMLAH_HADIR}} dari {{JUMLAH_UNDANGAN}} undangan · Izin {{JUMLAH_IZIN}} · Alpa {{JUMLAH_ALPA}}');
    body.appendParagraph('');
    body.appendTable([
      ['No', 'Nama', 'Jabatan', 'Unit', 'Status', 'Jam Hadir', 'Tanda Tangan'],
      ['{{BARIS_PESERTA}}', '', '', '', '', '', '']
    ]);
  }
  body.appendParagraph('');
  body.appendParagraph('Notulis,');
  body.appendParagraph('');
  body.appendParagraph('');
  body.appendParagraph('{{NOTULIS}}');
  body.appendParagraph('');
  body.appendParagraph('Pimpinan Rapat,');
  body.appendParagraph('');
  body.appendParagraph('');
  body.appendParagraph('{{PIMPINAN_RAPAT}}');
  doc.saveAndClose();
  var file = DriveApp.getFileById(doc.getId());
  file.moveTo(folderArsip_());
  var daftarPh = placeholderDok_(doc.getId());
  var id = nextId_('Template');
  appendRow_('Template', {
    id: id, jenis: jenis, nama: 'Contoh Template ' + jenis + ' (bawaan)', versi: 1,
    kopLines: '[]', placeholders: JSON.stringify(daftarPh), docsId: doc.getId(),
    fileName: '', aktif: 0, createdAt: sekarangIso_()
  });
  return { ok: true, id: id, docsUrl: file.getUrl() };
}

// Ekspor seluruh data sebagai JSON dengan bentuk yang sama seperti
// ekspor versi Muse — dipakai tombol FAB Ekspor di halaman Arsip /
// Template / Pengaturan (khusus Admin).
function apiEksporJson() {
  wajibPeran_(['Admin']);
  function baris(nama) {
    var rows = sheetData_(nama).rows;
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var salin = {};
      for (var k in rows[i]) { if (k !== '_row') salin[k] = rows[i][k]; }
      out.push(salin);
    }
    return out;
  }
  var kelompok = baris('Kelompok');
  var grupId = {};
  for (var g = 0; g < kelompok.length; g++) grupId[str_(kelompok[g].nama)] = num_(kelompok[g].id);
  var pesertaMentah = baris('Peserta');
  var people = [];
  for (var p = 0; p < pesertaMentah.length; p++) {
    var ps = pesertaMentah[p];
    people.push({
      id: num_(ps.id), nama: str_(ps.nama), nip: str_(ps.nip), jabatan: str_(ps.jabatan),
      unit: str_(ps.unit), groupId: grupId[pisahKelompok_(ps.kelompok)[0]] || null,
      groupIds: pisahKelompok_(ps.kelompok).map(function (n) { return grupId[n] || 0; }).filter(function (x) { return x > 0; }),
      kelompok: str_(ps.kelompok), createdAt: str_(ps.createdAt)
    });
  }
  var tplMentah = baris('Template');
  var templates = [];
  for (var t = 0; t < tplMentah.length; t++) {
    var tp = tplMentah[t];
    templates.push({
      id: num_(tp.id), jenis: str_(tp.jenis), nama: str_(tp.nama), versi: num_(tp.versi),
      kopLines: str_(tp.kopLines), placeholders: str_(tp.placeholders), docsId: str_(tp.docsId),
      fileName: str_(tp.fileName), aktif: num_(tp.aktif), createdAt: str_(tp.createdAt)
    });
  }
  var pengMentah = baris('Pengaturan');
  var settings = [];
  for (var s = 0; s < pengMentah.length; s++) {
    // Kunci Gemini adalah kredensial — tidak ikut berkas ekspor.
    if (str_(pengMentah[s].kunci) === 'gemini_api_key') continue;
    settings.push({ key: str_(pengMentah[s].kunci), value: str_(pengMentah[s].nilai) });
  }
  var minMentah = baris('Notulensi');
  var minutes = [];
  for (var mn = 0; mn < minMentah.length; mn++) {
    var mrow = minMentah[mn];
    // Transkrip panjang tersimpan sebagai berkas Drive (Fase 4.10);
    // ekspor menyertakan teks utuhnya agar bisa diimpor ke mana pun.
    minutes.push({
      id: num_(mrow.id), meetingId: num_(mrow.meetingId),
      transcript: transkripNotulen_(mrow),
      pembahasan: str_(mrow.pembahasan), keputusan: str_(mrow.keputusan),
      status: str_(mrow.status), catatanPimpinan: str_(mrow.catatanPimpinan),
      disetujuiOleh: str_(mrow.disetujuiOleh), disetujuiPada: str_(mrow.disetujuiPada),
      updatedAt: str_(mrow.updatedAt)
    });
  }
  var data = {
    app: 'SesiRapat',
    sumber: 'google',
    exportedAt: sekarangIso_(),
    meetings: baris('Rapat'),
    personGroups: kelompok,
    people: people,
    attendance: baris('Kehadiran'),
    minutes: minutes,
    followups: baris('Tindak_Lanjut'),
    templates: templates,
    documents: baris('Dokumen'),
    inviteShares: baris('Pembagian_Undangan'),
    settings: settings
  };
  return { json: JSON.stringify(data, null, 2), exportedAt: data.exportedAt };
}

function apiBuatRapat(data) {
  wajibPeran_(['Admin', 'Notulis']);
  data = data || {};
  if (!trim_(data.nama || '')) throw new Error('Nama rapat wajib diisi.');
  if (!data.tanggal) throw new Error('Tanggal rapat wajib diisi.');
  if (!data.jamMulai) throw new Error('Jam mulai wajib diisi.');
  var id = nextId_('Rapat');
  var secret = hashToken_(String(data.nama) + ':' + String(data.tanggal) + ':' + new Date().getTime() + ':' + Math.random());
  appendRow_('Rapat', {
    id: id, nama: data.nama, jenis: data.jenis || 'Rapat Koordinasi', tanggal: data.tanggal,
    jamMulai: data.jamMulai, jamSelesai: data.jamSelesai || '', tempat: data.tempat || '',
    pimpinan: data.pimpinan || '', notulis: data.notulis || '', agenda: data.agenda || '',
    nomorUndangan: data.nomorUndangan || '', status: 'Terjadwal', secret: secret,
    startedAt: '', endedAt: '', createdAt: sekarangIso_()
  });
  logStatus_(id, '', 'Terjadwal');
  return { id: id };
}

function apiUbahRapat(data) {
  wajibPeran_(['Admin', 'Notulis']);
  data = data || {};
  var m = findRow_('Rapat', 'id', data.id);
  if (!m) throw new Error('Rapat tidak ditemukan.');
  updateRowById_('Rapat', data.id, {
    nama: data.nama, jenis: data.jenis, tanggal: data.tanggal, jamMulai: data.jamMulai,
    jamSelesai: data.jamSelesai || '', tempat: data.tempat || '', pimpinan: data.pimpinan || '',
    notulis: data.notulis || '', agenda: data.agenda || '', nomorUndangan: data.nomorUndangan || ''
  });
  return { ok: true };
}

function apiUbahStatusRapat(id, statusBaru, alasan) {
  wajibPeran_(['Admin', 'Notulis']);
  var m = findRow_('Rapat', 'id', id);
  if (!m) throw new Error('Rapat tidak ditemukan.');
  var dari = str_(m.status);
  var patch = { status: statusBaru };
  var catatan = '';
  if (statusBaru === 'Berlangsung' && !m.startedAt) patch.startedAt = sekarangIso_();
  // Jeda rapat: hanya dari Berlangsung. Durasi berhenti (pausedAt dibuka)
  // dan presensi ditolak server selama Dijeda.
  if (statusBaru === 'Dijeda') {
    if (dari !== 'Berlangsung') throw new Error('Hanya rapat yang sedang berlangsung yang bisa dijeda.');
    patch.pausedAt = sekarangIso_();
    patch.pauseReason = String(alasan || 'Istirahat').slice(0, 120);
    catatan = patch.pauseReason;
  }
  // Lanjutkan dari jeda: lipat jeda terbuka ke pausedTotalMs.
  if (statusBaru === 'Berlangsung' && dari === 'Dijeda') {
    var lamaMs = m.pausedAt ? Math.max(0, new Date().getTime() - new Date(m.pausedAt).getTime()) : 0;
    patch.pausedTotalMs = num_(m.pausedTotalMs) + lamaMs;
    patch.pausedAt = '';
    catatan = 'Jeda ' + Math.max(1, Math.round(lamaMs / 60000)) + ' menit (' + (str_(m.pauseReason) || 'Istirahat') + ')';
    patch.pauseReason = '';
  }
  if (statusBaru === 'Selesai') {
    patch.endedAt = sekarangIso_();
    if (dari === 'Dijeda' && m.pausedAt) {
      patch.pausedTotalMs = num_(m.pausedTotalMs) + Math.max(0, new Date().getTime() - new Date(m.pausedAt).getTime());
      patch.pausedAt = '';
      patch.pauseReason = '';
    }
    // Fase 4.6: sisa undangan TIDAK langsung menjadi Alpa di sini —
    // jendela presensi masih punya masa tenggang (endedAt + toleransi)
    // untuk yang terlambat; finalisasiAlpa_ menandainya Alpa setelah
    // jendela benar-benar ditutup (sama seperti versi Muse).
  }
  updateRowById_('Rapat', id, patch);
  logStatus_(id, dari, statusBaru, catatan);
  return { ok: true };
}

// Hapus rapat beserta seluruh baris terkaitnya (kehadiran, notulensi,
// tindak lanjut, dokumen, pembagian undangan, jejak status).
function hapusBarisRapat_(nama, meetingId) {
  var d = sheetData_(nama);
  var target = [];
  for (var i = 0; i < d.rows.length; i++) {
    if (num_(d.rows[i].meetingId) === num_(meetingId)) target.push(d.rows[i]._row);
  }
  target.sort(function (a, b) { return b - a; });
  for (var j = 0; j < target.length; j++) d.sh.deleteRow(target[j]);
}

function apiHapusRapat(id) {
  wajibPeran_(['Admin', 'Notulis']);
  var m = findRow_('Rapat', 'id', id);
  if (!m) throw new Error('Rapat tidak ditemukan.');
  hapusBarisRapat_('Kehadiran', id);
  hapusBarisRapat_('Notulensi', id);
  hapusBarisRapat_('Tindak_Lanjut', id);
  hapusBarisRapat_('Dokumen', id);
  hapusBarisRapat_('Pembagian_Undangan', id);
  hapusBarisRapat_('Log_Status', id);
  deleteRowById_('Rapat', id);
  return { ok: true };
}

// ---------------------------------------------------------------------
// Surat undangan resmi (PDF) — berkasnya disimpan di folder Drive
// SesiRapat_Arsip, URL + nama berkasnya tercatat di sheet Rapat.
// ---------------------------------------------------------------------

function apiUploadSuratUndangan(meetingId, namaBerkas, base64) {
  wajibPeran_(['Admin', 'Notulis']);
  var m = findRow_('Rapat', 'id', meetingId);
  if (!m) throw new Error('Rapat tidak ditemukan.');
  if (!base64) throw new Error('Berkas surat undangan kosong.');
  if (String(base64).length > 14000000) throw new Error('Ukuran surat undangan melebihi batas 10 MB.');
  var bytes = Utilities.base64Decode(base64);
  if (bytes.length > 10 * 1024 * 1024) throw new Error('Ukuran surat undangan melebihi batas 10 MB.');
  var awal = '';
  for (var i = 0; i < Math.min(4, bytes.length); i++) awal += String.fromCharCode(bytes[i] & 0xff);
  if (awal !== '%PDF') throw new Error('Berkas harus berupa PDF.');
  var nama = trim_(namaBerkas || '') || 'surat-undangan.pdf';
  var blob = Utilities.newBlob(bytes, 'application/pdf', nama);
  var file = folderArsip_().createFile(blob);
  updateRowById_('Rapat', meetingId, { suratUrl: file.getUrl(), suratFileName: nama });
  return { ok: true, suratUrl: file.getUrl(), suratFileName: nama };
}

function apiHapusSuratUndangan(meetingId) {
  wajibPeran_(['Admin', 'Notulis']);
  var m = findRow_('Rapat', 'id', meetingId);
  if (!m) throw new Error('Rapat tidak ditemukan.');
  updateRowById_('Rapat', meetingId, { suratUrl: '', suratFileName: '' });
  return { ok: true };
}

function apiDetailRapat(id) {
  wajibMasuk_();
  var m = findRow_('Rapat', 'id', id);
  if (!m) throw new Error('Rapat tidak ditemukan.');
  finalisasiAlpa_(m);
  var meeting = rapatOut_(m);
  meeting.counts = hitungKehadiran_(id);

  var kd = sheetData_('Kehadiran');
  var kehadiran = [];
  for (var i = 0; i < kd.rows.length; i++) {
    if (num_(kd.rows[i].meetingId) === num_(id)) kehadiran.push(kehadiranOut_(kd.rows[i]));
  }
  kehadiran.sort(function (a, b) { return a.nama < b.nama ? -1 : a.nama > b.nama ? 1 : 0; });

  var nd = sheetData_('Notulensi');
  var notulen = null;
  for (var j = 0; j < nd.rows.length; j++) {
    if (num_(nd.rows[j].meetingId) === num_(id)) {
      var n = nd.rows[j];
      notulen = {
        id: num_(n.id), transcript: transkripNotulen_(n), pembahasan: str_(n.pembahasan),
        keputusan: str_(n.keputusan), status: str_(n.status), catatanPimpinan: str_(n.catatanPimpinan),
        disetujuiOleh: str_(n.disetujuiOleh), disetujuiPada: str_(n.disetujuiPada)
      };
    }
  }

  var fd = sheetData_('Tindak_Lanjut');
  var tindakLanjut = [];
  for (var k = 0; k < fd.rows.length; k++) {
    if (num_(fd.rows[k].meetingId) === num_(id)) {
      var f = fd.rows[k];
      tindakLanjut.push({
        id: num_(f.id), uraian: str_(f.uraian), penanggungJawab: str_(f.penanggungJawab),
        tenggatText: str_(f.tenggatText), tenggatDate: str_(f.tenggatDate), status: str_(f.status)
      });
    }
  }

  var dd = sheetData_('Dokumen');
  var dokumen = [];
  for (var x = 0; x < dd.rows.length; x++) {
    if (num_(dd.rows[x].meetingId) === num_(id)) {
      var dk = dd.rows[x];
      dokumen.push({
        id: num_(dk.id), jenis: str_(dk.jenis), nomorRegister: str_(dk.nomorRegister),
        pdfUrl: str_(dk.pdfUrl), docsUrl: str_(dk.docsUrl), createdAt: str_(dk.createdAt),
        docxUrl: str_(dk.docxUrl)
      });
    }
  }
  dokumen.sort(function (a, b) { return b.id - a.id; });

  // Jejak status rapat (sheet Log_Status) — terbaru di atas.
  var ld = sheetData_('Log_Status').rows;
  var statusLog = [];
  for (var s = 0; s < ld.length; s++) {
    if (num_(ld[s].meetingId) === num_(id)) {
      statusLog.push({ dari: str_(ld[s].dari), ke: str_(ld[s].ke), waktu: str_(ld[s].waktu), catatan: str_(ld[s].catatan) });
    }
  }
  statusLog.reverse();
  if (statusLog.length > 20) statusLog = statusLog.slice(0, 20);

  // Riwayat pembagian undangan rapat ini (sheet Pembagian_Undangan).
  var sd = sheetData_('Pembagian_Undangan').rows;
  var shares = [];
  for (var t = 0; t < sd.length; t++) {
    if (num_(sd[t].meetingId) === num_(id)) {
      shares.push({
        kanal: str_(sd[t].kanal), jumlahPenerima: num_(sd[t].jumlahPenerima),
        createdAt: str_(sd[t].createdAt)
      });
    }
  }
  shares.reverse();
  meeting.belumDibagikan = belumDibagikan_(id);

  var url = '';
  try { url = ScriptApp.getService().getUrl() || ''; } catch (e) { url = ''; }
  return {
    meeting: meeting, kehadiran: kehadiran, notulen: notulen,
    tindakLanjut: tindakLanjut, dokumen: dokumen,
    statusLog: statusLog, shares: shares,
    // Fase 4.6 — tautan STABIL: hanya berisi ID rapat, TANPA kode 60
    // detik, jadi tidak kedaluwarsa walau dibagikan ke grup WhatsApp/
    // Telegram jauh sebelum rapat. Halaman publik mengambil kode
    // terbaru otomatis dari server (apiPublikKodePresensi) tepat
    // sebelum mencatat kehadiran, dan mencoba sekali lagi sendiri
    // bila kode kedaluwarsa di tengah pengisian.
    tautanPresensi: url ? url + '?presensi=' + meeting.id : '',
    // Fase 4.10 — panel Unggah Rekaman Audio di Notulen Studio memberi
    // peringatan dini bila kunci Gemini belum diisi (paritas versi Muse).
    geminiTerhubung: !!getPengaturan_('gemini_api_key', ''),
    // Fase 5 — rekap otomatis: terisi hanya bila rapat sudah Selesai.
    rekap: str_(m.status) === 'Selesai' ? rekapRapat_(m) : null
  };
}

// Menyimpan setelan geofence presensi per rapat (Fase 5, opsional —
// mati bawaan): titik lokasi rapat + radius dalam meter.
function apiSimpanGeofence(meetingId, data) {
  wajibPeran_(['Admin', 'Notulis']);
  data = data || {};
  var m = findRow_('Rapat', 'id', meetingId);
  if (!m) throw new Error('Rapat tidak ditemukan.');
  var aktif = data.aktif ? 1 : 0;
  var lat = data.lat === null || data.lat === undefined || data.lat === '' ? '' : Number(data.lat);
  var lng = data.lng === null || data.lng === undefined || data.lng === '' ? '' : Number(data.lng);
  if (aktif && (lat === '' || lng === '' || isNaN(lat) || isNaN(lng))) {
    throw new Error('Titik lokasi rapat belum diisi — ambil lokasi perangkat ini dulu sebelum mengaktifkan geofence.');
  }
  if (lat !== '' && (isNaN(lat) || lat < -90 || lat > 90)) throw new Error('Latitude tidak valid.');
  if (lng !== '' && (isNaN(lng) || lng < -180 || lng > 180)) throw new Error('Longitude tidak valid.');
  var radius = Math.round(Number(data.radiusM) || 100);
  if (radius < 10) radius = 10;
  if (radius > 5000) radius = 5000;
  updateRowById_('Rapat', meetingId, {
    geofenceAktif: aktif, geofenceLat: lat, geofenceLng: lng, geofenceRadius: radius
  });
  return { ok: true };
}

// ---------------------------------------------------------------------
// Presensi: undangan, token, check-in
// ---------------------------------------------------------------------

function apiDaftarPesertaBuku() {
  // Buku Peserta adalah halaman kelola (Admin/Notulis); Pimpinan tidak
  // membacanya (Fase 4.11).
  wajibPeran_(['Admin', 'Notulis']);
  var d = sheetData_('Peserta');
  var out = [];
  for (var i = 0; i < d.rows.length; i++) {
    var p = d.rows[i];
    out.push({ id: num_(p.id), nama: str_(p.nama), nip: str_(p.nip), jabatan: str_(p.jabatan), unit: str_(p.unit), kelompok: str_(p.kelompok), kelompokList: pisahKelompok_(p.kelompok) });
  }
  out.sort(function (a, b) { return a.nama < b.nama ? -1 : a.nama > b.nama ? 1 : 0; });
  var gd = sheetData_('Kelompok');
  var kelompok = [];
  for (var j = 0; j < gd.rows.length; j++) kelompok.push(str_(gd.rows[j].nama));
  return { people: out, kelompok: kelompok };
}

function undangSatu_(meetingId, person) {
  var kd = sheetData_('Kehadiran');
  for (var i = 0; i < kd.rows.length; i++) {
    var a = kd.rows[i];
    if (num_(a.meetingId) !== num_(meetingId)) continue;
    if (person.personId && num_(a.personId) === num_(person.personId)) return false;
    if (!person.personId && str_(a.nama).toLowerCase() === String(person.nama).toLowerCase()) return false;
  }
  appendRow_('Kehadiran', {
    id: nextId_('Kehadiran'), meetingId: meetingId, personId: person.personId || '',
    nama: person.nama, nip: person.nip || '', jabatan: person.jabatan || '', unit: person.unit || '',
    status: 'Undangan', invitedAt: sekarangIso_(), checkinAt: '', late: 0, method: '', signatureUrl: ''
  });
  return true;
}

function apiUndangPeserta(meetingId, personId) {
  wajibPeran_(['Admin', 'Notulis']);
  var p = findRow_('Peserta', 'id', personId);
  if (!p) throw new Error('Peserta tidak ditemukan di Buku Peserta.');
  var ok = undangSatu_(meetingId, { personId: num_(p.id), nama: str_(p.nama), nip: str_(p.nip), jabatan: str_(p.jabatan), unit: str_(p.unit) });
  return { ok: true, ditambahkan: ok };
}

function apiUndangKelompok(meetingId, namaKelompok) {
  wajibPeran_(['Admin', 'Notulis']);
  var d = sheetData_('Peserta');
  var n = 0;
  for (var i = 0; i < d.rows.length; i++) {
    var p = d.rows[i];
    if (pisahKelompok_(p.kelompok).indexOf(String(namaKelompok)) === -1) continue;
    if (undangSatu_(meetingId, { personId: num_(p.id), nama: str_(p.nama), nip: str_(p.nip), jabatan: str_(p.jabatan), unit: str_(p.unit) })) n++;
  }
  return { ok: true, ditambahkan: n };
}

function apiTambahUndanganManual(meetingId, data) {
  wajibPeran_(['Admin', 'Notulis']);
  data = data || {};
  if (!trim_(data.nama || '')) throw new Error('Nama peserta wajib diisi.');
  var ok = undangSatu_(meetingId, { personId: 0, nama: data.nama, nip: data.nip || '', jabatan: data.jabatan || '', unit: data.unit || '' });
  return { ok: true, ditambahkan: ok };
}

function apiHapusUndangan(attendanceId) {
  wajibPeran_(['Admin', 'Notulis']);
  deleteRowById_('Kehadiran', attendanceId);
  return { ok: true };
}

function apiTokenPresensi(meetingId) {
  wajibMasuk_();
  var m = findRow_('Rapat', 'id', meetingId);
  if (!m) throw new Error('Rapat tidak ditemukan.');
  var w = windowSekarang_();
  var sisa = 60 - (Math.floor(new Date().getTime() / 1000) % 60);
  var url = '';
  try { url = ScriptApp.getService().getUrl() || ''; } catch (e) { url = ''; }
  return {
    token: tokenPresensi_(str_(m.secret), w), secondsLeft: sisa, windowIndex: w,
    // Tenggat nyata akhir jendela token ini (ms epoch): klien menghitung
    // mundur dari tenggat ini, bukan dari secondsLeft hasil polling,
    // supaya hitungan turun mulus satu per satu (Fase 4.9).
    expiresAt: (w + 1) * 60000,
    tautan: url ? url + '?presensi=' + meetingId : '',
    dijeda: str_(m.status) === 'Dijeda', pauseReason: str_(m.pauseReason),
    status: str_(m.status), jendela: jendelaPresensi_(m)
  };
}

function simpanTandaTangan_(dataUrl, namaBerkas) {
  var parts = String(dataUrl || '').split(',');
  if (parts.length < 2 || !parts[1]) return '';
  var bytes = Utilities.base64Decode(parts[1]);
  var blob = Utilities.newBlob(bytes, 'image/png', namaBerkas);
  var file = folderTtd_().createFile(blob);
  return file.getUrl();
}

function catatHadir_(att, metode, signatureUrl) {
  if (att.status === 'Hadir') {
    throw new Error('Peserta ini sudah tercatat hadir (anti-ganda).');
  }
  var m = findRow_('Rapat', 'id', att.meetingId);
  if (!m) throw new Error('Rapat tidak ditemukan.');
  if (str_(m.status) === 'Dijeda') {
    throw new Error('Presensi sedang dijeda' + (str_(m.pauseReason) ? ' (' + str_(m.pauseReason) + ')' : '') + '. Kehadiran baru diterima lagi setelah rapat dilanjutkan.');
  }
  if (jendelaPresensi_(m).status === 'ditutup') {
    throw new Error('Presensi sudah ditutup — rapat telah diakhiri dan masa tenggang presensinya sudah lewat.');
  }
  var tol = parseInt(getPengaturan_('toleransi_terlambat', '15'), 10);
  if (isNaN(tol)) tol = 15;
  var mulai = parseTanggalJam_(m.tanggal, m.jamMulai);
  var now = new Date();
  var late = now.getTime() > mulai.getTime() + tol * 60000 ? 1 : 0;
  updateRowById_('Kehadiran', att.id, {
    status: 'Hadir', checkinAt: now.toISOString(), late: late, method: metode,
    signatureUrl: signatureUrl || str_(att.signatureUrl) || ''
  });
  return { late: late === 1, checkinAt: now.toISOString() };
}

function apiPresensiKios(attendanceId, tandaTanganDataUrl) {
  wajibPeran_(['Admin', 'Notulis']);
  var att = findRow_('Kehadiran', 'id', attendanceId);
  if (!att) throw new Error('Baris kehadiran tidak ditemukan.');
  var url = '';
  if (tandaTanganDataUrl) {
    url = simpanTandaTangan_(tandaTanganDataUrl, 'ttd-' + attendanceId + '-' + new Date().getTime() + '.png');
  }
  var hasil = catatHadir_(att, 'Kios', url);
  return { ok: true, late: hasil.late, checkinAt: hasil.checkinAt };
}

function apiSetStatusKehadiran(attendanceId, status) {
  wajibPeran_(['Admin', 'Notulis']);
  if (['Izin', 'Alpa', 'Undangan'].indexOf(status) === -1) throw new Error('Status tidak dikenal.');
  updateRowById_('Kehadiran', attendanceId, { status: status, checkinAt: '', late: 0, method: '' });
  return { ok: true };
}

function apiCatatPembagianUndangan(meetingId, kanal) {
  wajibPeran_(['Admin', 'Notulis']);
  var counts = hitungKehadiran_(meetingId);
  appendRow_('Pembagian_Undangan', {
    id: nextId_('Pembagian_Undangan'), meetingId: meetingId, kanal: kanal || 'Bagikan',
    jumlahPenerima: counts.undangan, createdAt: sekarangIso_()
  });
  return { ok: true };
}

// ---------------------------------------------------------------------
// Halaman presensi publik (peserta, lintas perangkat, tanpa login)
// ---------------------------------------------------------------------

function apiPublikInfoRapat(meetingId) {
  var m = findRow_('Rapat', 'id', meetingId);
  if (!m) throw new Error('Rapat tidak ditemukan. Periksa kembali tautan presensinya.');
  finalisasiAlpa_(m);
  var kd = sheetData_('Kehadiran');
  var peserta = [];
  for (var i = 0; i < kd.rows.length; i++) {
    var a = kd.rows[i];
    if (num_(a.meetingId) !== num_(meetingId)) continue;
    peserta.push({
      id: num_(a.id), nama: str_(a.nama), jabatan: str_(a.jabatan),
      unit: str_(a.unit), status: str_(a.status)
    });
  }
  peserta.sort(function (x, y) { return x.nama < y.nama ? -1 : x.nama > y.nama ? 1 : 0; });
  return {
    meeting: {
      id: num_(m.id), nama: str_(m.nama), jenis: str_(m.jenis),
      tanggalPanjang: tanggalPanjang_(m.tanggal), jamMulai: str_(m.jamMulai),
      jamSelesai: str_(m.jamSelesai), tempat: str_(m.tempat),
      pimpinan: str_(m.pimpinan), status: str_(m.status)
    },
    jendela: jendelaPresensi_(m),
    // Fase 5 — info geofence untuk halaman peserta: koordinat titik
    // rapat memang perlu dikirim agar HP peserta bisa menampilkan
    // jaraknya sendiri; penegakan jarak tetap di server.
    geofence: {
      aktif: num_(m.geofenceAktif) === 1 && m.geofenceLat !== '' && m.geofenceLat !== null,
      lat: m.geofenceLat === '' || m.geofenceLat === null ? null : num_(m.geofenceLat),
      lng: m.geofenceLng === '' || m.geofenceLng === null ? null : num_(m.geofenceLng),
      radius: num_(m.geofenceRadius) || 100
    },
    peserta: peserta
  };
}

// Halaman presensi publik meminta kode terbaru lewat sini tepat sebelum
// mencatat kehadiran (Fase 4.6): tautan yang dibagikan tidak lagi
// membawa kode, jadi kode tidak pernah kedaluwarsa di tangan peserta —
// halaman mengambilnya otomatis dari server, dan bila kode berubah di
// tengah pengisian, halaman meminta kode baru dan mencoba sekali lagi
// sendiri tanpa menampilkan error ke peserta.
function apiPublikKodePresensi(meetingId) {
  var m = findRow_('Rapat', 'id', meetingId);
  if (!m) throw new Error('Rapat tidak ditemukan. Periksa kembali tautan presensinya.');
  return {
    token: tokenPresensi_(str_(m.secret), windowSekarang_()),
    jendela: jendelaPresensi_(m),
    status: str_(m.status)
  };
}

function presensiMandiri(payload) {
  payload = payload || {};
  var m = findRow_('Rapat', 'id', payload.meetingId);
  if (!m) throw new Error('Rapat tidak ditemukan.');
  // Gerbang jendela presensi diperiksa SEBELUM kode, supaya peserta
  // mendapat pesan yang benar (belum dibuka / dijeda / sudah ditutup),
  // bukan pesan kode. Kode sendiri diambil halaman dari server tepat
  // sebelum kirim (apiPublikKodePresensi) dan dicoba ulang sekali
  // secara otomatis bila kedaluwarsa.
  var jw = jendelaPresensi_(m);
  if (jw.status === 'ditutup') {
    throw new Error('Presensi sudah ditutup — rapat telah diakhiri dan masa tenggang presensinya sudah lewat.');
  }
  if (jw.status === 'dijeda') {
    throw new Error('Presensi sedang dijeda' + (str_(m.pauseReason) ? ' (' + str_(m.pauseReason) + ')' : '') + '. Kehadiran baru diterima lagi setelah rapat dilanjutkan.');
  }
  if (jw.status === 'segera') {
    throw new Error('Presensi belum dibuka — presensi dibuka pukul ' + jw.buka + ' WIB (30 menit sebelum rapat mulai).');
  }
  // Geofence presensi (Fase 5, opsional — hanya bila diaktifkan
  // penyelenggara untuk rapat ini): lokasi HP peserta wajib ada dan
  // berada di dalam radius titik rapat; di luar area ditolak dengan
  // pesan jarak. Bila geofence mati, tidak ada pemeriksaan lokasi.
  if (num_(m.geofenceAktif) === 1 && m.geofenceLat !== '' && m.geofenceLat !== null && m.geofenceLng !== '' && m.geofenceLng !== null) {
    var gLat = Number(payload.lat), gLng = Number(payload.lng);
    if (payload.lat === undefined || payload.lat === null || isNaN(gLat) || isNaN(gLng)) {
      throw new Error('Rapat ini memakai geofence presensi: aktifkan lokasi (GPS) di HP kamu, ketuk Periksa Lokasi, lalu catat kehadiran lagi.');
    }
    var jarakG = jarakMeter_(gLat, gLng, num_(m.geofenceLat), num_(m.geofenceLng));
    var radiusG = num_(m.geofenceRadius) || 100;
    if (jarakG > radiusG) {
      throw new Error('Di luar area rapat: HP kamu terdeteksi ±' + jarakG + ' m dari titik lokasi rapat, sedangkan radius geofence ' + radiusG + ' m. Presensi hanya diterima di dalam area rapat.');
    }
  }
  if (!tokenValid_(str_(m.secret), payload.kode)) {
    throw new Error('Kode presensi tidak valid atau sudah kedaluwarsa. Lihat kode terbaru di layar Ruang Rapat.');
  }
  // Mode Tamu: peserta yang tidak ada di daftar undangan. Bila namanya
  // ternyata cocok dengan undangan yang belum hadir, baris undangan itu
  // yang dipakai (bukan baris tamu baru); anti-ganda tetap berlaku.
  if (payload.tamu) {
    var nama = trim_(payload.nama || '');
    if (!nama) throw new Error('Isi dulu namamu.');
    var nip = trim_(payload.nip || '');
    var kd = sheetData_('Kehadiran').rows;
    var cocok = null;
    for (var i = 0; i < kd.length; i++) {
      if (num_(kd[i].meetingId) !== num_(m.id)) continue;
      var samaNama = str_(kd[i].nama).toLowerCase() === nama.toLowerCase();
      var samaNip = nip !== '' && str_(kd[i].nip) !== '' && str_(kd[i].nip) === nip;
      if (str_(kd[i].status) === 'Hadir' && (samaNama || samaNip)) {
        throw new Error('Nama/NIP ini sudah tercatat hadir (anti-ganda).');
      }
      if (!cocok && str_(kd[i].status) === 'Undangan' && samaNama) cocok = kd[i];
    }
    var attT = cocok;
    var jadiTamu = false;
    if (!attT) {
      var nid = nextId_('Kehadiran');
      appendRow_('Kehadiran', {
        id: nid, meetingId: num_(m.id), personId: '', nama: nama, nip: nip,
        jabatan: trim_(payload.jabatan || ''), unit: trim_(payload.unit || ''),
        status: 'Undangan', invitedAt: '', checkinAt: '', late: 0, method: '',
        signatureUrl: '', tamu: 1
      });
      attT = findRow_('Kehadiran', 'id', nid);
      jadiTamu = true;
    }
    var urlT = '';
    if (payload.tandaTangan) {
      urlT = simpanTandaTangan_(payload.tandaTangan, 'ttd-tamu-' + attT.id + '-' + new Date().getTime() + '.png');
    }
    var hasilT = catatHadir_(attT, 'Tautan', urlT);
    return { ok: true, nama: str_(attT.nama), late: hasilT.late, checkinAt: hasilT.checkinAt, tamu: jadiTamu };
  }
  var att = findRow_('Kehadiran', 'id', payload.attendanceId);
  if (!att || num_(att.meetingId) !== num_(m.id)) {
    throw new Error('Nama kamu tidak ada di daftar undangan rapat ini. Hubungi penyelenggara.');
  }
  var url = '';
  if (payload.tandaTangan) {
    url = simpanTandaTangan_(payload.tandaTangan, 'ttd-publik-' + payload.attendanceId + '-' + new Date().getTime() + '.png');
  }
  var hasil = catatHadir_(att, 'Tautan', url);
  return { ok: true, nama: str_(att.nama), late: hasil.late, checkinAt: hasil.checkinAt, tamu: false };
}

// Presensi Tamu oleh penyelenggara (Fase 5.3) — pasangan kartu
// "Presensi Tamu / Peserta Baru" di seksi Presensi pengelola,
// semantik sama dengan guestCheckIn versi Muse: peran Admin/
// Notulis; ditolak saat rapat Dijeda atau jendela presensi sudah
// ditutup (catatHadir_ memeriksa ulang keduanya); anti-ganda
// nama/NIP terhadap baris yang sudah Hadir; nama/NIP yang cocok
// dengan undangan yang belum hadir memakai baris undangan itu
// (bukan baris tamu baru); selain itu baris Kehadiran baru
// berlabel tamu dibuat lalu langsung dihadirkan. Metode dicatat
// 'Tamu' seperti versi Muse, dan cap Terlambat dihitung
// catatHadir_ dari jam mulai + toleransi seperti jalur lain.
function apiPresensiTamu(meetingId, data) {
  wajibPeran_(['Admin', 'Notulis']);
  data = data || {};
  var m = findRow_('Rapat', 'id', meetingId);
  if (!m) throw new Error('Rapat tidak ditemukan.');
  if (str_(m.status) === 'Dijeda') {
    throw new Error('Presensi sedang dijeda' + (str_(m.pauseReason) ? ' (' + str_(m.pauseReason) + ')' : '') + ' — presensi dibuka lagi setelah rapat dilanjutkan.');
  }
  if (jendelaPresensi_(m).status === 'ditutup') {
    throw new Error('Presensi sudah ditutup — rapat telah diakhiri dan masa tenggang presensinya sudah lewat.');
  }
  var nama = trim_(data.nama || '');
  if (!nama) throw new Error('Isi dulu nama tamunya.');
  var nip = trim_(data.nip || '');
  var kd = sheetData_('Kehadiran').rows;
  var cocok = null;
  for (var i = 0; i < kd.length; i++) {
    if (num_(kd[i].meetingId) !== num_(m.id)) continue;
    var samaNama = str_(kd[i].nama).toLowerCase() === nama.toLowerCase();
    var samaNip = nip !== '' && str_(kd[i].nip) !== '' && str_(kd[i].nip) === nip;
    if (str_(kd[i].status) === 'Hadir' && (samaNama || samaNip)) {
      throw new Error('Nama/NIP ini sudah tercatat hadir (anti-ganda).');
    }
    if (!cocok && str_(kd[i].status) === 'Undangan' && (samaNama || samaNip)) cocok = kd[i];
  }
  var attT = cocok;
  var jadiTamu = false;
  if (!attT) {
    var nid = nextId_('Kehadiran');
    appendRow_('Kehadiran', {
      id: nid, meetingId: num_(m.id), personId: '', nama: nama, nip: nip,
      jabatan: trim_(data.jabatan || ''), unit: trim_(data.unit || ''),
      status: 'Undangan', invitedAt: '', checkinAt: '', late: 0, method: '',
      signatureUrl: '', tamu: 1
    });
    attT = findRow_('Kehadiran', 'id', nid);
    jadiTamu = true;
  }
  var urlT = '';
  if (data.tandaTangan) {
    urlT = simpanTandaTangan_(data.tandaTangan, 'ttd-tamu-kelola-' + attT.id + '-' + new Date().getTime() + '.png');
  }
  var hasil = catatHadir_(attT, 'Tamu', urlT);
  return { ok: true, nama: str_(attT.nama), late: hasil.late, checkinAt: hasil.checkinAt, tamu: jadiTamu };
}

// Pengelola menyimpan tamu (dari presensi publik/kios) ke Buku Peserta:
// baris Peserta dibuat (duplikat NIP/nama dilewati) dan baris Kehadiran
// ditautkan ke peserta itu.
function apiSimpanTamuKeBuku(attendanceId) {
  wajibPeran_(['Admin', 'Notulis']);
  var att = findRow_('Kehadiran', 'id', attendanceId);
  if (!att) throw new Error('Baris kehadiran tidak ditemukan.');
  if (num_(att.personId)) return { ok: true, personId: num_(att.personId), sudahAda: true };
  var pd = sheetData_('Peserta').rows;
  for (var i = 0; i < pd.length; i++) {
    var samaNip = str_(att.nip) !== '' && str_(pd[i].nip) === str_(att.nip);
    var samaNama = str_(att.nip) === '' && str_(pd[i].nama).toLowerCase() === str_(att.nama).toLowerCase();
    if (samaNip || samaNama) {
      updateRowById_('Kehadiran', att.id, { personId: num_(pd[i].id) });
      return { ok: true, personId: num_(pd[i].id), sudahAda: true };
    }
  }
  var pid = nextId_('Peserta');
  appendRow_('Peserta', {
    id: pid, nama: str_(att.nama), nip: str_(att.nip), jabatan: str_(att.jabatan),
    unit: str_(att.unit), kelompok: ''
  });
  updateRowById_('Kehadiran', att.id, { personId: pid });
  return { ok: true, personId: pid, sudahAda: false };
}

// ---------------------------------------------------------------------
// Notulen & tindak lanjut
// ---------------------------------------------------------------------

function notulenRow_(meetingId) {
  var d = sheetData_('Notulensi');
  for (var i = 0; i < d.rows.length; i++) {
    if (num_(d.rows[i].meetingId) === num_(meetingId)) return d.rows[i];
  }
  return null;
}

// Batas aman isi satu sel Google Sheets adalah 50.000 karakter,
// sedangkan transkrip rapat 2–3 jam bisa mencapai ±150.000 karakter.
// Transkrip yang lebih panjang dari batas aman disimpan sebagai
// berkas teks di folder Drive SesiRapat_Arsip; sel transcript
// dikosongkan dan ID berkasnya dicatat di kolom transkripFileId.
// Semua pembaca transkrip wajib lewat transkripNotulen_ agar utuh.
var BATAS_SEL_TRANSKRIP = 49000;

function transkripNotulen_(row) {
  if (!row) return '';
  var fid = str_(row.transkripFileId);
  if (fid) {
    try {
      return DriveApp.getFileById(fid).getBlob().getDataAsString('UTF-8');
    } catch (e) {
      return str_(row.transcript);
    }
  }
  return str_(row.transcript);
}

// Menyiapkan nilai {transcript, transkripFileId} untuk disimpan:
// pendek → langsung di sel; panjang → berkas Drive baru (berkas lama
// dibuang ke sampah agar tidak menumpuk).
function siapkanTranskrip_(meetingId, rowLama, teks) {
  teks = teks || '';
  var fidLama = rowLama ? str_(rowLama.transkripFileId) : '';
  if (teks.length <= BATAS_SEL_TRANSKRIP) {
    if (fidLama) {
      try { DriveApp.getFileById(fidLama).setTrashed(true); } catch (e) { /* abaikan */ }
    }
    return { transcript: teks, transkripFileId: '' };
  }
  var berkas = folderArsip_().createFile(
    'Transkrip Rapat ' + meetingId + '.txt', teks, MimeType.PLAIN_TEXT);
  if (fidLama) {
    try { DriveApp.getFileById(fidLama).setTrashed(true); } catch (e) { /* abaikan */ }
  }
  return { transcript: '', transkripFileId: berkas.getId() };
}

function apiSimpanNotulen(meetingId, data) {
  wajibPeran_(['Admin', 'Notulis']);
  data = data || {};
  var ada = notulenRow_(meetingId);
  var tr = siapkanTranskrip_(meetingId, ada, data.transcript || '');
  if (ada) {
    updateRowById_('Notulensi', ada.id, {
      transcript: tr.transcript, transkripFileId: tr.transkripFileId,
      pembahasan: data.pembahasan || '',
      keputusan: data.keputusan || '', updatedAt: sekarangIso_()
    });
  } else {
    appendRow_('Notulensi', {
      id: nextId_('Notulensi'), meetingId: meetingId, transcript: tr.transcript,
      transkripFileId: tr.transkripFileId,
      pembahasan: data.pembahasan || '', keputusan: data.keputusan || '', status: 'Draf',
      catatanPimpinan: '', disetujuiOleh: '', disetujuiPada: '', updatedAt: sekarangIso_()
    });
  }
  // Tindak lanjut hasil susunan AI ikut disimpan sebagai tugas pelacak
  // (source 'notulen'), dilewati bila uraian yang sama sudah ada di rapat
  // ini — sama seperti alur versi Muse.
  var tlBaru = 0;
  var daftarTl = data.tindakLanjut || [];
  if (daftarTl.length) {
    var fd = sheetData_('Tindak_Lanjut').rows;
    var sudahAda = {};
    for (var i = 0; i < fd.length; i++) {
      if (num_(fd[i].meetingId) === num_(meetingId)) sudahAda[str_(fd[i].uraian).toLowerCase()] = true;
    }
    for (var j = 0; j < daftarTl.length; j++) {
      var t = daftarTl[j] || {};
      var uraian = trim_(t.uraian || '');
      if (!uraian || sudahAda[uraian.toLowerCase()]) continue;
      sudahAda[uraian.toLowerCase()] = true;
      appendRow_('Tindak_Lanjut', {
        id: nextId_('Tindak_Lanjut'), meetingId: meetingId, uraian: uraian,
        penanggungJawab: t.penanggungJawab || '', tenggatText: t.tenggatText || t.tenggat || '',
        tenggatDate: t.tenggatDate || '', status: 'Belum', source: 'notulen',
        createdAt: sekarangIso_(), doneAt: ''
      });
      tlBaru++;
    }
  }
  return { ok: true, tindakLanjutBaru: tlBaru };
}

// Susun notulen dengan AI (Gemini) — padanan fitur versi Muse: transkrip
// dirapikan menjadi Pembahasan / Keputusan / Tindak Lanjut. Memakai kunci
// Gemini milik pengguna dari sheet Pengaturan (kunci: gemini_api_key);
// hasilnya draf yang tetap bisa disunting sebelum disimpan.
function apiSusunNotulenAi(meetingId) {
  wajibPeran_(['Admin', 'Notulis']);
  var kunci = getPengaturan_('gemini_api_key', '');
  if (!kunci) {
    throw new Error('Kunci Gemini belum diisi. Admin mengisinya dulu di Pengaturan agar penyusunan AI aktif.');
  }
  var n = notulenRow_(meetingId);
  var transkrip = n ? trim_(transkripNotulen_(n)) : '';
  if (!transkrip) {
    throw new Error('Transkrip masih kosong — unggah rekaman audio, rekam dikte, atau tempel transkrip dulu, simpan, lalu susun dengan AI.');
  }
  var prompt = 'Kamu menyusun notulen rapat berbahasa Indonesia dari transkrip berikut. Ekstrak dengan setia, jangan mengarang isi yang tidak ada di transkrip: (1) pembahasan: poin-poin bahasan, satu poin per baris; (2) keputusan: keputusan yang diambil, satu per baris; (3) tindak_lanjut: daftar tugas, masing-masing dengan uraian, penanggung_jawab (kosongkan bila tidak disebut), dan tenggat (teks apa adanya, kosongkan bila tidak disebut). Jawab HANYA dengan JSON valid berbentuk {"pembahasan": "...", "keputusan": "...", "tindak_lanjut": [{"uraian": "...", "penanggung_jawab": "...", "tenggat": "..."}]}; pembahasan dan keputusan berupa teks multi-baris dengan poin dipisahkan karakter newline.\n\nTRANSKRIP:\n' + transkrip;
  var modelUrutan = ['gemini-3.8-flash', 'gemini-3.5-flash-lite'];
  var teks = '';
  var galat = '';
  for (var i = 0; i < modelUrutan.length && !teks; i++) {
    try {
      var resp = UrlFetchApp.fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/' + modelUrutan[i] + ':generateContent',
        {
          method: 'post', contentType: 'application/json', muteHttpExceptions: true,
          headers: { 'x-goog-api-key': kunci },
          payload: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
          })
        }
      );
      if (resp.getResponseCode() === 200) {
        var body = JSON.parse(resp.getContentText());
        var cand = body.candidates && body.candidates[0];
        var parts = cand && cand.content && cand.content.parts;
        if (parts && parts[0] && parts[0].text) teks = parts[0].text;
        else galat = 'jawaban Gemini kosong';
      } else {
        galat = 'Gemini menjawab HTTP ' + resp.getResponseCode();
      }
    } catch (e) {
      galat = String(e && e.message ? e.message : e);
    }
  }
  if (!teks) {
    throw new Error('Penyusunan AI gagal' + (galat ? ' (' + galat + ')' : '') + '. Periksa kunci Gemini di Pengaturan, lalu coba lagi.');
  }
  var bersih = trim_(teks);
  var awal = bersih.indexOf('{');
  var akhir = bersih.lastIndexOf('}');
  if (awal >= 0 && akhir > awal) bersih = bersih.slice(awal, akhir + 1);
  var hasil;
  try { hasil = JSON.parse(bersih); } catch (e2) {
    throw new Error('Jawaban AI tidak bisa dibaca sebagai data notulen. Coba susun lagi.');
  }
  var tl = [];
  var daftar = hasil.tindak_lanjut || hasil.tindakLanjut || [];
  for (var j = 0; j < daftar.length; j++) {
    var item = daftar[j] || {};
    var uraianTl = trim_(item.uraian || '');
    if (!uraianTl) continue;
    tl.push({
      uraian: uraianTl,
      penanggungJawab: trim_(item.penanggung_jawab || item.penanggungJawab || ''),
      tenggat: trim_(item.tenggat || '')
    });
  }
  return {
    pembahasan: str_(hasil.pembahasan || ''),
    keputusan: str_(hasil.keputusan || ''),
    tindakLanjut: tl
  };
}

// Transkrip satu segmen rekaman audio yang diunggah dari Notulen
// Studio (Fase 4.10 — jalur utama transkrip versi Google karena mic
// browser terblokir iframe Web App). Sejak Fase 4.11 pemanggilannya
// lewat antrean latar (lihat blok antrean di bawah); fungsi ini tetap
// ada sebagai jalur langsung satu segmen.

// Mengirim SATU segmen audio ke Gemini (inline_data) memakai kunci
// pengguna dan mengembalikan teks Bahasa Indonesia segmen itu.
// Dipakai pekerja antrean latar (prosesAntreanTranskrip) dan jalur
// langsung apiTranskripSegmenAudio.
function geminiTranskripSegmen_(kunci, dataBase64, mimeType, indeks, total) {
  var prompt = 'Transkripsikan audio ini menjadi teks Bahasa Indonesia persis seperti yang diucapkan (verbatim). Ini segmen ke-' + (num_(indeks) + 1) + ' dari ' + num_(total) + ' dari satu rekaman rapat yang berkesinambungan, jadi langsung mulai dari isi ucapannya tanpa pengantar. Jangan meringkas, jangan menambahkan komentar atau penjelasan. Bila ada bagian yang tidak terdengar jelas, tulis [tidak jelas]. Tulis hanya hasil transkripnya.';
  var modelUrutan = ['gemini-3.8-flash', 'gemini-3.5-flash-lite'];
  var teks = '';
  var galat = '';
  for (var i = 0; i < modelUrutan.length && !teks; i++) {
    try {
      var resp = UrlFetchApp.fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/' + modelUrutan[i] + ':generateContent',
        {
          method: 'post', contentType: 'application/json', muteHttpExceptions: true,
          headers: { 'x-goog-api-key': kunci },
          payload: JSON.stringify({
            contents: [{ parts: [
              { inline_data: { mime_type: mimeType, data: dataBase64 } },
              { text: prompt }
            ] }],
            generationConfig: { temperature: 0.1 }
          })
        }
      );
      if (resp.getResponseCode() === 200) {
        var body = JSON.parse(resp.getContentText());
        var cand = body.candidates && body.candidates[0];
        var parts = cand && cand.content && cand.content.parts;
        if (parts && parts.length) {
          var gab = '';
          for (var p = 0; p < parts.length; p++) gab += (parts[p].text || '');
          teks = trim_(gab);
          if (!teks) galat = 'jawaban Gemini kosong';
        } else {
          galat = 'jawaban Gemini kosong';
        }
      } else {
        galat = 'Gemini menjawab HTTP ' + resp.getResponseCode();
      }
    } catch (e) {
      galat = String(e && e.message ? e.message : e);
    }
  }
  if (!teks) {
    throw new Error('Transkrip segmen ' + (num_(indeks) + 1) + ' gagal' + (galat ? ' (' + galat + ')' : '') + '. Periksa kunci Gemini di Pengaturan, lalu lanjutkan dari segmen ini.');
  }
  return teks;
}

function apiTranskripSegmenAudio(meetingId, dataBase64, mimeType, indeks, total) {
  wajibPeran_(['Admin', 'Notulis']);
  var kunci = getPengaturan_('gemini_api_key', '');
  if (!kunci) {
    throw new Error('Kunci Gemini belum diisi. Admin mengisinya dulu di Pengaturan agar transkrip rekaman audio aktif.');
  }
  var mimeSah = ['audio/mp4', 'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/aac'];
  if (mimeSah.indexOf(mimeType) === -1) {
    throw new Error('Format audio segmen tidak didukung: ' + mimeType);
  }
  if (!dataBase64 || String(dataBase64).length > 12000000) {
    throw new Error('Segmen audio terlalu besar. Pecah rekaman menjadi segmen yang lebih kecil.');
  }
  var m = findRow_('Rapat', 'id', meetingId);
  if (!m) throw new Error('Rapat tidak ditemukan.');
  return { text: geminiTranskripSegmen_(kunci, dataBase64, mimeType, indeks, total) };
}

// ---------------------------------------------------------------------
// Antrean transkrip LATAR (Fase 4.11) — padanan pekerja latar versi
// Muse. Alurnya: klien memecah rekaman di peramban, membuat job
// (apiBuatJobTranskrip), mengunggah tiap segmen sebagai berkas Drive
// di subfolder "Segmen Audio" (apiUnggahSegmenTranskrip), lalu pemicu
// waktu tiap 1 menit (pasangPemicuTranskrip) menjalankan
// prosesAntreanTranskrip yang mentranskrip segmen demi segmen dan
// menggabungkannya ke transkrip notulen. Pengguna boleh menutup tab
// dan mematikan layar; progres dibaca lewat apiStatusJobTranskrip dan
// proses yang terputus dilanjutkan dari segmen terakhir
// (apiLanjutkanJobTranskrip).
// ---------------------------------------------------------------------

function jobTranskripRow_(jobId) {
  return findRow_('Antrean_Transkrip', 'id', jobId);
}

function segmenJob_(jobId) {
  var d = sheetData_('Segmen_Transkrip').rows;
  var out = [];
  for (var i = 0; i < d.length; i++) {
    if (num_(d[i].jobId) === num_(jobId)) out.push(d[i]);
  }
  out.sort(function (a, b) { return num_(a.indeks) - num_(b.indeks); });
  return out;
}

function hitungSegmenSelesai_(jobId) {
  var segs = segmenJob_(jobId);
  var n = 0;
  for (var i = 0; i < segs.length; i++) if (str_(segs[i].status) === 'Selesai') n++;
  return n;
}

// Merangkai ulang transkrip notulen dari awalan (transkrip yang
// sudah ada saat job dibuat, disimpan sebagai berkas Drive karena
// bisa panjang) + teks segmen yang sudah selesai (berurutan), lalu
// menyimpannya lewat siapkanTranskrip_ (transkrip panjang menjadi
// berkas Drive). Awalan dipertahankan agar teks dikte/ketikan yang
// sudah ada tidak hilang tertimpa hasil transkrip rekaman.
function terapkanTranskripJob_(job) {
  var segs = segmenJob_(job.id);
  var bagian = [];
  var pfid = str_(job.prefixFileId);
  if (pfid) {
    try {
      var awalan = trim_(DriveApp.getFileById(pfid).getBlob().getDataAsString('UTF-8'));
      if (awalan) bagian.push(awalan);
    } catch (e) { /* awalan hilang — lanjut dengan segmen saja */ }
  }
  for (var i = 0; i < segs.length; i++) {
    if (str_(segs[i].status) === 'Selesai' && trim_(str_(segs[i].teks))) {
      bagian.push(trim_(str_(segs[i].teks)));
    }
  }
  var teks = bagian.join('\n\n');
  var ada = notulenRow_(job.meetingId);
  var tr = siapkanTranskrip_(job.meetingId, ada, teks);
  if (ada) {
    updateRowById_('Notulensi', ada.id, {
      transcript: tr.transcript, transkripFileId: tr.transkripFileId,
      updatedAt: sekarangIso_()
    });
  } else {
    appendRow_('Notulensi', {
      id: nextId_('Notulensi'), meetingId: job.meetingId,
      transcript: tr.transcript, transkripFileId: tr.transkripFileId,
      pembahasan: '', keputusan: '', status: 'Draf', catatanPimpinan: '',
      disetujuiOleh: '', disetujuiPada: '', updatedAt: sekarangIso_()
    });
  }
}

function sampahAudioJob_(jobId) {
  var segs = segmenJob_(jobId);
  for (var i = 0; i < segs.length; i++) {
    var fid = str_(segs[i].fileId);
    if (fid) {
      try { DriveApp.getFileById(fid).setTrashed(true); } catch (e) { /* abaikan */ }
      updateRowById_('Segmen_Transkrip', segs[i].id, { fileId: '' });
    }
  }
}

function statusJobPublik_(job) {
  return {
    id: num_(job.id), meetingId: num_(job.meetingId),
    namaFile: str_(job.namaFile), status: str_(job.status),
    totalSegmen: num_(job.totalSegmen),
    segmenSelesai: hitungSegmenSelesai_(job.id),
    pesanError: str_(job.pesanError),
    diubahPada: str_(job.diubahPada)
  };
}

function apiBuatJobTranskrip(meetingId, namaFile, totalSegmen) {
  wajibPeran_(['Admin', 'Notulis']);
  var kunci = getPengaturan_('gemini_api_key', '');
  if (!kunci) {
    throw new Error('Kunci Gemini belum diisi. Admin mengisinya dulu di Pengaturan agar transkrip rekaman audio aktif.');
  }
  var m = findRow_('Rapat', 'id', meetingId);
  if (!m) throw new Error('Rapat tidak ditemukan.');
  var total = num_(totalSegmen);
  if (total < 1 || total > 200) throw new Error('Jumlah segmen rekaman tidak wajar.');
  // Job aktif lama untuk rapat yang sama digantikan: audio segmennya
  // dibuang dan baris segmennya dihapus agar antrean bersih.
  var lama = sheetData_('Antrean_Transkrip').rows;
  for (var i = 0; i < lama.length; i++) {
    var st = str_(lama[i].status);
    if (num_(lama[i].meetingId) === num_(meetingId) && (st === 'Mengantre' || st === 'Berjalan')) {
      sampahAudioJob_(lama[i].id);
      var pfidLama = str_(lama[i].prefixFileId);
      if (pfidLama) {
        try { DriveApp.getFileById(pfidLama).setTrashed(true); } catch (e) { /* abaikan */ }
      }
      var sgLama = segmenJob_(lama[i].id);
      for (var s = 0; s < sgLama.length; s++) deleteRowById_('Segmen_Transkrip', sgLama[s].id);
      updateRowById_('Antrean_Transkrip', lama[i].id, {
        status: 'Gagal', pesanError: 'Digantikan oleh unggahan rekaman yang lebih baru.',
        diubahPada: sekarangIso_()
      });
    }
  }
  var id = nextId_('Antrean_Transkrip');
  // Transkrip yang sudah ada menjadi awalan hasil akhir — disimpan
  // sebagai berkas teks Drive karena bisa melebihi batas sel.
  var prefixFileId = '';
  var nAda = notulenRow_(meetingId);
  var teksAwal = nAda ? trim_(transkripNotulen_(nAda)) : '';
  if (teksAwal) {
    var berkasAwalan = folderArsip_().createFile(
      'Awalan Transkrip Rapat ' + meetingId + ' Job ' + id + '.txt', teksAwal, MimeType.PLAIN_TEXT);
    prefixFileId = berkasAwalan.getId();
  }
  appendRow_('Antrean_Transkrip', {
    id: id, meetingId: meetingId, namaFile: namaFile || '', status: 'Mengantre',
    totalSegmen: total, segmenSelesai: 0, pesanError: '',
    dibuatPada: sekarangIso_(), diubahPada: sekarangIso_(), prefixFileId: prefixFileId
  });
  // Pastikan pemicu waktu terpasang (sekali pasang untuk selamanya).
  try { pasangPemicuTranskrip_(); } catch (e) { /* Admin bisa memasang manual */ }
  return { jobId: id };
}

function apiUnggahSegmenTranskrip(jobId, indeks, mimeType, dataBase64) {
  wajibPeran_(['Admin', 'Notulis']);
  var job = jobTranskripRow_(jobId);
  if (!job) throw new Error('Antrean transkrip tidak ditemukan.');
  var mimeSah = ['audio/mp4', 'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/aac'];
  if (mimeSah.indexOf(mimeType) === -1) {
    throw new Error('Format audio segmen tidak didukung: ' + mimeType);
  }
  if (!dataBase64 || String(dataBase64).length > 12000000) {
    throw new Error('Segmen audio terlalu besar. Pecah rekaman menjadi segmen yang lebih kecil.');
  }
  var idx = num_(indeks);
  var ekstensi = mimeType === 'audio/wav' ? 'wav' : mimeType === 'audio/ogg' ? 'ogg' : mimeType === 'audio/webm' ? 'webm' : mimeType === 'audio/aac' ? 'aac' : mimeType === 'audio/mp4' ? 'm4a' : 'mp3';
  var blob = Utilities.newBlob(Utilities.base64Decode(dataBase64), mimeType, 'job' + num_(jobId) + '-segmen-' + (idx + 1) + '.' + ekstensi);
  var berkas = folderSegmen_().createFile(blob);
  var segs = segmenJob_(jobId);
  var ada = null;
  for (var i = 0; i < segs.length; i++) if (num_(segs[i].indeks) === idx) ada = segs[i];
  if (ada) {
    var fidLama = str_(ada.fileId);
    if (fidLama) {
      try { DriveApp.getFileById(fidLama).setTrashed(true); } catch (e) { /* abaikan */ }
    }
    updateRowById_('Segmen_Transkrip', ada.id, {
      fileId: berkas.getId(), mimeType: mimeType, status: 'Menunggu', teks: '', pesanError: ''
    });
  } else {
    appendRow_('Segmen_Transkrip', {
      id: nextId_('Segmen_Transkrip'), jobId: num_(jobId), indeks: idx,
      fileId: berkas.getId(), mimeType: mimeType, status: 'Menunggu', teks: '', pesanError: ''
    });
  }
  return { ok: true };
}

function apiStatusJobTranskrip(meetingId) {
  wajibMasuk_();
  var d = sheetData_('Antrean_Transkrip').rows;
  var terbaru = null;
  for (var i = 0; i < d.length; i++) {
    if (num_(d[i].meetingId) === num_(meetingId)) {
      if (!terbaru || num_(d[i].id) > num_(terbaru.id)) terbaru = d[i];
    }
  }
  if (!terbaru) return { job: null };
  return { job: statusJobPublik_(terbaru) };
}

function apiLanjutkanJobTranskrip(jobId) {
  wajibPeran_(['Admin', 'Notulis']);
  var job = jobTranskripRow_(jobId);
  if (!job) throw new Error('Antrean transkrip tidak ditemukan.');
  var segs = segmenJob_(jobId);
  for (var i = 0; i < segs.length; i++) {
    var st = str_(segs[i].status);
    if (st === 'Gagal' || st === 'Proses') {
      var fid = str_(segs[i].fileId);
      var ada = false;
      if (fid) {
        try { DriveApp.getFileById(fid); ada = true; } catch (e) { ada = false; }
      }
      if (!ada) {
        throw new Error('Berkas audio segmen ' + (num_(segs[i].indeks) + 1) + ' sudah tidak ada di Drive. Unggah ulang rekamannya dari awal.');
      }
      updateRowById_('Segmen_Transkrip', segs[i].id, { status: 'Menunggu', pesanError: '' });
    }
  }
  updateRowById_('Antrean_Transkrip', jobId, {
    status: 'Mengantre', pesanError: '', diubahPada: sekarangIso_()
  });
  try { pasangPemicuTranskrip_(); } catch (e) { /* abaikan */ }
  return { ok: true };
}

// Pekerja antrean — dijalankan pemicu waktu tiap 1 menit. Mengambil
// job aktif tertua, lalu mentranskrip segmen Menunggu satu per satu
// sampai anggaran waktu hampir habis (batas eksekusi Apps Script
// 6 menit); sisanya dilanjutkan pemicu berikutnya. Satu segmen gagal
// menghentikan job dengan status Gagal + pesan jelas agar bisa
// dilanjutkan dari segmen itu.
function prosesAntreanTranskrip() {
  var kunciLock = LockService.getScriptLock();
  if (!kunciLock.tryLock(30000)) return;
  try {
    var kunci = getPengaturan_('gemini_api_key', '');
    if (!kunci) return;
    var batas = new Date().getTime() + 4.5 * 60 * 1000;
    var antrean = sheetData_('Antrean_Transkrip').rows;
    var job = null;
    for (var i = 0; i < antrean.length; i++) {
      var stA = str_(antrean[i].status);
      if (stA === 'Mengantre' || stA === 'Berjalan') { job = antrean[i]; break; }
    }
    if (!job) return;
    updateRowById_('Antrean_Transkrip', job.id, { status: 'Berjalan', diubahPada: sekarangIso_() });
    while (new Date().getTime() < batas) {
      var segs = segmenJob_(job.id);
      var target = null;
      for (var s = 0; s < segs.length; s++) {
        if (str_(segs[s].status) === 'Menunggu') { target = segs[s]; break; }
      }
      if (!target) break;
      updateRowById_('Segmen_Transkrip', target.id, { status: 'Proses' });
      try {
        var blobSeg = DriveApp.getFileById(str_(target.fileId)).getBlob();
        var b64 = Utilities.base64Encode(blobSeg.getBytes());
        var teksSeg = geminiTranskripSegmen_(kunci, b64, str_(target.mimeType), num_(target.indeks), num_(job.totalSegmen));
        updateRowById_('Segmen_Transkrip', target.id, { status: 'Selesai', teks: teksSeg, pesanError: '' });
        terapkanTranskripJob_(job);
        updateRowById_('Antrean_Transkrip', job.id, {
          segmenSelesai: hitungSegmenSelesai_(job.id), diubahPada: sekarangIso_()
        });
      } catch (eSeg) {
        var pesanSeg = String(eSeg && eSeg.message ? eSeg.message : eSeg);
        updateRowById_('Segmen_Transkrip', target.id, { status: 'Gagal', pesanError: pesanSeg });
        updateRowById_('Antrean_Transkrip', job.id, {
          status: 'Gagal', pesanError: pesanSeg, diubahPada: sekarangIso_()
        });
        return;
      }
    }
    var sisa = segmenJob_(job.id);
    var belum = 0;
    var gagalAda = false;
    for (var u = 0; u < sisa.length; u++) {
      var stu = str_(sisa[u].status);
      if (stu === 'Menunggu' || stu === 'Proses') belum++;
      if (stu === 'Gagal') gagalAda = true;
    }
    var terunggah = sisa.length;
    if (!gagalAda && terunggah >= num_(job.totalSegmen) && belum === 0) {
      terapkanTranskripJob_(job);
      updateRowById_('Antrean_Transkrip', job.id, {
        status: 'Selesai', segmenSelesai: hitungSegmenSelesai_(job.id),
        pesanError: '', diubahPada: sekarangIso_()
      });
      sampahAudioJob_(job.id);
      // Awalan sudah menyatu ke transkrip akhir — berkasnya dibuang.
      var pfidAkhir = str_(job.prefixFileId);
      if (pfidAkhir) {
        try { DriveApp.getFileById(pfidAkhir).setTrashed(true); } catch (e) { /* abaikan */ }
        updateRowById_('Antrean_Transkrip', job.id, { prefixFileId: '' });
      }
    }
  } finally {
    kunciLock.releaseLock();
  }
}

// Memasang pemicu waktu tiap 1 menit untuk prosesAntreanTranskrip
// (idempoten: pemicu lama untuk fungsi yang sama dibuang dulu).
// Mengembalikan true bila pemicu aktif sesudahnya.
function pasangPemicuTranskrip_() {
  var pemicu = ScriptApp.getProjectTriggers();
  for (var i = 0; i < pemicu.length; i++) {
    if (pemicu[i].getHandlerFunction() === 'prosesAntreanTranskrip') return true;
  }
  ScriptApp.newTrigger('prosesAntreanTranskrip').timeBased().everyMinutes(1).create();
  return true;
}

// Jalankan SEKALI dari editor Apps Script (atau menu SesiRapat di
// spreadsheet) untuk mengaktifkan transkrip latar belakang: pemicu
// waktu yang mengerjakan antrean segmen audio di server Google.
function pasangPemicuTranskrip() {
  var pesan = pasangPemicuTranskrip_()
    ? 'Pemicu transkrip latar aktif: prosesAntreanTranskrip berjalan tiap 1 menit.'
    : 'Pemicu transkrip latar sudah terpasang sebelumnya.';
  try { SpreadsheetApp.getUi().alert(pesan); } catch (e) { /* dipanggil dari editor */ }
  return pesan;
}

// Menghapus satu dokumen terbit (Notulensi / Lembar Presensi): baris
// sheet Dokumen dibuang dan berkas Drive terkaitnya (PDF, Docs, DOCX
// di folder SesiRapat_Arsip) dipindah ke sampah. ID berkas diambil
// dari URL tersimpan (pola /d/<id>/ atau ?id=<id>).
function apiHapusDokumen(dokumenId) {
  wajibPeran_(['Admin', 'Notulis']);
  var doc = findRow_('Dokumen', 'id', dokumenId);
  if (!doc) throw new Error('Dokumen tidak ditemukan (mungkin sudah dihapus).');
  var urls = [str_(doc.pdfUrl), str_(doc.docsUrl), str_(doc.docxUrl)];
  var sudah = {};
  for (var i = 0; i < urls.length; i++) {
    var cocok = urls[i].match(/\/d\/([A-Za-z0-9_-]+)/) || urls[i].match(/[?&]id=([A-Za-z0-9_-]+)/);
    if (cocok && !sudah[cocok[1]]) {
      sudah[cocok[1]] = true;
      try { DriveApp.getFileById(cocok[1]).setTrashed(true); } catch (e) { /* berkas mungkin sudah dibuang manual */ }
    }
  }
  deleteRowById_('Dokumen', dokumenId);
  logStatus_(num_(doc.meetingId), 'Dokumen', 'Dihapus',
    'Dokumen ' + str_(doc.jenis) + ' ' + str_(doc.nomorRegister) + ' dihapus beserta berkas Drive-nya.');
  return { ok: true };
}

function apiSetStatusNotulen(meetingId, statusBaru, catatan) {
  var ada = notulenRow_(meetingId);
  if (!ada) throw new Error('Notulen belum dibuat untuk rapat ini.');
  if (statusBaru === 'Menunggu Persetujuan') {
    wajibPeran_(['Admin', 'Notulis']);
    updateRowById_('Notulensi', ada.id, { status: statusBaru, updatedAt: sekarangIso_() });
  } else if (statusBaru === 'Disetujui' || statusBaru === 'Dikembalikan') {
    var u = wajibPeran_(['Admin', 'Pimpinan']);
    var patch = { status: statusBaru, catatanPimpinan: catatan || '', updatedAt: sekarangIso_() };
    if (statusBaru === 'Disetujui') {
      patch.disetujuiOleh = u.nama;
      patch.disetujuiPada = sekarangIso_();
    }
    updateRowById_('Notulensi', ada.id, patch);
  } else if (statusBaru === 'Draf') {
    wajibPeran_(['Admin', 'Notulis']);
    updateRowById_('Notulensi', ada.id, { status: 'Draf', updatedAt: sekarangIso_() });
  } else {
    throw new Error('Status notulen tidak dikenal.');
  }
  return { ok: true };
}

function apiTambahTindakLanjut(meetingId, data) {
  wajibPeran_(['Admin', 'Notulis']);
  data = data || {};
  if (!trim_(data.uraian || '')) throw new Error('Uraian tindak lanjut wajib diisi.');
  var id = nextId_('Tindak_Lanjut');
  appendRow_('Tindak_Lanjut', {
    id: id, meetingId: meetingId, uraian: data.uraian, penanggungJawab: data.penanggungJawab || '',
    tenggatText: data.tenggatText || '', tenggatDate: data.tenggatDate || '', status: 'Belum',
    source: 'manual', createdAt: sekarangIso_(), doneAt: ''
  });
  return { ok: true, id: id };
}

function apiUbahTindakLanjut(id, data) {
  wajibPeran_(['Admin', 'Notulis']);
  data = data || {};
  if (!trim_(data.uraian || '')) throw new Error('Uraian tindak lanjut wajib diisi.');
  var ok = updateRowById_('Tindak_Lanjut', id, {
    uraian: data.uraian, penanggungJawab: data.penanggungJawab || '',
    tenggatText: data.tenggatText || '', tenggatDate: data.tenggatDate || ''
  });
  if (!ok) throw new Error('Tindak lanjut tidak ditemukan.');
  return { ok: true };
}

function apiUbahStatusTindakLanjut(id, status) {
  wajibPeran_(['Admin', 'Notulis']);
  if (['Belum', 'Proses', 'Selesai'].indexOf(status) === -1) throw new Error('Status tidak dikenal.');
  updateRowById_('Tindak_Lanjut', id, { status: status, doneAt: status === 'Selesai' ? sekarangIso_() : '' });
  return { ok: true };
}

function apiHapusTindakLanjut(id) {
  wajibPeran_(['Admin', 'Notulis']);
  deleteRowById_('Tindak_Lanjut', id);
  return { ok: true };
}

// ---------------------------------------------------------------------
// Buku Peserta & kelompok
// ---------------------------------------------------------------------

// Multi-kelompok: kolom Kelompok di sheet Peserta menyimpan daftar nama
// kelompok dipisah '; ' (mis. "Dosen; Pimpinan") — satu peserta boleh
// masuk beberapa kelompok sekaligus. Data lama berisi satu nama tetap
// terbaca sebagai daftar berisi satu kelompok itu.
function pisahKelompok_(mentah) {
  var parts = String(mentah || '').split(/[;,]/);
  var out = [];
  for (var i = 0; i < parts.length; i++) {
    var n = trim_(parts[i]);
    if (n && out.indexOf(n) === -1) out.push(n);
  }
  return out;
}

// Pastikan SEMUA nama dalam daftar kelompok ada di sheet Kelompok;
// mengembalikan daftar kanonisnya sebagai string dipisah '; '.
function kelompokPastikanDaftar_(mentah) {
  var daftar = pisahKelompok_(mentah);
  var hasil = [];
  for (var i = 0; i < daftar.length; i++) {
    var resmi = kelompokPastikan_(daftar[i]);
    if (resmi && hasil.indexOf(resmi) === -1) hasil.push(resmi);
  }
  return hasil.join('; ');
}

// Pastikan nama kelompok ada di sheet Kelompok (dibuat bila belum ada,
// pencocokan tidak peka huruf besar/kecil); mengembalikan nama resminya.
function kelompokPastikan_(namaMentah) {
  var nama = trim_(namaMentah || '');
  if (!nama) return '';
  var gd = sheetData_('Kelompok').rows;
  for (var i = 0; i < gd.length; i++) {
    if (str_(gd[i].nama).toLowerCase() === nama.toLowerCase()) return str_(gd[i].nama);
  }
  appendRow_('Kelompok', { id: nextId_('Kelompok'), nama: nama, createdAt: sekarangIso_() });
  return nama;
}

function apiTambahPeserta(data) {
  wajibPeran_(['Admin', 'Notulis']);
  data = data || {};
  if (!trim_(data.nama || '')) throw new Error('Nama peserta wajib diisi.');
  var id = nextId_('Peserta');
  appendRow_('Peserta', {
    id: id, nama: data.nama, nip: data.nip || '', jabatan: data.jabatan || '',
    unit: data.unit || '', kelompok: kelompokPastikanDaftar_(data.kelompok || ''), createdAt: sekarangIso_()
  });
  return { ok: true, id: id };
}

function apiUbahPeserta(data) {
  wajibPeran_(['Admin', 'Notulis']);
  data = data || {};
  var p = findRow_('Peserta', 'id', data.id);
  if (!p) throw new Error('Peserta tidak ditemukan di Buku Peserta.');
  if (!trim_(data.nama || '')) throw new Error('Nama peserta wajib diisi.');
  updateRowById_('Peserta', data.id, {
    nama: data.nama, nip: data.nip || '', jabatan: data.jabatan || '',
    unit: data.unit || '', kelompok: kelompokPastikanDaftar_(data.kelompok || '')
  });
  return { ok: true };
}

// Impor massal peserta dari Excel/CSV (berkasnya dibaca & dipetakan di
// browser, baris bersihnya dikirim ke sini) — padanan impor versi Muse:
// duplikat dilewati (NIP sama, atau nama sama bila NIP kosong, termasuk
// duplikat di dalam berkas itu sendiri), kelompok dari kolom Kelompok
// dibuat otomatis, dan hasilnya dilaporkan apa adanya.
function apiImporPeserta(rows, kelompokTujuan) {
  wajibPeran_(['Admin', 'Notulis']);
  rows = rows || [];
  if (!rows.length) throw new Error('Tidak ada baris peserta untuk diimpor.');
  if (rows.length > 1000) throw new Error('Sekali impor maksimal 1000 baris peserta.');
  var tujuan = trim_(kelompokTujuan || '');

  var ada = sheetData_('Peserta').rows;
  var seenNip = {};
  var seenNama = {};
  var barisNip = {};
  var barisNama = {};
  for (var i = 0; i < ada.length; i++) {
    var nipAda = trim_(str_(ada[i].nip));
    if (nipAda) { seenNip[nipAda] = true; barisNip[nipAda] = ada[i]; }
    seenNama[str_(ada[i].nama).toLowerCase()] = true;
    barisNama[str_(ada[i].nama).toLowerCase()] = ada[i];
  }
  var gd = sheetData_('Kelompok').rows;
  var grupAda = {};
  for (var g = 0; g < gd.length; g++) grupAda[str_(gd[g].nama).toLowerCase()] = str_(gd[g].nama);
  var groupsCreated = [];
  function pastikan(namaMentah) {
    var nama = trim_(namaMentah || '');
    if (!nama) return '';
    var key = nama.toLowerCase();
    if (grupAda[key]) return grupAda[key];
    appendRow_('Kelompok', { id: nextId_('Kelompok'), nama: nama, createdAt: sekarangIso_() });
    grupAda[key] = nama;
    groupsCreated.push(nama);
    return nama;
  }
  var namaTujuan = tujuan ? pastikan(tujuan) : '';

  var added = 0;
  var skipped = 0;
  var idBerikut = nextId_('Peserta');
  for (var r = 0; r < rows.length; r++) {
    var row = rows[r] || {};
    var nama = trim_(row.nama || '');
    if (!nama) { skipped++; continue; }
    var nip = trim_(row.nip || '');
    var duplikat = nip ? !!seenNip[nip] : !!seenNama[nama.toLowerCase()];
    if (duplikat) {
      skipped++;
      // Peserta tidak digandakan — tetapi semua kelompok yang tertulis
      // di baris ini tetap digabungkan ke data yang sudah ada.
      var sudahAda = nip ? barisNip[nip] : barisNama[nama.toLowerCase()];
      if (sudahAda) {
        var gabung = pisahKelompok_(sudahAda.kelompok);
        pisahKelompok_(row.kelompok || '').forEach(function (n) {
          var resmi = pastikan(n);
          if (resmi && gabung.indexOf(resmi) === -1) gabung.push(resmi);
        });
        var gabungStr = gabung.join('; ');
        if (gabungStr !== str_(sudahAda.kelompok)) {
          updateRowById_('Peserta', sudahAda.id, { kelompok: gabungStr });
          sudahAda.kelompok = gabungStr;
        }
      }
      continue;
    }
    if (nip) seenNip[nip] = true;
    seenNama[nama.toLowerCase()] = true;
    var daftarKel = pisahKelompok_(row.kelompok || '');
    var kelompok = daftarKel.length
      ? daftarKel.map(function (n) { return pastikan(n); }).join('; ')
      : namaTujuan;
    var barisBaru = {
      id: idBerikut++, nama: nama, nip: nip, jabatan: trim_(row.jabatan || ''),
      unit: trim_(row.unit || ''), kelompok: kelompok, createdAt: sekarangIso_()
    };
    appendRow_('Peserta', barisBaru);
    if (nip) barisNip[nip] = barisBaru;
    barisNama[nama.toLowerCase()] = barisBaru;
    added++;
  }
  return { added: added, skippedDuplicates: skipped, groupsCreated: groupsCreated };
}

function apiHapusPeserta(id) {
  wajibPeran_(['Admin', 'Notulis']);
  deleteRowById_('Peserta', id);
  return { ok: true };
}

function apiTambahKelompok(nama) {
  wajibPeran_(['Admin', 'Notulis']);
  nama = trim_(nama || '');
  if (!nama) throw new Error('Nama kelompok wajib diisi.');
  if (findRow_('Kelompok', 'nama', nama)) return { ok: true, sudahAda: true };
  appendRow_('Kelompok', { id: nextId_('Kelompok'), nama: nama, createdAt: sekarangIso_() });
  return { ok: true, sudahAda: false };
}

function apiGantiNamaKelompok(namaLama, namaBaru) {
  wajibPeran_(['Admin', 'Notulis']);
  namaBaru = trim_(namaBaru || '');
  if (!namaBaru) throw new Error('Nama kelompok baru wajib diisi.');
  var g = findRow_('Kelompok', 'nama', namaLama);
  if (!g) throw new Error('Kelompok tidak ditemukan.');
  var tabrakan = findRow_('Kelompok', 'nama', namaBaru);
  if (tabrakan && num_(tabrakan.id) !== num_(g.id)) {
    throw new Error('Sudah ada kelompok bernama "' + namaBaru + '".');
  }
  updateRowById_('Kelompok', g.id, { nama: namaBaru });
  var d = sheetData_('Peserta').rows;
  for (var i = 0; i < d.length; i++) {
    var daftarGanti = pisahKelompok_(d[i].kelompok);
    var berubahGanti = false;
    for (var j = 0; j < daftarGanti.length; j++) {
      if (daftarGanti[j] === String(namaLama)) { daftarGanti[j] = namaBaru; berubahGanti = true; }
    }
    if (berubahGanti) {
      updateRowById_('Peserta', d[i].id, { kelompok: daftarGanti.join('; ') });
    }
  }
  return { ok: true };
}

function apiHapusKelompok(nama) {
  wajibPeran_(['Admin', 'Notulis']);
  var g = findRow_('Kelompok', 'nama', nama);
  if (!g) throw new Error('Kelompok tidak ditemukan.');
  var d = sheetData_('Peserta').rows;
  for (var i = 0; i < d.length; i++) {
    var daftarAwal = pisahKelompok_(d[i].kelompok);
    var daftarSisa = daftarAwal.filter(function (n) { return n !== String(nama); });
    if (daftarSisa.length !== daftarAwal.length) {
      updateRowById_('Peserta', d[i].id, { kelompok: daftarSisa.join('; ') });
    }
  }
  deleteRowById_('Kelompok', g.id);
  return { ok: true };
}

// ---------------------------------------------------------------------
// Pengaturan & pengguna (khusus Admin)
// ---------------------------------------------------------------------

function apiGetPengaturan() {
  wajibMasuk_();
  var setelan = pengingatSetelan_();
  return {
    lembagaNama: getPengaturan_('lembaga_nama', ''), lembagaUnit: getPengaturan_('lembaga_unit', ''),
    lembagaAlamat: getPengaturan_('lembaga_alamat', ''), lembagaTelepon: getPengaturan_('lembaga_telepon', ''),
    lembagaEmail: getPengaturan_('lembaga_email', ''),
    logoUrl: getPengaturan_('lembaga_logo_url', ''),
    geminiTerhubung: !!getPengaturan_('gemini_api_key', ''),
    toleransiTerlambat: num_(getPengaturan_('toleransi_terlambat', '15')) || 15,
    jendelaPresensi: num_(getPengaturan_('jendela_presensi', '30')) || 30,
    versiPaket: VERSI_PAKET,
    // Fase 5 — setelan pengingat & Telegram. Token bot tidak pernah
    // dikirim kembali; hanya status terisi + Chat ID.
    pengingatRapat: setelan.rapat, pengingatTindak: setelan.tindak,
    pengingatRekap: setelan.rekap, pengingatJam: setelan.jam,
    // Fase 5.1 — tiga pengingat hari-H per jenis.
    pengingatHariHPagi: setelan.hariHPagi,
    pengingatHariH5Jam: setelan.hariH5Jam,
    pengingatHariH2Jam: setelan.hariH2Jam,
    telegramAktif: setelan.telegramAktif,
    telegramTerhubung: !!trim_(getPengaturan_('telegram_bot_token', '')) && !!trim_(getPengaturan_('telegram_chat_id', '')),
    telegramChatId: getPengaturan_('telegram_chat_id', '')
  };
}

function apiSimpanPengaturan(data) {
  wajibPeran_(['Admin']);
  data = data || {};
  // Hanya kolom yang benar-benar dikirim yang diubah, supaya formulir
  // parsial (mis. hanya kunci Gemini) tidak mengosongkan identitas.
  if (data.lembagaNama !== undefined) setPengaturan_('lembaga_nama', data.lembagaNama || '');
  if (data.lembagaUnit !== undefined) setPengaturan_('lembaga_unit', data.lembagaUnit || '');
  if (data.lembagaAlamat !== undefined) setPengaturan_('lembaga_alamat', data.lembagaAlamat || '');
  if (data.lembagaTelepon !== undefined) setPengaturan_('lembaga_telepon', data.lembagaTelepon || '');
  if (data.lembagaEmail !== undefined) setPengaturan_('lembaga_email', data.lembagaEmail || '');
  if (data.toleransiTerlambat !== undefined) setPengaturan_('toleransi_terlambat', String(data.toleransiTerlambat || 15));
  if (data.jendelaPresensi !== undefined) setPengaturan_('jendela_presensi', String(data.jendelaPresensi || 30));
  if (data.geminiApiKey) setPengaturan_('gemini_api_key', trim_(data.geminiApiKey));
  if (data.hapusKunciGemini) setPengaturan_('gemini_api_key', '');
  // Fase 5 — setelan pengingat per jenis + jam + kanal Telegram.
  if (data.pengingatRapat !== undefined) setPengaturan_('pengingat_rapat', data.pengingatRapat ? '1' : '0');
  if (data.pengingatTindak !== undefined) setPengaturan_('pengingat_tindak', data.pengingatTindak ? '1' : '0');
  if (data.pengingatRekap !== undefined) setPengaturan_('pengingat_rekap', data.pengingatRekap ? '1' : '0');
  if (data.pengingatJam !== undefined && /^\d{2}:\d{2}$/.test(String(data.pengingatJam))) setPengaturan_('pengingat_jam', String(data.pengingatJam));
  // Fase 5.1 — tiga pengingat hari-H per jenis.
  if (data.pengingatHariHPagi !== undefined) setPengaturan_('pengingat_hh_pagi', data.pengingatHariHPagi ? '1' : '0');
  if (data.pengingatHariH5Jam !== undefined) setPengaturan_('pengingat_hh_5jam', data.pengingatHariH5Jam ? '1' : '0');
  if (data.pengingatHariH2Jam !== undefined) setPengaturan_('pengingat_hh_2jam', data.pengingatHariH2Jam ? '1' : '0');
  if (data.telegramAktif !== undefined) setPengaturan_('telegram_aktif', data.telegramAktif ? '1' : '0');
  if (data.telegramBotToken) setPengaturan_('telegram_bot_token', trim_(data.telegramBotToken));
  if (data.telegramChatId !== undefined) setPengaturan_('telegram_chat_id', trim_(data.telegramChatId || ''));
  if (data.hapusTelegram) {
    setPengaturan_('telegram_bot_token', '');
    setPengaturan_('telegram_chat_id', '');
    setPengaturan_('telegram_aktif', '0');
  }
  return { ok: true };
}

// Tes kirim Telegram (Fase 5): memakai token + Chat ID tersimpan.
function apiTesTelegram() {
  wajibPeran_(['Admin']);
  var res = kirimTelegram_('🔔 Tes pengingat SesiRapat — kanal Telegram aktif. Pengingat rapat (H-3/H-1, dan pada hari-H tiga kali: pagi, 5 jam & 2 jam sebelum mulai), tenggat tindak lanjut, dan rekap rapat akan dikirim ke chat ini sesuai setelan di Pengaturan.');
  return {
    ok: res.ok,
    detail: res.ok ? 'Pesan tes terkirim — periksa chat Telegram tujuan.' : res.detail
  };
}

// Logo lembaga: berkas gambar disimpan di folder Drive SesiRapat_Arsip,
// URL + ID berkasnya di sheet Pengaturan; dipakai di kop dokumen bawaan.
function apiUploadLogo(base64, mime) {
  wajibPeran_(['Admin']);
  if (!base64) throw new Error('Berkas logo kosong.');
  if (String(base64).length > 2800000) throw new Error('Ukuran logo melebihi batas 2 MB.');
  var bytes = Utilities.base64Decode(base64);
  if (bytes.length > 2 * 1024 * 1024) throw new Error('Ukuran logo melebihi batas 2 MB.');
  var jenisMime = mime === 'image/jpeg' ? 'image/jpeg' : 'image/png';
  var blob = Utilities.newBlob(bytes, jenisMime, jenisMime === 'image/jpeg' ? 'logo-lembaga.jpg' : 'logo-lembaga.png');
  var file = folderArsip_().createFile(blob);
  setPengaturan_('lembaga_logo_url', file.getUrl());
  setPengaturan_('lembaga_logo_id', file.getId());
  return { ok: true, logoUrl: file.getUrl() };
}

function apiDaftarPengguna() {
  wajibPeran_(['Admin']);
  var d = sheetData_('Pengguna');
  var out = [];
  for (var i = 0; i < d.rows.length; i++) {
    out.push({ email: str_(d.rows[i].email), nama: str_(d.rows[i].nama), peran: str_(d.rows[i].peran) });
  }
  return { users: out };
}

function apiSimpanPengguna(data) {
  wajibPeran_(['Admin']);
  data = data || {};
  var email = trim_(data.email || '').toLowerCase();
  if (!email || email.indexOf('@') === -1) throw new Error('Email pengguna tidak valid.');
  if (['Admin', 'Notulis', 'Pimpinan'].indexOf(data.peran) === -1) throw new Error('Peran harus Admin, Notulis, atau Pimpinan.');
  var d = sheetData_('Pengguna');
  for (var i = 0; i < d.rows.length; i++) {
    if (String(d.rows[i].email).toLowerCase() === email) {
      d.sh.getRange(d.rows[i]._row, 2).setValue(data.nama || '');
      d.sh.getRange(d.rows[i]._row, 3).setValue(data.peran);
      return { ok: true, diperbarui: true };
    }
  }
  appendRow_('Pengguna', { email: email, nama: data.nama || '', peran: data.peran, pin: '' });
  return { ok: true, diperbarui: false };
}

function apiHapusPengguna(email) {
  var u = wajibPeran_(['Admin']);
  if (String(email).toLowerCase() === u.email.toLowerCase()) {
    throw new Error('Kamu tidak bisa menghapus akunmu sendiri.');
  }
  var d = sheetData_('Pengguna');
  for (var i = 0; i < d.rows.length; i++) {
    if (String(d.rows[i].email).toLowerCase() === String(email).toLowerCase()) {
      d.sh.deleteRow(d.rows[i]._row);
      return { ok: true };
    }
  }
  return { ok: true };
}

// ---------------------------------------------------------------------
// Penerbitan dokumen resmi (Notulensi & Lembar Presensi) via Docs/PDF
// ---------------------------------------------------------------------

function templateAktif_(jenis) {
  var d = sheetData_('Template');
  for (var i = 0; i < d.rows.length; i++) {
    if (str_(d.rows[i].jenis) === jenis && num_(d.rows[i].aktif) === 1) return d.rows[i];
  }
  return null;
}

function nomorRegisterBaru_(jenis) {
  var now = new Date();
  var ym = '' + now.getFullYear() + ('0' + (now.getMonth() + 1)).slice(-2);
  var prefix = jenis === 'Notulensi' ? 'NOT' : 'PRES';
  var d = sheetData_('Dokumen');
  var hitung = 0;
  for (var i = 0; i < d.rows.length; i++) {
    if (str_(d.rows[i].jenis) === jenis && str_(d.rows[i].nomorRegister).indexOf('/' + ym + '/') !== -1) hitung++;
  }
  var seq = '00' + (hitung + 1);
  return 'SR/' + prefix + '/' + ym + '/' + seq.slice(-3);
}

function bangunFields_(m, notulen, tindakLanjut, kehadiran, nomorRegister) {
  var hadir = [];
  var izin = 0, alpa = 0;
  for (var i = 0; i < kehadiran.length; i++) {
    if (kehadiran[i].status === 'Hadir') hadir.push(kehadiran[i]);
    else if (kehadiran[i].status === 'Izin') izin++;
    else if (kehadiran[i].status === 'Alpa') alpa++;
  }
  var tlTeks = [];
  for (var j = 0; j < tindakLanjut.length; j++) {
    var f = tindakLanjut[j];
    tlTeks.push((j + 1) + '. ' + f.uraian + (f.penanggungJawab ? ' — ' + f.penanggungJawab : '') + (f.tenggatText ? ' (' + f.tenggatText + ')' : ''));
  }
  var dhTeks = [];
  for (var k = 0; k < hadir.length; k++) {
    dhTeks.push((k + 1) + '. ' + hadir[k].nama + (hadir[k].jabatan ? ' (' + hadir[k].jabatan + ')' : ''));
  }
  var durasi = '';
  if (m.startedAt && m.endedAt) {
    // Durasi aktif saja: total waktu jeda dikurangkan.
    var totalMs = new Date(m.endedAt).getTime() - new Date(m.startedAt).getTime() - num_(m.pausedTotalMs);
    var menit = Math.max(1, Math.round(totalMs / 60000));
    durasi = menit + ' menit';
  }
  // Riwayat jeda dari Log_Status: pasangan Dijeda → Berlangsung/Selesai.
  var jedaTeks = [];
  var ld2 = sheetData_('Log_Status').rows;
  var buka = null;
  var fmtJam = function (iso) { var d = new Date(iso); return isNaN(d.getTime()) ? '' : ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); };
  for (var q = 0; q < ld2.length; q++) {
    if (num_(ld2[q].meetingId) !== num_(m.id)) continue;
    if (str_(ld2[q].ke) === 'Dijeda') {
      buka = { mulai: str_(ld2[q].waktu), alasan: str_(ld2[q].catatan) };
      jedaTeks.push(buka);
    } else if (buka && (str_(ld2[q].ke) === 'Berlangsung' || str_(ld2[q].ke) === 'Selesai')) {
      buka.selesai = str_(ld2[q].waktu);
      buka = null;
    }
  }
  var jedaBaris = [];
  for (var q2 = 0; q2 < jedaTeks.length; q2++) {
    var jb = jedaTeks[q2];
    var ket = jb.selesai
      ? fmtJam(jb.mulai) + '–' + fmtJam(jb.selesai) + ' (' + Math.max(1, Math.round((new Date(jb.selesai).getTime() - new Date(jb.mulai).getTime()) / 60000)) + ' menit)'
      : fmtJam(jb.mulai) + '–sekarang (sedang jeda)';
    jedaBaris.push((q2 + 1) + '. ' + (jb.alasan || 'Jeda') + ' · ' + ket);
  }
  return {
    NAMA_RAPAT: str_(m.nama), JENIS_RAPAT: str_(m.jenis),
    TANGGAL_RAPAT: tanggalSingkat_(m.tanggal), TANGGAL: tanggalSingkat_(m.tanggal),
    HARI: tanggalPanjang_(m.tanggal).split(',')[0],
    JAM_MULAI: str_(m.jamMulai), JAM_SELESAI: str_(m.jamSelesai), TEMPAT: str_(m.tempat),
    PIMPINAN_RAPAT: str_(m.pimpinan), NOTULIS: str_(m.notulis), AGENDA: str_(m.agenda),
    NOMOR_UNDANGAN: str_(m.nomorUndangan),
    PEMBAHASAN: notulen ? str_(notulen.pembahasan) : '',
    KEPUTUSAN: notulen ? str_(notulen.keputusan) : '',
    TINDAK_LANJUT: tlTeks.join('\n'), DAFTAR_HADIR: dhTeks.join('\n'),
    JUMLAH_HADIR: String(hadir.length), JUMLAH_IZIN: String(izin),
    JUMLAH_ALPA: String(alpa), JUMLAH_UNDANGAN: String(kehadiran.length),
    DURASI: durasi, RIWAYAT_JEDA: jedaBaris.join('\\n'), NOMOR_REGISTER: nomorRegister,
    TANGGAL_TERBIT: tanggalSingkat_(Utilities.formatDate(new Date(), ZONA, 'yyyy-MM-dd')),
    LEMBAGA: getPengaturan_('lembaga_nama', ''), UNIT_LEMBAGA: getPengaturan_('lembaga_unit', ''),
    TTD_PIMPINAN: str_(m.pimpinan), TTD_NOTULIS: str_(m.notulis)
  };
}

// Menjalankan fn untuk setiap elemen teks di dalam sebuah elemen
// (body/header/footer/tabel) secara rekursif.
function prosesTeks_(el, fn) {
  if (!el) return;
  var type = el.getType();
  if (type === DocumentApp.ElementType.TEXT) { fn(el.asText()); return; }
  if (el.getNumChildren) {
    for (var i = 0; i < el.getNumChildren(); i++) prosesTeks_(el.getChild(i), fn);
  }
}

function gantiSemua_(wadah, fields) {
  prosesTeks_(wadah, function (teks) {
    var t = teks.getText();
    if (t.indexOf('{{') === -1) return;
    var nt = t;
    for (var k in fields) nt = nt.split('{{' + k + '}}').join(fields[k]);
    if (nt !== t) teks.setText(nt);
  });
}

function kolomBaris_(kehadiran, kunci) {
  var vals = [];
  for (var i = 0; i < kehadiran.length; i++) {
    var a = kehadiran[i];
    if (kunci === 'NO') vals.push(String(i + 1));
    else if (kunci === 'NAMA') vals.push(a.nama);
    else if (kunci === 'NIP') vals.push(a.nip);
    else if (kunci === 'JABATAN') vals.push(a.jabatan);
    else if (kunci === 'UNIT') vals.push(a.unit);
    else if (kunci === 'STATUS') vals.push(a.status + (a.late ? ' (Terlambat)' : ''));
    else if (kunci === 'JAM_HADIR') vals.push(a.jamHadir);
    else if (kunci === 'TERLAMBAT') vals.push(a.late ? 'Terlambat' : '');
  }
  return vals.join('\n');
}

// Baris template {{BARIS_PESERTA}}: setiap placeholder kolom pada baris
// itu diisi nilai seluruh peserta digabung baris baru, sehingga tabel
// template berkop tetap utuh dan satu baris template menjadi blok data.
function isiBarisPeserta_(doc, kehadiran) {
  var wadahList = [doc.getBody()];
  var header = doc.getHeader();
  if (header) wadahList.push(header);
  var footer = doc.getFooter();
  if (footer) wadahList.push(footer);
  var barisFields = {
    BARIS_PESERTA: '', NO: kolomBaris_(kehadiran, 'NO'), NAMA: kolomBaris_(kehadiran, 'NAMA'),
    NIP: kolomBaris_(kehadiran, 'NIP'), JABATAN: kolomBaris_(kehadiran, 'JABATAN'),
    UNIT: kolomBaris_(kehadiran, 'UNIT'), STATUS: kolomBaris_(kehadiran, 'STATUS'),
    JAM_HADIR: kolomBaris_(kehadiran, 'JAM_HADIR'), TERLAMBAT: kolomBaris_(kehadiran, 'TERLAMBAT')
  };
  var barisUtama = [];
  for (var i = 0; i < kehadiran.length; i++) {
    var a = kehadiran[i];
    barisUtama.push((i + 1) + '. ' + a.nama + (a.jabatan ? ' — ' + a.jabatan : '') + (a.unit ? ' (' + a.unit + ')' : '') + ' — ' + a.status + (a.late ? ' (Terlambat)' : '') + (a.jamHadir ? ' — ' + a.jamHadir : ''));
  }
  barisFields.BARIS_PESERTA = barisUtama.join('\n');
  for (var w = 0; w < wadahList.length; w++) {
    var tables = wadahList[w].getTables ? wadahList[w].getTables() : [];
    for (var t = 0; t < tables.length; t++) {
      var table = tables[t];
      for (var r = 0; r < table.getNumRows(); r++) {
        var row = table.getRow(r);
        if (row.getText().indexOf('{{BARIS_PESERTA}}') !== -1) gantiSemua_(row, barisFields);
      }
    }
  }
}

// Kepala dokumen bawaan (logo + kop + judul + nomor register +
// baris meta rapat) — dipakai dokumen tabel yang bisa disunting
// maupun dokumen kartu khusus PDF, supaya keduanya berkop sama.
function kepalaDokumen_(doc, jenis, fields) {
  var body = doc.getBody();
  var logoId = getPengaturan_('lembaga_logo_id', '');
  if (logoId) {
    try {
      var logoImg = body.appendImage(DriveApp.getFileById(logoId).getBlob());
      logoImg.setWidth(64);
      logoImg.setHeight(64);
    } catch (e) { /* logo tidak wajib tampil */ }
  }
  var kop = [
    getPengaturan_('lembaga_nama', ''), getPengaturan_('lembaga_unit', ''),
    [getPengaturan_('lembaga_alamat', ''), getPengaturan_('lembaga_telepon', '')].filter(function (s) { return s; }).join(' · ')
  ].filter(function (s) { return s; });
  for (var i = 0; i < kop.length; i++) {
    var p = body.appendParagraph(kop[i]);
    p.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    if (i === 0) { p.setFontSize(14); p.setBold(true); }
  }
  body.appendHorizontalRule();
  var judul = body.appendParagraph(jenis === 'Notulensi' ? 'NOTULENSI RAPAT' : 'LEMBAR PRESENSI');
  judul.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  judul.setFontSize(13); judul.setBold(true);
  var reg = body.appendParagraph('Nomor Register: ' + fields.NOMOR_REGISTER);
  reg.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  body.appendParagraph('');
  var meta = [
    ['Nama Rapat', fields.NAMA_RAPAT], ['Jenis', fields.JENIS_RAPAT],
    ['Hari/Tanggal', fields.HARI + ', ' + fields.TANGGAL_RAPAT],
    ['Waktu', fields.JAM_MULAI + (fields.JAM_SELESAI ? ' – ' + fields.JAM_SELESAI : '') + ' WIB'],
    ['Tempat', fields.TEMPAT], ['Pimpinan Rapat', fields.PIMPINAN_RAPAT],
    ['Notulis', fields.NOTULIS], ['Agenda', fields.AGENDA]
  ];
  for (var j = 0; j < meta.length; j++) {
    if (meta[j][1]) body.appendParagraph(meta[j][0] + ': ' + meta[j][1]);
  }
}

// Blok tanda tangan penutup (Notulis / Pimpinan Rapat) TANPA garis
// kotak tabel (Fase 5.4): tabel 2 kolom hanya dipakai untuk tata
// letak dua kolom; garis tepinya dimatikan (setBorderWidth(0))
// supaya area tanda tangan bersih di PDF maupun Docs/DOCX, untuk
// Notulensi dan Presensi.
function blokTtdDokumen_(body, fields) {
  body.appendParagraph('');
  var ttd = body.appendTable();
  var ttdRow = ttd.appendTableRow();
  ttdRow.appendTableCell('');
  ttdRow.appendTableCell(fields.TEMPAT ? fields.TEMPAT + ', ' + fields.TANGGAL_TERBIT : fields.TANGGAL_TERBIT);
  var ttdRow2 = ttd.appendTableRow();
  ttdRow2.appendTableCell('Notulis,\n\n\n\n' + fields.NOTULIS);
  ttdRow2.appendTableCell('Pimpinan Rapat,\n\n\n\n' + fields.PIMPINAN_RAPAT);
  try { ttd.setBorderWidth(0); } catch (e) { /* garis penutup best-effort */ }
}

function bangunDokumenBawaan_(jenis, m, fields, kehadiran, notulen) {
  var doc = DocumentApp.create('SesiRapat ' + jenis + ' - ' + str_(m.nama));
  var body = doc.getBody();
  body.setFontFamily('Times New Roman');
  kepalaDokumen_(doc, jenis, fields);
  if (jenis === 'Notulensi') {
    body.appendParagraph('').setSpacingAfter(6);
    var h1 = body.appendParagraph('Pembahasan'); h1.setBold(true);
    body.appendParagraph(fields.PEMBAHASAN || '—');
    var h2 = body.appendParagraph('Keputusan'); h2.setBold(true);
    body.appendParagraph(fields.KEPUTUSAN || '—');
    var h3 = body.appendParagraph('Tindak Lanjut'); h3.setBold(true);
    body.appendParagraph(fields.TINDAK_LANJUT || '—');
    body.appendParagraph('');
    body.appendParagraph('Daftar Hadir (' + fields.JUMLAH_HADIR + ' dari ' + fields.JUMLAH_UNDANGAN + ' undangan):');
    body.appendParagraph(fields.DAFTAR_HADIR || '—');
  } else {
    body.appendParagraph('');
    var table = body.appendTable();
    var head = ['No', 'Nama', 'NIP', 'Jabatan', 'Unit', 'Status', 'Jam Hadir', 'Tanda Tangan'];
    var hr = table.appendTableRow();
    for (var c = 0; c < head.length; c++) hr.appendTableCell(head[c]).setBold(true);
    for (var r = 0; r < kehadiran.length; r++) {
      var a = kehadiran[r];
      var tr = table.appendTableRow();
      var vals = [String(r + 1), a.nama, a.nip, a.jabatan, a.unit, a.status + (a.late ? ' (Terlambat)' : ''), a.jamHadir, ''];
      for (var cc = 0; cc < vals.length; cc++) tr.appendTableCell(vals[cc]);
      if (a.signatureUrl) {
        try {
          var fid = ambilIdDrive_(a.signatureUrl);
          if (fid) {
            var blob = DriveApp.getFileById(fid).getBlob();
            var cell = tr.getCell(7);
            cell.clear();
            cell.appendImage(blob).setWidth(90).setHeight(36);
          }
        } catch (e) { /* tanda tangan opsional */ }
      }
    }
    // Kolom Tanda Tangan (kolom ke-8) tanpa garis kotak (Fase 5.4):
    // DocumentApp tidak menyediakan garis tepi per sel, jadi lebar
    // garis sel kolom itu dicoba dinolkan lewat atribut sel —
    // best-effort, diam-diam dilewati bila platform tidak
    // mendukungnya. PDF kartu + blok penutup pasti tanpa garis.
    try {
      var attrTtd = {};
      attrTtd[DocumentApp.Attribute.BORDER_WIDTH] = 0;
      for (var rb = 0; rb < table.getNumRows(); rb++) {
        try { table.getRow(rb).getCell(7).setAttributes(attrTtd); } catch (eSel) { /* abaikan per sel */ }
      }
    } catch (eAtr) { /* atribut sel tidak didukung — abaikan */ }
    body.appendParagraph('');
    body.appendParagraph('Hadir: ' + fields.JUMLAH_HADIR + ' · Izin: ' + fields.JUMLAH_IZIN + ' · Alpa: ' + fields.JUMLAH_ALPA + ' · Total undangan: ' + fields.JUMLAH_UNDANGAN);
  }
  blokTtdDokumen_(body, fields);
  doc.saveAndClose();
  return doc.getId();
}

// Dokumen KARTU khusus PDF Lembar Presensi (Fase 5.4): tabel 8
// kolom pada dokumen tabel membuat kolom Jabatan/Unit sempit
// sehingga teks terpotong per huruf dan NIP terbelah. Pada dokumen
// ini tiap peserta menjadi satu kartu lebar penuh (tabel 1 sel
// sebagai bingkai kartu) berisi No, Nama, NIP, Jabatan, Unit,
// Status, Jam Hadir, dan area Tanda Tangan yang bersih tanpa
// garis kotak di dalamnya — teks selalu punya ruang penuh.
// Dokumen ini hanya perantara ekspor PDF (dibuang setelahnya);
// berkas Docs/DOCX resmi tetap dokumen tabel yang bisa disunting.
function bangunDokumenKartuPresensi_(m, fields, kehadiran) {
  var doc = DocumentApp.create('SesiRapat Presensi (kartu PDF) - ' + str_(m.nama));
  var body = doc.getBody();
  body.setFontFamily('Times New Roman');
  kepalaDokumen_(doc, 'Presensi', fields);
  body.appendParagraph('');
  for (var r = 0; r < kehadiran.length; r++) {
    var a = kehadiran[r];
    var kartu = body.appendTable();
    var sel = kartu.appendTableRow().appendTableCell();
    var judulKartu = sel.appendParagraph((r + 1) + '. ' + a.nama);
    judulKartu.setBold(true);
    judulKartu.setFontSize(12);
    sel.appendParagraph('NIP: ' + (a.nip || '—'));
    sel.appendParagraph('Jabatan: ' + (a.jabatan || '—'));
    sel.appendParagraph('Unit: ' + (a.unit || '—'));
    sel.appendParagraph('Status: ' + a.status + (a.late ? ' (Terlambat)' : '') + ' · Jam Hadir: ' + (a.jamHadir || '—'));
    sel.appendParagraph('Tanda Tangan:');
    var adaTtd = false;
    if (a.signatureUrl) {
      try {
        var fidK = ambilIdDrive_(a.signatureUrl);
        if (fidK) {
          sel.appendImage(DriveApp.getFileById(fidK).getBlob()).setWidth(120).setHeight(48);
          adaTtd = true;
        }
      } catch (e) { /* tanda tangan opsional */ }
    }
    if (!adaTtd) {
      // Ruang kosong untuk tanda tangan basah di hasil cetak.
      sel.appendParagraph('');
      sel.appendParagraph('');
    }
    body.appendParagraph('');
  }
  body.appendParagraph('Hadir: ' + fields.JUMLAH_HADIR + ' · Izin: ' + fields.JUMLAH_IZIN + ' · Alpa: ' + fields.JUMLAH_ALPA + ' · Total undangan: ' + fields.JUMLAH_UNDANGAN);
  blokTtdDokumen_(body, fields);
  doc.saveAndClose();
  return doc.getId();
}

function ambilIdDrive_(url) {
  var s = String(url || '');
  var pola = ['id=', '/d/', 'folders/'];
  for (var i = 0; i < pola.length; i++) {
    var idx = s.indexOf(pola[i]);
    if (idx !== -1) {
      var sisa = s.slice(idx + pola[i].length);
      var akhir = sisa.search(/[^a-zA-Z0-9_-]/);
      return akhir === -1 ? sisa : sisa.slice(0, akhir);
    }
  }
  return '';
}

function apiTerbitkanDokumen(meetingId, jenis) {
  wajibPeran_(['Admin', 'Notulis', 'Pimpinan']);
  if (jenis !== 'Notulensi' && jenis !== 'Presensi') throw new Error('Jenis dokumen tidak dikenal.');
  var m = findRow_('Rapat', 'id', meetingId);
  if (!m) throw new Error('Rapat tidak ditemukan.');
  var detail = apiDetailRapat(meetingId);
  var notulen = notulenRow_(meetingId);
  var nomorRegister = nomorRegisterBaru_(jenis);
  var fields = bangunFields_(m, notulen, detail.tindakLanjut, detail.kehadiran, nomorRegister);
  var tpl = templateAktif_(jenis);
  var docId = '';
  var namaBerkas = nomorRegister.split('/').join('_') + ' - ' + jenis + ' - ' + str_(m.nama);

  if (tpl && str_(tpl.docsId)) {
    var sumber = DriveApp.getFileById(str_(tpl.docsId));
    var salinan = sumber.makeCopy(namaBerkas, folderArsip_());
    docId = salinan.getId();
    var doc = DocumentApp.openById(docId);
    isiBarisPeserta_(doc, detail.kehadiran);
    gantiSemua_(doc.getBody(), fields);
    var hd = doc.getHeader();
    if (hd) gantiSemua_(hd, fields);
    var ft = doc.getFooter();
    if (ft) gantiSemua_(ft, fields);
    doc.saveAndClose();
  } else {
    docId = bangunDokumenBawaan_(jenis, m, fields, detail.kehadiran, notulen);
    var berkasDoc = DriveApp.getFileById(docId);
    berkasDoc.moveTo(folderArsip_());
    berkasDoc.setName(namaBerkas);
  }
  // PDF Lembar Presensi dari dokumen BAWAAN (tanpa template) dibuat
  // dari dokumen kartu terpisah (Fase 5.4) supaya peserta tampil
  // sebagai kartu lebar yang rapi, bukan tabel 8 kolom yang sempit;
  // dokumen perantara kartu dibuang setelah PDF jadi. Bila template
  // Docs aktif dipakai, PDF mengikuti desain template itu sendiri.
  var pakaiTemplate = !!(tpl && str_(tpl.docsId));
  var pdfSumberId = docId;
  var kartuId = '';
  if (jenis === 'Presensi' && !pakaiTemplate) {
    kartuId = bangunDokumenKartuPresensi_(m, fields, detail.kehadiran);
    pdfSumberId = kartuId;
  }
  var pdfBlob = DriveApp.getFileById(pdfSumberId).getAs('application/pdf');
  pdfBlob.setName(namaBerkas + '.pdf');
  var pdfFile = folderArsip_().createFile(pdfBlob);
  if (kartuId) {
    try { DriveApp.getFileById(kartuId).setTrashed(true); } catch (e) { /* perantara kartu */ }
  }

  // Salinan .docx juga disimpan (padanan berkas .docx hasil terbit di
  // versi Muse) — konversi langsung dari Google Docs yang sama.
  var docxUrl = '';
  try {
    var docxBlob = DriveApp.getFileById(docId).getAs('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    docxBlob.setName(namaBerkas + '.docx');
    docxUrl = folderArsip_().createFile(docxBlob).getUrl();
  } catch (e) { docxUrl = ''; }

  appendRow_('Dokumen', {
    id: nextId_('Dokumen'), meetingId: meetingId, jenis: jenis, nomorRegister: nomorRegister,
    templateId: tpl ? num_(tpl.id) : '', pdfUrl: pdfFile.getUrl(),
    docsUrl: DriveApp.getFileById(docId).getUrl(), createdAt: sekarangIso_(), docxUrl: docxUrl
  });
  logStatus_(meetingId, '', 'Dokumen ' + jenis + ' terbit: ' + nomorRegister);
  return {
    ok: true, nomorRegister: nomorRegister, pdfUrl: pdfFile.getUrl(),
    docsUrl: DriveApp.getFileById(docId).getUrl(), docxUrl: docxUrl
  };
}

// ---------------------------------------------------------------------
// Impor data dari ekspor JSON versi Muse
// ---------------------------------------------------------------------
// Alur: unduh ekspor JSON dari SesiRapat versi Muse (Pengaturan >
// Data & migrasi), lalu pilih salah satu:
//   a) unggah berkasnya ke folder Drive SesiRapat_Arsip dengan nama
//      "sesirapat-ekspor.json", lalu jalankan imporDataDariDrive()
//      (dari editor atau menu SesiRapat di spreadsheet), atau
//   b) tempel isi JSON di halaman Pengaturan Web App (khusus Admin).
// Baris yang ID-nya sudah ada dilewati, jadi impor aman diulang.
// Yang TIDAK ikut pindah: berkas template .docx dan gambar tanda
// tangan dari versi Muse (keduanya tersimpan sebagai blob di Muse).
// Untuk template, unggah Google Docs template ke Drive lalu isi kolom
// docsId + aktif di sheet Template.

function idSudahAda_(nama, idSet) {
  var d = sheetData_(nama);
  var set = {};
  for (var i = 0; i < d.rows.length; i++) set[num_(d.rows[i].id)] = true;
  return set;
}

// Kelompok peserta dari ekspor JSON versi Muse: utamakan string
// "kelompok" (daftar dipisah '; '), lalu groupIds, lalu groupId tunggal
// (data lama) — semuanya menjadi daftar nama dipisah '; ' untuk kolom
// Kelompok sheet Peserta.
function kelompokImporJson_(ps, grupNama) {
  if (ps.kelompok) return pisahKelompok_(ps.kelompok).join('; ');
  var ids = ps.groupIds || (ps.groupId ? [ps.groupId] : []);
  var names = [];
  for (var i = 0; i < ids.length; i++) {
    var n = grupNama[num_(ids[i])];
    if (n && names.indexOf(n) === -1) names.push(n);
  }
  return names.join('; ');
}

function imporJson_(data) {
  if (!data || data.app !== 'SesiRapat') {
    throw new Error('Berkas ini bukan ekspor SesiRapat. Gunakan berkas dari Pengaturan > Unduh Ekspor Data (JSON) di versi Muse.');
  }
  var hasil = {};

  var grupNama = {};
  var grupSet = idSudahAda_('Kelompok');
  var grupBaru = 0;
  var groups = data.personGroups || [];
  for (var g = 0; g < groups.length; g++) {
    grupNama[num_(groups[g].id)] = str_(groups[g].nama);
    if (!grupSet[num_(groups[g].id)]) {
      appendRow_('Kelompok', { id: num_(groups[g].id), nama: groups[g].nama, createdAt: groups[g].createdAt || sekarangIso_() });
      grupBaru++;
    }
  }
  hasil.Kelompok = grupBaru;

  var rapatSet = idSudahAda_('Rapat');
  var rapatBaru = 0;
  var meetings = data.meetings || [];
  for (var i = 0; i < meetings.length; i++) {
    var m = meetings[i];
    if (rapatSet[num_(m.id)]) continue;
    appendRow_('Rapat', {
      id: num_(m.id), nama: m.nama || '', jenis: m.jenis || 'Rapat Koordinasi', tanggal: m.tanggal || '',
      jamMulai: m.jamMulai || '', jamSelesai: m.jamSelesai || '', tempat: m.tempat || '',
      pimpinan: m.pimpinan || '', notulis: m.notulis || '', agenda: m.agenda || '',
      nomorUndangan: m.nomorUndangan || '', status: m.status || 'Terjadwal', secret: m.secret || '',
      startedAt: m.startedAt || '', endedAt: m.endedAt || '', createdAt: m.createdAt || sekarangIso_()
    });
    rapatBaru++;
  }
  hasil.Rapat = rapatBaru;

  var pesertaSet = idSudahAda_('Peserta');
  var pesertaBaru = 0;
  var people = data.people || [];
  for (var p = 0; p < people.length; p++) {
    var ps = people[p];
    if (pesertaSet[num_(ps.id)]) continue;
    appendRow_('Peserta', {
      id: num_(ps.id), nama: ps.nama || '', nip: ps.nip || '', jabatan: ps.jabatan || '',
      unit: ps.unit || '', kelompok: kelompokImporJson_(ps, grupNama), createdAt: ps.createdAt || sekarangIso_()
    });
    pesertaBaru++;
  }
  hasil.Peserta = pesertaBaru;

  var hadirSet = idSudahAda_('Kehadiran');
  var hadirBaru = 0;
  var attendance = data.attendance || [];
  for (var a = 0; a < attendance.length; a++) {
    var at = attendance[a];
    if (hadirSet[num_(at.id)]) continue;
    appendRow_('Kehadiran', {
      id: num_(at.id), meetingId: num_(at.meetingId), personId: at.personId || '', nama: at.nama || '',
      nip: at.nip || '', jabatan: at.jabatan || '', unit: at.unit || '', status: at.status || 'Undangan',
      invitedAt: at.invitedAt || '', checkinAt: at.checkinAt || '', late: at.late || 0,
      method: at.method || '', signatureUrl: ''
    });
    hadirBaru++;
  }
  hasil.Kehadiran = hadirBaru;

  var notSet = idSudahAda_('Notulensi');
  var notBaru = 0;
  var minutes = data.minutes || [];
  for (var n = 0; n < minutes.length; n++) {
    var nt = minutes[n];
    if (notSet[num_(nt.id)]) continue;
    var trImp = siapkanTranskrip_(num_(nt.meetingId), null, nt.transcript || '');
    appendRow_('Notulensi', {
      id: num_(nt.id), meetingId: num_(nt.meetingId), transcript: trImp.transcript,
      transkripFileId: trImp.transkripFileId,
      pembahasan: nt.pembahasan || '', keputusan: nt.keputusan || '', status: nt.status || 'Draf',
      catatanPimpinan: nt.catatanPimpinan || '', disetujuiOleh: nt.disetujuiOleh || '',
      disetujuiPada: nt.disetujuiPada || '', updatedAt: nt.updatedAt || sekarangIso_()
    });
    notBaru++;
  }
  hasil.Notulensi = notBaru;

  var tlSet = idSudahAda_('Tindak_Lanjut');
  var tlBaru = 0;
  var followups = data.followups || [];
  for (var f = 0; f < followups.length; f++) {
    var fu = followups[f];
    if (tlSet[num_(fu.id)]) continue;
    appendRow_('Tindak_Lanjut', {
      id: num_(fu.id), meetingId: num_(fu.meetingId), uraian: fu.uraian || '',
      penanggungJawab: fu.penanggungJawab || '', tenggatText: fu.tenggatText || '',
      tenggatDate: fu.tenggatDate || '', status: fu.status || 'Belum', source: fu.source || 'manual',
      createdAt: fu.createdAt || sekarangIso_(), doneAt: fu.doneAt || ''
    });
    tlBaru++;
  }
  hasil.Tindak_Lanjut = tlBaru;

  var tplSet = idSudahAda_('Template');
  var tplBaru = 0;
  var templates = data.templates || [];
  for (var t = 0; t < templates.length; t++) {
    var tp = templates[t];
    if (tplSet[num_(tp.id)]) continue;
    appendRow_('Template', {
      id: num_(tp.id), jenis: tp.jenis || 'Notulensi', nama: tp.nama || '', versi: tp.versi || 1,
      kopLines: tp.kopLines || '[]', placeholders: tp.placeholders || '[]', docsId: '',
      fileName: tp.fileName || '', aktif: tp.aktif || 0, createdAt: tp.createdAt || sekarangIso_()
    });
    tplBaru++;
  }
  hasil.Template = tplBaru;

  var dokSet = idSudahAda_('Dokumen');
  var dokBaru = 0;
  var documents = data.documents || [];
  for (var d = 0; d < documents.length; d++) {
    var dk = documents[d];
    if (dokSet[num_(dk.id)]) continue;
    appendRow_('Dokumen', {
      id: num_(dk.id), meetingId: num_(dk.meetingId), jenis: dk.jenis || 'Notulensi',
      nomorRegister: dk.nomorRegister || '', templateId: dk.templateId || '', pdfUrl: '', docsUrl: '',
      createdAt: dk.createdAt || sekarangIso_()
    });
    dokBaru++;
  }
  hasil.Dokumen = dokBaru;

  var bagiSet = idSudahAda_('Pembagian_Undangan');
  var bagiBaru = 0;
  var shares = data.inviteShares || [];
  for (var s = 0; s < shares.length; s++) {
    var sh = shares[s];
    if (bagiSet[num_(sh.id)]) continue;
    appendRow_('Pembagian_Undangan', {
      id: num_(sh.id), meetingId: num_(sh.meetingId), kanal: sh.kanal || '',
      jumlahPenerima: sh.jumlahPenerima || 0, createdAt: sh.createdAt || sekarangIso_()
    });
    bagiBaru++;
  }
  hasil.Pembagian_Undangan = bagiBaru;

  var settings = data.settings || [];
  var setBaru = 0;
  for (var st = 0; st < settings.length; st++) {
    var kv = settings[st];
    if (!kv.key || kv.key === 'lembaga_logo_key') continue;
    setPengaturan_(String(kv.key), str_(kv.value));
    setBaru++;
  }
  hasil.Pengaturan = setBaru;

  return hasil;
}

function imporDataDariDrive() {
  var folder = folderArsip_();
  var it = folder.getFilesByName(NAMA_BERKAS_IMPOR);
  if (!it.hasNext()) {
    throw new Error('Berkas ' + NAMA_BERKAS_IMPOR + ' tidak ditemukan di folder ' + NAMA_ARSIP + '. Unggah dulu ekspor JSON dari SesiRapat versi Muse ke folder itu.');
  }
  var isi = it.next().getBlob().getDataAsString();
  var hasil = imporJson_(JSON.parse(isi));
  var pesan = 'Impor selesai. Baris baru ditambahkan: ' + JSON.stringify(hasil);
  try { SpreadsheetApp.getUi().alert(pesan); } catch (e) { /* dari editor */ }
  return hasil;
}

function apiImporJson(jsonTeks) {
  wajibPeran_(['Admin']);
  var data = JSON.parse(jsonTeks);
  var hasil = imporJson_(data);
  return { ok: true, hasil: hasil };
}
