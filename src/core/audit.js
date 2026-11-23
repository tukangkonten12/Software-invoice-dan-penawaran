'use strict';
/**
 * Audit Google Business Profile (Google Maps).
 *
 * Alur: data bisnis + hasil pengecekan  ->  susunAudit()  ->  teks temuan, proyeksi ulasan,
 * rekomendasi, catatan (semua berupa teks yang masih bisa diedit manual)  ->  bangunAudit()
 * mengubah teks tersebut menjadi struktur siap cetak untuk renderer PDF.
 */
const F = require('./format');

/* Item pengecekan profil. Nilai: 'ya' (sudah ada), 'tidak' (belum ada), '?' (belum dicek). */
const CEK_ITEMS = [
  { k: 'website', label: 'Situs Web (atau tautan WhatsApp reservasi)', ui: 'Situs web / link reservasi' },
  { k: 'telepon', label: 'Nomor Telepon', ui: 'Nomor telepon' },
  { k: 'jam', label: 'Jam Operasional', ui: 'Jam operasional' },
  { k: 'deskripsi', label: 'Deskripsi Bisnis (maks. 750 karakter)', ui: 'Deskripsi bisnis terisi' },
  { k: 'layanan', label: 'daftar paket Layanan (Services)', ui: 'Daftar layanan (Services) terisi' },
  { k: 'sosmed', label: 'Profil Sosial Media (Instagram/TikTok portofolio)', ui: 'Tautan sosial media (IG/TikTok)' },
  { k: 'posts', label: 'pembaruan Google Posts mingguan', ui: 'Google Posts rutin' },
  { k: 'balas', label: 'balasan untuk setiap ulasan pelanggan', ui: 'Semua ulasan dibalas' },
  { k: 'fasad', label: 'foto tampak depan yang memperlihatkan plang nama/logo', ui: 'Foto tampak depan + plang nama/logo' },
];

/* Contoh kategori sekunder (hanya saran, tetap pilih dari daftar resmi Google & cek kompetitor). */
const SARAN_KATEGORI = [
  { cocok: ['cuci mobil', 'car wash', 'pencucian mobil'], saran: ['Auto Detailing', 'Salon Mobil'] },
  { cocok: ['bengkel', 'car repair', 'servis mobil'], saran: ['Servis Mobil', 'Toko Suku Cadang Mobil'] },
  { cocok: ['restoran', 'restaurant'], saran: ['Kafe', 'Layanan Pesan Antar Makanan'] },
  { cocok: ['kafe', 'cafe', 'kedai kopi'], saran: ['Restoran', 'Toko Roti'] },
  { cocok: ['salon', 'beauty', 'kecantikan'], saran: ['Salon Rambut', 'Spa'] },
  { cocok: ['klinik', 'dokter', 'dentist', 'dokter gigi'], saran: ['Klinik Kesehatan', 'Dokter Spesialis'] },
  { cocok: ['hotel', 'penginapan', 'lodging'], saran: ['Penginapan', 'Tempat Penyelenggaraan Acara'] },
];

/* -------------------------------------------------------------- utilitas */
const bagi = (s) => String(s == null ? '' : s).split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean);
const rapi = (arr, kata) => (arr.length <= 1 ? arr.join('') : arr.length === 2 ? `${arr[0]} ${kata} ${arr[1]}` : `${arr.slice(0, -1).join(', ')}, ${kata} ${arr[arr.length - 1]}`);
const gabungDan = (arr) => rapi(arr, 'dan');
const gabungAtau = (arr) => rapi(arr, 'atau');

function parseRating(r) {
  const v = parseFloat(String(r == null ? '' : r).replace(',', '.'));
  return isNaN(v) ? null : Math.min(5, Math.max(0, v));
}
const ratingStr = (v) => (v == null ? '' : v.toFixed(1).replace('.', ','));
const jmlUlasan = (u) => Math.max(0, parseInt(String(u == null ? '' : u).replace(/\D/g, ''), 10) || 0);

function kategoriSemua(a) {
  const utama = String(a.kategoriUtama || '').trim();
  return (utama ? [utama] : []).concat(bagi(a.kategoriLain));
}

function saranKategori(utama) {
  const u = String(utama || '').toLowerCase();
  const m = SARAN_KATEGORI.find((x) => x.cocok.some((c) => u.includes(c)));
  return m ? m.saran : [];
}

/* Status satu item pengecekan; 'auto' dipakai khusus untuk kata kunci pada nama profil. */
function statusCek(a, k) {
  const v = (a.cek || {})[k];
  return v === 'ya' || v === 'tidak' ? v : '?';
}

