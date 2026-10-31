'use strict';
// 4 template penawaran + pengaturan bawaan perusahaan.
// Teks boleh berisi {klien}, {platform}, {fee}, {kontrak} -> diganti otomatis saat dokumen dibuat.

const DEFAULT_SETTINGS = {
  perusahaan: 'PT. Memudahkan Hidup Kamu',
  alamat1: 'Jl. Soekarno Hatta No.12, Puri Asri, Kec. Pedurungan,',
  alamat2: 'Kota Semarang, Jawa Tengah 50246',
  website: 'MHK.co.id',
  kota: 'Semarang',
  telepon: ['0812-9879-8125', '0811-1889-3215'],
  bank: { nama: 'BCA', rekening: '833-1455555', atasNama: 'MEMUDAHKAN HIDUP KAMU PT' },
  penandatangan: [
    { nama: 'Anas Ghina', jabatan: 'Customer Service' },
    { nama: 'Nanas', jabatan: 'Customer Service' },
    { nama: 'Anas Ghina', jabatan: 'Sales' },
  ],
  invoice: {
    prefix: 'MHK',
    nomorBerikutnya: 378,
    domain: 'mhk.co.id',
    footerTelepon: '0811-2653-576',
    footerAlamat: 'Soekarno Hatta No.12, Puri Asri',
    ppnBawaan: 0,
  },
  layanan: [
    { desc: 'Jasa SEO Junior', price: 4000000 },
    { desc: 'Jasa SEO Senior', price: 13000000 },
    { desc: 'Paket SEO Reguler', price: 5000000 },
    { desc: 'Budget iklan google Ads', price: 100000 },
    { desc: 'Optimasi Google Maps (1 titik)', price: 550000 },
  ],
};

const ADS_LAYANAN = `- Riset kata kunci (keyword research) untuk target relevan.
- Pembuatan campaign & ad group sesuai tujuan (brand awareness, traffic, leads, dan sales).
- Optimasi iklan (CPC, CTR, konversi).
- Monitoring & laporan bulanan performa iklan (impressions, clicks, cost per click, conversions).
- Konsultasi strategi digital marketing untuk peningkatan hasil.`;

const ADS_KEBUTUHAN = `Kebutuhan dari Klien:
- Akses admin/manager ke akun Google Ads dan Google Analytics (jika ada).
- Data bisnis terbaru (produk/jasa, kontak, alamat, website/landing page).
- Konten pendukung (gambar, video, promo, testimoni, dll).
- Ketersediaan untuk meeting evaluasi 1x setiap bulan.`;

const MAPS_BASE = `Benefit Layanan yang Kami Tawarkan:
1. Fokus Optimasi 1 Kata Kunci Utama
- Analisis kata kunci utama yang paling potensial berdasarkan volume pencarian dan relevansi lokal.
- Penempatan kata kunci secara strategis di deskripsi, dan postingan Maps.
2. Riset 3 Kata Kunci Turunan
- Identifikasi kata kunci pendukung untuk menjangkau audiens yang lebih luas.
- Pengujian performa kata kunci untuk menentukan mana yang paling efektif.
3. Optimasi Profil & Deskripsi Maps
- Penulisan ulang deskripsi dengan pendekatan SEO lokal.
- Penambahan kategori, atribut, dan foto agar profil lebih menarik dan lengkap.
4. Manajemen Aktivitas & Review Akun
- Upload rutin foto/video dan postingan setiap hari.
- Monitoring dan tanggapan ulasan pelanggan agar akun terlihat aktif.
%EXTRA1%- Pemantauan insight Google (klik, arah, telepon) untuk evaluasi bulanan.
%EXTRA2%5. Laporan Bulanan Performa Google Maps
- Insight jumlah tayangan, interaksi, arah, telepon, dan posisi ranking.
- Evaluasi progres dan saran pengembangan bulan berikutnya.`;

const MAPS_BASIC = MAPS_BASE.replace('%EXTRA1%', '').replace('%EXTRA2%', '');
const MAPS_FULL = MAPS_BASE.replace('%EXTRA1%', '- Mereport review buruk yang dilakukan oleh competitor/pelanggan.\n').replace(
  '%EXTRA2%',
  '- Memberikan citation di platform yang sudah ditentukan dan disediakan pengelola.\n'
);

const MAPS_KEBUTUHAN = `Kebutuhan Kami:
- Akses admin atau manager ke akun Google Business Profile (Google Maps).
- **Informasi bisnis terbaru:** Nama, alamat, nomor telepon, jam operasional.
- **Foto dan video pendukung:** Kondisi interior, eksterior, staf, layanan, dan sebagainya.
- Konten pendukung seperti promo, event, atau testimoni.
- Bersedia meeting report jika diperlukan.`;

const PENUTUP_UMUM = (strategi) =>
  `Kami yakin layanan kami dapat membantu **{klien}** untuk meningkatkan kunjungan pelanggan serta memperkuat branding di dunia digital.\nApabila Anda tertarik dengan penawaran ini, kami siap untuk membangun strategi ${strategi} yang paling sesuai untuk bisnis Anda.`;

