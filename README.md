# MHK Dokumen — Pembuat Invoice & Penawaran Otomatis

Aplikasi desktop untuk **Windows** dan **Mac** milik PT. Memudahkan Hidup Kamu.

- **Invoice** (1 template) → hasil **PDF**, nomor otomatis (`378/MHK/26`), total & fee % dihitung sendiri.
- **Penawaran** (4 template) → hasil **PDF** atau **Word (.docx)** yang tetap bisa diedit.
  1. Website, Google Ads & SEO
  2. Google Ads / Meta Ads
  3. Maintenance Google Maps
  4. Optimasi Google Maps (Multi Titik & Paket 6/12 bulan)
- **Riwayat** semua dokumen (cari, buka & edit, duplikat, status Lunas/Terkirim/Deal).
- **Pengaturan**: kop surat, nomor telepon, rekening, penandatangan, layanan tersimpan, nomor invoice berikutnya.

Semua data tersimpan **di komputer sendiri** (tanpa internet, tanpa akun).

---

## Cara memakai (sehari-hari)

**Invoice**
1. Menu *Invoice Baru* → isi nama klien.
2. Isi layanan, Qty, dan Harga. Total terhitung otomatis.
   - Untuk fee persen, isi Qty dengan `10%` (atau klik **+ Fee pengelolaan iklan (%)**; harganya otomatis mengikuti total baris yang berisi kata "budget").
   - Layanan yang sering dipakai bisa disimpan di *Pengaturan* dan dipilih lewat menu "Tambah dari layanan tersimpan".
3. **Diskon** (opsional):
   - *Per baris*: isi kolom **Diskon** di baris layanan, bisa persen (`10%`) atau nominal (`50.000`).
   - *Total keseluruhan*: isi **Diskon total** di bawah tabel (`10%` atau `100.000`). Dihitung dari Sub Total, **sebelum** PPN.
   - Kolom Disc dan baris Diskon hanya muncul di PDF jika diisi.
4. Klik **Simpan PDF**. Nomor invoice berikutnya naik sendiri.

**Penawaran**
1. Menu *Penawaran Baru* → pilih salah satu dari 4 template.
2. Isi nama klien. Harga, isi paragraf, dan kebutuhan klien bisa diubah langsung; pratinjau di kanan ikut berubah.
3. Klik **Simpan PDF** atau **Simpan Word (.docx)**.

Aturan penulisan di kotak isi penawaran:
| Tulis | Hasil |
|---|---|
| `Kebutuhan Kami:` (baris biasa) | judul tebal |
| `- teks` | poin (bullet) |
| `1. Judul` | judul bernomor tebal |
| `**tebal**` | teks tebal |
| `{klien}` `{platform}` `{fee}` `{kontrak}` | otomatis diganti isian |

---

## Membuat file instalasi (.exe dan .dmg)

Hasil build Windows harus dibuat di Windows, dan hasil Mac harus dibuat di Mac. Ada dua cara:

### Cara A — Otomatis lewat GitHub (disarankan, tanpa perlu punya Mac)
1. Buat repository baru di GitHub, unggah isi folder ini.
2. Buka tab **Actions → "Build aplikasi (Windows & Mac)" → Run workflow**.
3. Setelah selesai (± 5–10 menit), unduh **installer-windows-latest** (`.exe`) dan **installer-macos-latest** (`.dmg`) dari bagian *Artifacts*.

### Cara B — Manual di masing-masing komputer
Pasang [Node.js](https://nodejs.org) (versi LTS), lalu di folder ini:
```bash
npm install
npm start          # menjalankan aplikasi untuk dicoba
npm run dist:win   # di Windows  -> dist/MHK Dokumen Setup 1.0.0.exe
npm run dist:mac   # di Mac      -> dist/MHK Dokumen-1.0.0.dmg (Intel & Apple Silicon)
```

### Catatan saat pertama kali membuka
- **Windows**: jika muncul "Windows protected your PC", klik *More info → Run anyway* (aplikasi belum bertanda tangan digital).
- **Mac**: jika muncul "tidak dapat dibuka karena pengembang tidak dikenal", klik kanan aplikasi → *Open* → *Open*.
  (Menghilangkan peringatan ini sepenuhnya membutuhkan akun Apple Developer berbayar dan sertifikat code-signing.)

---

## Mengubah template / tampilan

| Ingin mengubah | Edit file |
|---|---|
| Teks bawaan 4 penawaran, harga bawaan, nomor telepon bawaan | `src/core/templates.js` |
| Tampilan invoice & PDF penawaran | `src/core/render-html.js` |
| Tampilan file Word | `src/core/render-docx.js` |
| Logo / gambar portofolio | `assets/logo.png`, `assets/portfolio/` |

Gambar di `assets/portfolio/` otomatis dipasang 2 kolom pada penawaran yang mencentang "Sertakan lampiran portofolio" (urut nama file).

## Lokasi data
Riwayat & pengaturan disimpan di folder data aplikasi (tombol **Pengaturan → Buka folder data**):
`settings.json` dan `history.json`. Salin dua file ini untuk memindahkan data ke komputer lain.
Hasil PDF/Word secara bawaan disimpan di `Documents/MHK Dokumen`.