function statusNamaKataKunci(a) {
  const v = (a.cek || {}).namaKata;
  if (v === 'ya' || v === 'tidak') return v;
  const tokens = [String(a.kategoriUtama || '')].concat(bagi(a.layanan)).map((x) => x.toLowerCase()).filter((x) => x.length >= 3);
  if (!tokens.length || !String(a.nama || '').trim()) return '?';
  const nama = String(a.nama).toLowerCase();
  return tokens.some((t) => nama.includes(t)) ? 'ya' : 'tidak';
}

/* ----------------------------------------------------- proyeksi ulasan */
const TANGGA = [25, 50, 80, 100, 150, 200, 300, 500];
const firstGE = (x) => TANGGA.find((v) => v >= x) || Math.ceil(x / 100) * 100;
const lastLE = (x) => TANGGA.reduce((r, v) => (v <= x ? v : r), 0);
const nextAfter = (x) => TANGGA.find((v) => v > x) || x + 100;
const ceil10 = (x) => Math.ceil(x / 10) * 10;

function hitungProyeksi(u) {
  const [vLo, vHi] = u < 50 ? [15, 25] : u < 100 ? [10, 20] : [8, 15];
  let lo, hi, lo2, hi2;
  if (u < 50) {
    // memakai angka target bulat (25 / 50 / 80 / 100 / 150 ...)
    lo = firstGE(u + 2 * vLo);
    hi = lastLE(u + 3 * vHi);
    if (hi <= lo) hi = nextAfter(lo);
    lo2 = nextAfter(hi);
    hi2 = lastLE(u + 6 * vHi);
    if (hi2 <= lo2) hi2 = nextAfter(lo2);
  } else {
    lo = ceil10(u + 3 * vLo);
    hi = ceil10(u + 3 * vHi);
    lo2 = Math.max(ceil10(u + 6 * vLo), hi + 10);
    hi2 = Math.max(ceil10(u + 6 * vHi), lo2 + 10);
  }
  return { vLo, vHi, lo, hi, lo2, hi2 };
}

/* ------------------------------------------------------------ data awal */
function auditBaru(s) {
  return {
    id: String(Date.now()),
    jenis: 'audit',
    status: 'Draf',
    tanggal: F.hariIniISO ? F.hariIniISO() : new Date().toISOString().slice(0, 10),
    klien: '',
    nama: '',
    alamat: '',
    rating: '',
    ulasan: '',
    kategoriUtama: '',
    kategoriLain: '',
    layanan: '',
    area: '',
    mapsUrl: '',
    cek: { namaKata: 'auto' },
    autoBold: true,
    manual: {}, // blok teks yang sudah diedit manual (tidak ditimpa saat data berubah)
    temuan: '',
    proyeksiIntro: '',
    proyeksi: '',
    rekomendasi: '',
    catatan: '',
  };
}

