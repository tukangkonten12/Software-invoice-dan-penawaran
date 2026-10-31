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
  console.log('✓ invoice html\nSemua tes lulus.');
})().catch((e) => { console.error(e); process.exit(1); });
