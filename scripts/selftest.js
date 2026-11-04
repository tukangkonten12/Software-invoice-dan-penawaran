'use strict';
// Tes mandiri tanpa Electron: memastikan hitungan & pembuatan DOCX benar. Jalankan: npm test
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const F = require('../src/core/format');
const { TEMPLATES, DEFAULT_SETTINGS: S } = require('../src/core/templates');
const { bangunPenawaran } = require('../src/core/model');
const { buatDocx } = require('../src/core/render-docx');
const { invoiceHtml, penawaranHtml } = require('../src/core/render-html');

// 1) Invoice contoh INV-377 harus menghasilkan Rp 7.300.000
const c = F.hitungInvoice({
  taxPct: 0,
  items: [
    { desc: 'Jasa SEO Junior', qty: '1', price: 4000000 },
    { desc: 'Budget iklan google Ads', qty: '30', price: 100000 },
    { desc: 'Fee jasa pengelolaan iklan', qty: '10%', price: 3000000 },
  ],
});
assert.strictEqual(c.sub, 7300000);
assert.strictEqual(c.grand, 7300000);
assert.strictEqual(F.rupiah(c.grand), 'Rp. 7.300.000');
assert.strictEqual(F.tanggalID('2026-10-30'), '30 Oktober 2026');
console.log('✓ hitungan invoice');

// 1b) Diskon per baris & diskon total
const d1 = F.hitungInvoice({
  taxPct: 0,
  items: [
    { desc: 'A', qty: '2', price: 1000000, disc: '10%' },      // 2.000.000 - 200.000 = 1.800.000
    { desc: 'B', qty: '1', price: 500000, disc: '50.000' },    // 450.000
    { desc: 'C', qty: '1', price: 100000, disc: '999999999' }, // dibatasi maksimal sebesar harga -> 0
  ],
  discTotal: '5%',
});
assert.strictEqual(F.totalBaris({ qty: '2', price: 1000000, disc: '10%' }), 1800000);
assert.strictEqual(d1.sub, 2250000);
assert.strictEqual(d1.diskonTotal, 112500);
assert.strictEqual(d1.grand, 2137500);
// diskon total nominal + PPN dihitung SETELAH diskon
const d2 = F.hitungInvoice({ taxPct: 11, discTotal: '100.000', items: [{ desc: 'A', qty: '1', price: 1000000 }] });
assert.strictEqual(d2.afterDisc, 900000);
assert.strictEqual(d2.tax, 99000);
assert.strictEqual(d2.grand, 999000);
// tanpa field diskon (data lama) hasilnya tidak berubah
assert.strictEqual(F.hitungInvoice({ items: [{ desc: 'A', qty: '1', price: 1000 }] }).grand, 1000);
// persen > 100 dibatasi 100
assert.strictEqual(F.hitungDiskon('150%', 1000), 1000);
console.log('✓ diskon');

// 2) Setiap template menghasilkan HTML & DOCX
const assets = path.join(__dirname, '..', 'assets');
const files = fs.readdirSync(path.join(assets, 'portfolio')).sort();
(async () => {
  for (const t of TEMPLATES) {
    const d = {
      tanggal: '2026-10-30', kota: S.kota, klien: 'Klien Uji', perihal: t.perihal, intro: t.intro,
      telepon: S.telepon[t.telepon], penandatangan: S.penandatangan[t.penandatangan], vars: t.vars,
      tables: t.tables, sections: t.sections, penutup: t.penutup, pembayaran: t.pembayaran, portofolio: t.portofolio,
    };
    const m = bangunPenawaran(d, S);
    assert(penawaranHtml(m, 'file:///x', files).includes('Klien Uji'));
    const buf = await buatDocx(m, assets, files);
    assert(buf.length > 5000 && buf.slice(0, 2).toString() === 'PK');
    console.log('✓ template', t.id);
  }
  assert(invoiceHtml({ nomor: '1/MHK/26', tanggal: '2026-10-30', klien: 'X', items: [{ desc: 'a', qty: '1', price: 1000 }] }, S, 'file:///x').includes('Rp. 1.000'));
  const hd = invoiceHtml({ nomor: '2/MHK/26', tanggal: '2026-10-30', klien: 'X', discTotal: '10%', items: [{ desc: 'a', qty: '1', price: 100000, disc: '10%' }] }, S, 'file:///x');
  assert(hd.includes('<th>Disc</th>') && hd.includes('Diskon (10%)') && hd.includes('RP. 81.000') && hd.includes('- Rp. 9.000'));
  console.log('✓ invoice html\nSemua tes lulus.');
})().catch((e) => { console.error(e); process.exit(1); });