/* ------------------------------------------------------ penyusun teks */
function susunAudit(a) {
  const nama = String(a.nama || '').trim() || 'bisnis ini';
  const cats = kategoriSemua(a);
  const nCat = cats.length;
  const utama = cats[0] || '';
  const layananList = bagi(a.layanan);
  const area = String(a.area || '').trim() || 'sekitar lokasi bisnis';
  const u = jmlUlasan(a.ulasan);
  const r = parseRating(a.rating);
  const rs = ratingStr(r);
  const P = hitungProyeksi(u);
  const bintang = r == null ? 'rating saat ini' : r >= 4.95 ? `rating sudah sempurna di angka ${rs}` : `rating ${rs}`;

  const temuan = [];

  /* 1. kategori */
  if (nCat === 1) {
    const lain = layananList.length ? ` Jika bisnis juga melayani ${gabungAtau(layananList)}, maka wajib ditambahkan kategori sekunder agar menjangkau pencarian yang lebih luas.` : ' Tambahkan kategori sekunder yang sesuai dengan layanan bisnis agar menjangkau pencarian yang lebih luas.';
    temuan.push(`**Hanya Menggunakan 1 Kategori Bisnis:** Profil saat ini hanya mencantumkan satu kategori, yaitu '${utama}'.${lain}`);
  } else if (nCat === 2) {
    temuan.push(`**Kategori Sekunder Masih Terbatas:** Profil baru mencantumkan 2 kategori (${gabungDan(cats)}). Tambahkan kategori sekunder lain yang relevan dengan layanan${layananList.length ? ' ' + gabungDan(layananList) : ''} dan selaraskan dengan kategori yang dipakai kompetitor teratas di ${area}.`);
  } else if (nCat === 0) {
    temuan.push('**Kategori Bisnis Belum Terdeteksi:** Isi kategori utama dan kategori sekunder pada data bisnis agar audit kategori dapat dilakukan.');
  }

  /* 2. ulasan */
  if (u > 0 || a.ulasan !== '') {
    if (u < 20) {
      temuan.push(`**Jumlah Ulasan Masih Sangat Minim:** ${r != null && r >= 4.7 ? 'Meskipun ' + bintang + ',' : 'Dengan ' + bintang + ','} total ulasan baru mencapai ${u} ulasan. Untuk bersaing di ${area}, angka ${u} ulasan masih terlalu rendah untuk mendongkrak peringkat pencarian lokal maupun membangun kepercayaan maksimal bagi calon pelanggan baru.`);
    } else if (u < 50) {
      temuan.push(`**Jumlah Ulasan Masih Perlu Ditambah:** Total ${u} ulasan sudah menjadi modal awal, namun belum cukup kuat untuk bersaing di ${area}. Semakin banyak ulasan terbaru, semakin besar kepercayaan calon pelanggan dan semakin baik peluang tampil di pencarian lokal.`);
    } else if (u < 100) {
      temuan.push(`**Jumlah Ulasan Cukup, Perlu Dijaga Konsisten:** Total ${u} ulasan sudah cukup baik. Pertahankan kecepatan penambahan ulasan agar profil tidak tertinggal dari kompetitor di ${area}.`);
    }
  }

  /* 3. rating */
  if (r != null && r < 4.0) {
    temuan.push(`**Rating Perlu Ditingkatkan:** Rating ${rs} masih di bawah harapan calon pelanggan (umumnya minimal 4,5). Tanggapi ulasan rendah secara profesional, perbaiki keluhan yang berulang, dan ajak pelanggan yang puas untuk memberi ulasan.`);
  } else if (r != null && r < 4.5) {
    temuan.push(`**Rating Belum Optimal:** Rating ${rs} sudah cukup, namun masih bisa dinaikkan. Balas setiap ulasan, tangani keluhan yang muncul, dan perbanyak ulasan positif dari pelanggan yang puas.`);
  }

  /* 4. foto sampul */
  const fasad = statusCek(a, 'fasad');
  if (fasad === 'tidak') {
    temuan.push(`**Foto Sampul (Cover Photo) Belum Menampilkan Plang Nama/Logo:** Foto utama belum menampilkan papan nama atau logo '${nama}' pada bagian fasad depan. Galeri perlu dilengkapi dengan foto tampak depan yang memperlihatkan identitas merek secara jelas agar memudahkan pelanggan mengenali lokasi.`);
  }

  /* 5. nama profil */
  if (statusNamaKataKunci(a) === 'tidak') {
    const kw = layananList.length ? gabungDan(layananList.slice(0, 2).map((x) => x)) : utama || 'layanan inti';
    temuan.push(`**Nama Profil Belum Memuat Frasa Layanan Utama:** Nama profil saat ini ('${nama}') belum memuat kata kunci layanan inti seperti ${kw}. Penambahan kata kunci layanan dapat dipertimbangkan untuk memperkuat relevansi pencarian, dengan syarat frasa tersebut memang tercantum resmi pada papan nama fisik di depan lokasi sesuai pedoman Google.`);
  }

  /* 6. kelengkapan fitur pendukung */
  const tidak = [];
  const tanya = [];
  CEK_ITEMS.forEach((it) => {
    if (it.k === 'fasad') {
      if (fasad === '?') tanya.push(it.label);
      return;
    }
    const st = statusCek(a, it.k);
    if (st === 'tidak') tidak.push(it.label);
    else if (st === '?') tanya.push(it.label);
  });
  if (tidak.length || tanya.length) {
    let t;
    if (tidak.length && tanya.length) t = `Kolom ${gabungDan(tidak)} belum terisi, sedangkan ${gabungDan(tanya)} perlu dipastikan terisi lengkap agar profil tampil kredibel dan mudah dikonversi.`;
    else if (tidak.length) t = `Kolom ${gabungDan(tidak)} belum terisi. Lengkapi agar profil tampil kredibel dan mudah dikonversi.`;
    else t = `Kolom ${gabungDan(tanya)} perlu dipastikan terisi lengkap agar profil tampil kredibel dan mudah dikonversi.`;
    temuan.push(`**Kelengkapan Fitur Pendukung (Website, Sosmed & Layanan):** ${t}`);
  }

  if (!temuan.length) {
    temuan.push('**Profil Sudah Baik:** Tidak ditemukan kekurangan utama pada data yang diperiksa. Pertahankan konsistensi ulasan, foto terbaru, dan Google Posts.');
  }

  /* ----- proyeksi ulasan ----- */
  const adj = r == null ? 'perlu dievaluasi' : r >= 4.8 ? 'sangat baik' : r >= 4.5 ? 'baik' : r >= 4.0 ? 'cukup baik' : 'perlu ditingkatkan';
  const proyeksiIntro = (r == null ? `Dengan ${u} ulasan saat ini` : `Dengan modal rating ${rs} dari ${u} ulasan awal`) +
    `, profil ${nama} memiliki kepuasan pelanggan yang ${adj}. Untuk mendominasi pencarian lokal di wilayah ${area}, berikut proyeksi penambahan ulasan yang direkomendasikan:`;

  const layananSebut = layananList.length ? ` (${layananList.slice(0, 4).join(', ')})` : '';
  const kondisi = u < 20 ? 'Volume ulasan masih terlalu kecil untuk area komersial ramai.' : u < 50 ? 'Volume ulasan masih perlu diperbanyak.' : u < 100 ? 'Volume ulasan cukup, perlu dijaga konsisten.' : 'Volume ulasan sudah kuat, jaga konsistensi.';
  const ratingAwal = r == null ? 'Baseline saat ini' : `Rating ${rs}. ${kondisi}`;
  const ratingTarget = r != null && r >= 4.9 ? 'Pertahankan 4,9 - 5,0' : 'Naikkan & jaga di 4,8 - 5,0';
  const proyeksi = [
    `Kondisi Awal | ${u} Ulasan // (Rating ${r == null ? '-' : rs}) | Baseline saat ini | ${ratingAwal}`,
    `Jangka Menengah // (Bulan 1 - 3) | ${P.lo} – ${P.hi} Ulasan // (+${P.lo - u} s.d. ${P.hi - u} ulasan) | ${P.vLo} – ${P.vHi} ulasan / bulan // (Bertahap & alami) | Ulasan menyebut layanan spesifik${layananSebut} & hasil pengerjaan.`,
    `Jangka Panjang // (Bulan 4 - 6+) | ${P.lo2} – ${P.hi2}+ Ulasan // (${ratingTarget}) | ${P.vLo} – ${P.vHi} ulasan / bulan // (Konsisten) | Kombinasi ulasan teks detail, foto hasil layanan, serta balasan admin.`,
  ].join('\n');

  /* ----- rekomendasi ----- */
  const saran = saranKategori(utama);
  const rek = [];
  if (nCat <= 2) {
    rek.push(`**Penambahan Kategori Sekunder & Daftar Layanan (Services)** — Pertahankan '${utama || 'kategori utama'}' sebagai kategori utama, lalu tambahkan kategori sekunder sesuai dengan kompetitor${saran.length ? ` (misalnya ${gabungAtau(saran)})` : ''}. Lengkapi menu Layanan (Services) dengan paket detail yang dimiliki agar tampil di Google Maps.`);
  } else {
    rek.push('**Rapikan Kategori & Daftar Layanan (Services)** — Kategori sudah cukup lengkap. Pastikan menu Layanan (Services) memuat paket detail beserta deskripsi dan harga agar profil makin relevan.');
  }
  if (statusCek(a, 'website') === 'ya' && statusCek(a, 'sosmed') === 'ya') {
    rek.push('**Pertahankan Situs Web & Profil Sosial Media** — Pastikan tautan website atau reservasi WhatsApp serta akun Instagram/TikTok tetap aktif dan rutin menampilkan portofolio terbaru.');
  } else {
    rek.push('**Pengisian Situs Web & Profil Sosial Media** — Tautkan website resmi atau link reservasi WhatsApp pada kolom Situs Web, serta hubungkan akun Instagram dan TikTok resmi untuk menampilkan portofolio hasil pengerjaan.');
  }
  rek.push(`**Pembaruan Galeri Foto** — Unggah foto tampak depan yang memperlihatkan plang nama/logo ${nama === 'bisnis ini' ? 'bisnis' : nama} dengan jelas, ditambah foto proses layanan, suasana tempat, dan hasil akhir.`);
  rek.push(`**Peningkatan Ulasan Bertahap & Respon Ulasan** — Jalankan penambahan ulasan secara alami sebanyak ${P.vLo}–${P.vHi} ulasan per bulan hingga menembus ${P.lo2}+ ulasan, serta pastikan setiap ulasan yang masuk dibalas dengan bahasa ramah.`);
  if (r != null && r < 4.5) {
    rek.push('**Perbaikan Rating** — Tinjau keluhan yang berulang pada ulasan rendah, balas secara profesional, dan minta pelanggan yang puas memberi ulasan agar rating naik ke 4,5 ke atas.');
  }
  rek.push(`**Publikasi Google Posts & Deskripsi Teroptimasi** — Isi deskripsi bisnis (maks. 750 karakter) dengan kata kunci relevan area ${area}, serta rutin unggah Google Posts berisi informasi dan promo bisnis ini.`);

  const catatan = `Seluruh rekomendasi di atas disusun mengacu pada pedoman resmi Google Business Profile guna meningkatkan visibilitas pencarian lokal di ${area} secara aman dan berkelanjutan.`;

  return { temuan: temuan.join('\n'), proyeksiIntro, proyeksi, rekomendasi: rek.join('\n'), catatan };
}