const calcHeaders = ['Jasa', 'Harga Unit*', 'Qty', 'Total**'];

const TEMPLATES = [
  {
    id: 'website_ads_seo',
    nama: 'Website, Google Ads & SEO',
    deskripsi: 'Tabel harga Google Ads (fee %) + paket SEO Senior/Reguler, lengkap dengan sistem pembayaran.',
    telepon: 0,
    penandatangan: 0,
    vars: { fee: '25' },
    varLabels: { fee: 'Fee pengelolaan iklan (%)' },
    perihal: 'Penawaran Jasa Google Ads dan Optimasi SEO',
    intro: 'Kami, **MHK.co.id**, dengan ini menawarkan jasa layanan Google Ads dan optimasi SEO untuk bisnis **{klien}** sebagai berikut:',
    tables: [
      {
        enabled: true,
        title: 'Detail harga Google Ads',
        mode: 'simple',
        headers: ['Jasa', 'Qty', 'Harga'],
        rows: [
          ['Budget Iklan Google Ads', '1', 'Sesuai budget harian klien*'],
          ['Jasa Pengelolaan Iklan', '1', '{fee}%**'],
        ],
        totalText: 'Budget iklan + {fee}%',
        notes: '*Budget harian disepakati langsung bersama klien sesuai kebutuhan\n**Jasa kelola sudah termasuk dengan PPN platform iklan',
      },
      {
        enabled: true,
        title: 'Detail harga SEO',
        mode: 'simple',
        headers: ['Jasa', 'Qty', 'Harga'],
        rows: [
          ['Paket SEO Senior', '1*', '13000000'],
          ['Paket SEO Reguler', '1**', '5000000'],
        ],
        totalText: '',
        notes:
          '*Dikelola dan dioptimasi secara eksklusif langsung oleh Owner/Mentor\n**Dikelola dan dioptimasi oleh Tim SEO kami dengan standar pengerjaan yang terukur.\n***Harga paket SEO dibayarkan per-bulan',
      },
    ],
    sections: [
      { id: 'ads', label: 'Layanan Google Ads', text: 'Layanan yang Kami Tawarkan:\n1. Jasa Google Ads:\n' + ADS_LAYANAN },
      { id: 'ads_k', label: 'Kebutuhan dari klien (Google Ads)', text: ADS_KEBUTUHAN },
      {
        id: 'seo',
        label: 'Layanan SEO',
        text: `2. Jasa Optimasi SEO:
- **Riset & Pemetaan Kata Kunci:** Menargetkan kata kunci utama **yang disepakati bersama klien** beserta kata kunci turunan yang potensial mendatangkan calon pelanggan.
- **Optimasi On-Page:** Pengaturan judul (Meta Title), deskripsi (Meta Description), heading, dan konten artikel yang dioptimalkan khusus untuk kata kunci target.
- **Link Building Berkala (Backlink Bulanan):** Penanaman backlink berkualitas secara rutin setiap bulan untuk mendongkrak otoritas domain dan peringkat website di halaman pertama Google.
- **Setup Alat Analitik:** Pemasangan Google Search Console dan Google Analytics untuk memantau performa serta lalu lintas pengunjung website.
- **Laporan Bulanan & Konsultasi:** Laporan berkala mengenai kenaikan posisi ranking kata kunci serta strategi digital marketing untuk meningkatkan konversi penjualan setiap 2 minggu sekali.`,
      },
      {
        id: 'seo_k',
        label: 'Kebutuhan kami (SEO)',
        text: `Kebutuhan Kami:
- Akses login sebagai Administrator untuk melakukan optimasi teknis dan on-page langsung di website.
- **Akses Google Search Console & Google Analytics (Jika Sudah Ada):** Akses pengelola atau izin berbagi data (permissions) apabila klien sebelumnya sudah pernah membuat alat analitik tersebut.`,
      },
    ],
    penutup:
      'Kami yakin layanan kami dapat membantu **{klien}** untuk meningkatkan kunjungan pelanggan serta memperkuat branding di dunia digital.\nApabila Anda tertarik dengan penawaran ini, kami siap untuk membangun strategi SEO yang paling sesuai untuk bisnis Anda.',
    pembayaran: true,
    portofolio: false,
  },

  {
    id: 'ads',
    nama: 'Google Ads / Meta Ads',
    deskripsi: 'Penawaran jasa kelola iklan: budget klien + fee % dengan minimal kontrak. Ada opsi portofolio.',
    telepon: 0,
    penandatangan: 2,
    vars: { platform: 'Google Ads', fee: '20', kontrak: '3' },
    varLabels: { platform: 'Platform iklan', fee: 'Fee pengelolaan iklan (%)', kontrak: 'Minimal kontrak (bulan)' },
    perihal: 'Penawaran Jasa Layanan {platform}',
    intro: 'Kami, **MHK.co.id**, dengan ini menawarkan jasa layanan {platform} untuk bisnis **{klien}** sebagai berikut:',
    tables: [
      {
        enabled: true,
        title: '',
        mode: 'simple',
        headers: ['Jasa', 'Qty', 'Harga'],
        rows: [
          ['Budget Iklan {platform}', '1', 'Sesuai budget harian klien*'],
          ['Jasa pengelolaan iklan', '-', '{fee}% dari total budget iklan per bulan'],
        ],
        totalText: 'Budget iklan + {fee}% biaya jasa',
        notes: '*Budget harian ditentukan langsung oleh klien sesuai kebutuhan\n**Minimal kontrak iklan {kontrak} bulan.',
      },
    ],
    sections: [
      { id: 'layanan', label: 'Layanan yang ditawarkan', text: 'Layanan yang Kami Tawarkan:\n' + ADS_LAYANAN },
      { id: 'kebutuhan', label: 'Kebutuhan dari klien', text: ADS_KEBUTUHAN },
    ],
    penutup: PENUTUP_UMUM('iklan'),
    pembayaran: true,
    portofolio: true,
  },

  {
    id: 'maintenance',
    nama: 'Maintenance Google Maps',
    deskripsi: 'Optimasi & maintenance Google Maps dengan satu harga bulanan, kontrak 12 bulan, total otomatis.',
    telepon: 0,
    penandatangan: 1,
    vars: { kontrak: '12' },
    varLabels: { kontrak: 'Lama kontrak (bulan)' },
    perihal: 'Penawaran Jasa Optimasi dan Maintenance Google Maps',
    intro: 'Kami, **MHK.co.id**, dengan ini menawarkan jasa layanan optimasi dan maintenance Google Maps untuk **{klien}** sebagai berikut:',
    tables: [
      {
        enabled: true,
        title: '',
        mode: 'calc',
        headers: calcHeaders,
        rows: [{ jasa: 'Optimasi dan Maintenance Google Maps', harga: 550000, qty: 1 }],
        showTotal: true,
        notes:
          '*Harga unit adalah fee yang harus dibayarkan setiap bulan untuk 1 titik maps\n**Kontrak maintenance & optimasi dalam penawaran ini berlaku kontrak {kontrak} bulan.',
      },
    ],
    sections: [
      { id: 'benefit', label: 'Benefit layanan', text: MAPS_BASIC },
      { id: 'kebutuhan', label: 'Kebutuhan kami', text: MAPS_KEBUTUHAN },
    ],
    penutup: PENUTUP_UMUM('maintenance'),
    pembayaran: false,
    portofolio: true,
  },

  {
    id: 'maps_multi',
    nama: 'Optimasi Google Maps (Multi Titik & Paket)',
    deskripsi: 'Dua tabel harga: 1 titik dan banyak titik, masing-masing paket 6 dan 12 bulan.',
    telepon: 1,
    penandatangan: 1,
    vars: {},
    varLabels: {},
    perihal: 'Penawaran Jasa Optimasi Google Maps',
    intro: 'Kami, **MHK.co.id**, dengan ini menawarkan jasa layanan optimasi dan maintenance Google Maps untuk **{klien}** sebagai berikut:',
    tables: [
      {
        enabled: true,
        title: '1. Detail harga untuk 1 titik maps',
        mode: 'calc',
        headers: calcHeaders,
        rows: [
          { jasa: 'Optimasi Google Maps Paket 6 Bulan', harga: 700000, qty: 1 },
          { jasa: 'Optimasi Google Maps Paket 12 Bulan', harga: 550000, qty: 1 },
        ],
        showTotal: false,
        notes: '*Harga unit adalah fee yang harus dibayarkan setiap bulan untuk 1 titik maps\n**Harga yang harus dibayarkan untuk 1 lokasi maps disetiap bulan',
      },
      {
        enabled: true,
        title: '2. Detail harga untuk 12 titik maps',
        mode: 'calc',
        headers: calcHeaders,
        rows: [
          { jasa: 'Optimasi Google Maps Paket 6 Bulan', harga: 450000, qty: 12 },
          { jasa: 'Optimasi Google Maps Paket 12 Bulan', harga: 300000, qty: 12 },
        ],
        showTotal: false,
        notes: '*Harga unit adalah fee yang harus dibayarkan setiap bulan untuk 1 titik maps\n**Harga yang harus dibayarkan untuk 12 lokasi maps disetiap bulan',
      },
    ],
    sections: [
      { id: 'benefit', label: 'Benefit layanan', text: MAPS_FULL },
      { id: 'kebutuhan', label: 'Kebutuhan kami', text: MAPS_KEBUTUHAN },
    ],
    penutup: PENUTUP_UMUM('maintenance'),
    pembayaran: false,
    portofolio: false,
  },
];

module.exports = { DEFAULT_SETTINGS, TEMPLATES };