/** Isi blok teks yang belum diedit manual dengan hasil audit otomatis. */
function terapkanOtomatis(a, paksa) {
  const hasil = susunAudit(a);
  a.manual = a.manual || {};
  Object.keys(hasil).forEach((k) => {
    if (paksa || !a.manual[k]) a[k] = hasil[k];
    if (paksa) a.manual[k] = false;
  });
  return a;
}

/* -------------------------------------------------- struktur untuk cetak */
/** "**Label:** isi" otomatis jika autoBold aktif dan baris belum ditebalkan; "~ " = biasa. */
function barisRich(line, autoBold, pemisah, fmt) {
  let l = String(line).trim();
  if (/^~\s+/.test(l)) return l.replace(/^~\s+/, '');
  if (autoBold && !l.includes('**')) {
    const m = pemisah.exec(l);
    if (m) l = fmt(m);
  }
  return l;
}

function bangunAudit(a, s) {
  s = s || {};
  const autoBold = a.autoBold !== false;
  const cats = kategoriSemua(a);
  const r = parseRating(a.rating);
  const u = jmlUlasan(a.ulasan);
  const baris = (t) => String(t || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);

  let kategoriTeks;
  let kategoriWarn = false;
  if (!cats.length) kategoriTeks = '-';
  else if (cats.length === 1) {
    kategoriTeks = `Hanya 1 Kategori: ${cats[0]} (Perlu Penambahan Kategori Sekunder)`;
    kategoriWarn = true;
  } else kategoriTeks = `${cats.length} Kategori: ${cats.join(', ')}`;

  const info = [
    ['Nama Profil Bisnis', a.nama || '-', false],
    ['Alamat Terdaftar', a.alamat || '-', false],
    ['Performa Rating & Ulasan', r == null && !u ? '-' : `${r == null ? '-' : ratingStr(r)} Bintang (${u} Ulasan)`, false],
    ['Kategori Terdeteksi', kategoriTeks, kategoriWarn],
  ];

  return {
    kop: { perusahaan: s.perusahaan || '', alamat1: s.alamat1 || '', alamat2: s.alamat2 || '', telepon: (s.telepon || [])[0] || '', website: s.website || '' },
    nama: a.nama || 'Nama Bisnis',
    info,
    temuan: baris(a.temuan).map((l) => barisRich(l, autoBold, /^([^:*\n]{3,80}):\s+(.+)$/, (m) => `**${m[1]}:** ${m[2]}`)),
    proyeksiIntro: String(a.proyeksiIntro || '').trim(),
    proyeksiHead: ['Tahap Target', 'Target Jumlah Ulasan', 'Kecepatan Ideal (Velocity)', 'Fokus & Standar Kualitas'],
    proyeksi: baris(a.proyeksi).map((l) => l.split('|').map((c) => c.trim())),
    rekomendasi: baris(a.rekomendasi).map((l) => barisRich(l.replace(/^\d+\.\s+/, ''), autoBold, /^([^—\n]{3,100}?)\s+—\s+(.+)$/, (m) => `**${m[1]}** — ${m[2]}`)),
    catatan: String(a.catatan || '').trim(),
  };
}

module.exports = { CEK_ITEMS, auditBaru, susunAudit, terapkanOtomatis, bangunAudit, hitungProyeksi, kategoriSemua, parseRating, ratingStr, jmlUlasan, saranKategori };
