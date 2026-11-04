'use strict';
const F = require('./format');
const { esc } = F;

const AMBER = '#EBAB4C';
const BROWN = '#AF6900';

const richHtml = (text) => F.runs(text).map((r) => (r.b ? `<b>${esc(r.t)}</b>` : esc(r.t))).join('');

function fontFaces(assets) {
  const f = (fam, w, file) =>
    `@font-face{font-family:'${fam}';font-weight:${w};src:url('${assets}/fonts/${file}') format('woff2');}`;
  return [
    f('Open Sans', 400, 'open-sans-latin-400-normal.woff2'),
    f('Open Sans', 600, 'open-sans-latin-600-normal.woff2'),
    f('Open Sans', 700, 'open-sans-latin-700-normal.woff2'),
    f('Poppins', 400, 'poppins-latin-400-normal.woff2'),
    f('Poppins', 600, 'poppins-latin-600-normal.woff2'),
    f('Poppins', 700, 'poppins-latin-700-normal.woff2'),
  ].join('\n');
}

/* ------------------------------------------------------------------ INVOICE */

function invoiceHtml(inv, s, assets) {
  const c = F.hitungInvoice(inv);
  const bank = s.bank || {};
  const cfg = s.invoice || {};
  const hasDisc = c.items.some((it) => F.diskonBaris(it) > 0);
  const extraSum = c.diskonTotal > 0 ? 1 : 0; // baris diskon di ringkasan memakai ruang 1 baris tabel
  const MIN_ROWS = 8 - extraSum;
  const total = Math.max(MIN_ROWS, c.items.length + 1);
  const emptyCells = hasDisc ? 6 : 5;
  let rows = '';
  for (let i = 0; i < total; i++) {
    const it = c.items[i];
    const cls = i % 2 === 1 ? 'alt' : '';
    if (it) {
      const q = String(it.qty == null ? '' : it.qty).trim();
      const dv = F.diskonBaris(it);
      const discCell = hasDisc ? `<td class="r">${dv > 0 ? F.rupiah(dv) : '-'}</td>` : '';
      rows += `<tr class="${cls}"><td class="c">${i + 1}</td><td>${esc(it.desc)}</td><td class="c">${esc(q)}</td><td class="r">${F.rupiah(F.parseAngka(it.price))}</td>${discCell}<td class="r">${F.rupiah(F.totalBaris(it))}</td></tr>`;
    } else {
      rows += `<tr class="${cls}"><td>&nbsp;</td>${'<td></td>'.repeat(emptyCells - 1)}</tr>`;
    }
  }
  const dt = String(inv.discTotal == null ? '' : inv.discTotal).trim();
  const discLabel = F.isPersen(dt) ? `Diskon (${dt.replace(/\s+/g, '').replace('.', ',')}) :` : 'Diskon :';
  const discRow = c.diskonTotal > 0
    ? `<div><span class="l">${esc(discLabel)}</span><span class="v">- ${F.rupiah(c.diskonTotal)}</span></div>`
    : '';
  const colgroup = hasDisc
    ? '<colgroup><col style="width:5%"><col style="width:29%"><col style="width:10%"><col style="width:19%"><col style="width:17%"><col style="width:20%"></colgroup>'
    : '<colgroup><col style="width:5.1%"><col style="width:36.1%"><col style="width:17.9%"><col style="width:22.2%"><col style="width:18.7%"></colgroup>';
  const head = hasDisc
    ? '<th>No</th><th>Description</th><th>Qty</th><th>Price</th><th>Disc</th><th>Total</th>'
    : '<th>No</th><th>Description</th><th>Qty</th><th>Price</th><th>Total</th>';
  const taxLabel = c.taxPct ? `Tax (${String(c.taxPct).replace('.', ',')}%) :` : 'Tax :';
  const taxVal = c.taxPct ? F.rupiah(c.tax) : '-';

  return `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${esc(inv.nomor)}</title>
<style>
${fontFaces(assets)}
@page{size:A4;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:210mm;height:297mm}
body{font-family:'Open Sans',Arial,sans-serif;color:#222;font-size:10.5pt;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{position:relative;width:210mm;height:297mm;padding:21mm 21mm 0 21mm;overflow:hidden}
.head{display:flex;align-items:flex-start;justify-content:space-between;position:relative;padding-bottom:3mm;height:30mm}
.brand{display:flex;align-items:center;gap:3mm;margin-top:1.5mm}
.brand img{height:13mm}
.brand span{font-family:Arimo,Arial,Helvetica,sans-serif;font-weight:700;font-size:17.5pt;color:#111}
.title{text-align:right}
.title h1{font-family:'Poppins',sans-serif;font-weight:700;font-size:35pt;color:${AMBER};letter-spacing:.8pt;line-height:1}
.title small{display:block;font-family:'Poppins',sans-serif;font-size:10pt;margin-top:3.5mm;color:#222}
.rule{position:absolute;left:0;right:0;bottom:0;height:1.2mm}
.rule:before{content:'';position:absolute;left:0;right:20mm;top:.5mm;height:.5mm;background:#c8c8c8}
.rule:after{content:'';position:absolute;left:0;width:16mm;top:.2mm;height:1.1mm;background:${BROWN};border-radius:1mm}
.meta{display:flex;justify-content:space-between;margin-top:17mm;font-size:11.5pt}
.meta .to b{display:block;font-size:12pt;margin-top:1.8mm;text-transform:uppercase}
.meta .no{text-align:right}
.meta .no b{display:block;font-size:12pt;margin-bottom:1.8mm}
table.items{width:100%;border-collapse:collapse;margin-top:36mm;font-size:10.5pt;table-layout:fixed}
table.items th{background:${BROWN};color:#fff;font-weight:700;text-transform:uppercase;padding:2mm 2.2mm;font-size:11pt}
table.items td{padding:1.4mm 2.2mm;height:7.4mm;vertical-align:middle;word-wrap:break-word}
table.items tr.alt td{background:${AMBER};color:#3b2600}
table.items tr:not(.alt) td+td{border-left:.6mm solid #b9b9b9}
table.items .c{text-align:center}.r{text-align:right}
table.items th:nth-child(2){text-align:center}
.sum{margin-top:7mm;margin-left:auto;width:50%;font-size:11pt}
.sum div{display:flex;justify-content:flex-end;gap:0;margin-bottom:3.5mm}
.sum .l{width:46%;text-align:right;padding-right:5mm}
.sum .v{width:54%;text-align:right;padding-right:2.2mm;font-size:10.5pt}
.pay{display:flex;justify-content:space-between;margin-top:8mm;align-items:flex-start}
.pm{width:28%;background:${BROWN};color:#fff;font-weight:700;padding:2mm 2.2mm;font-size:11pt;text-transform:uppercase}
.gt{width:45%;background:${BROWN};color:#fff;font-weight:700;padding:2mm 2.2mm;font-size:11pt;display:flex;justify-content:space-between;text-transform:uppercase}
.under{display:flex;justify-content:space-between;align-items:flex-start;margin-top:5.5mm;max-height:26mm;overflow:hidden}
.bank{font-family:Arimo,Arial,Helvetica,sans-serif;font-size:10.5pt;color:#222}
.bank div{display:flex;margin-bottom:3.2mm}
.bank span:first-child{width:28mm}
.note{width:45%;font-family:Arimo,Arial,Helvetica,sans-serif;font-size:9pt;color:#333;line-height:1.35;border-left:.8mm solid ${AMBER};padding-left:3mm}
.note b{display:block;font-size:10pt;margin-bottom:1mm;color:#222}
.note p{white-space:pre-wrap;overflow-wrap:anywhere;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:4;max-height:49pt;overflow:hidden}
.foot{position:absolute;left:21mm;right:21mm;bottom:22mm;font-family:'Poppins',sans-serif;font-size:10pt}
.foot .rule2{position:relative;height:1.2mm;margin-bottom:6mm}
.foot .rule2:before{content:'';position:absolute;left:0;right:0;top:.5mm;height:.5mm;background:#777}
.foot .rule2:after{content:'';position:absolute;left:0;width:16mm;top:.2mm;height:1.1mm;background:${BROWN};border-radius:1mm;box-shadow:calc(168mm - 16mm) 0 0 ${BROWN}}
.foot .row{display:flex;justify-content:center;gap:18mm;align-items:center}
.foot .it{display:flex;align-items:center;gap:2.2mm}
.foot svg{width:6.5mm;height:6.5mm}
</style></head><body><div class="page">
  <div class="head">
    <div class="brand"><img src="${assets}/logo.png"><span>${esc(s.perusahaan)}</span></div>
    <div class="title"><h1>INVOICE</h1><small>${esc(cfg.domain || s.website)}</small></div>
    <div class="rule"></div>
  </div>
  <div class="meta">
    <div class="to">Invoice to :<b>${esc(inv.klien)}</b></div>
    <div class="no"><b>Invoice: ${esc(inv.nomor)}</b>${esc(F.tanggalID(inv.tanggal))}</div>
  </div>
  <table class="items">
    ${colgroup}
    <thead><tr>${head}</tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="sum">
    <div><span class="l">Sub Total :</span><span class="v">${F.rupiah(c.sub)}</span></div>
    ${discRow}
    <div><span class="l">${taxLabel}</span><span class="v">${taxVal}</span></div>
  </div>
  <div class="pay"><div class="pm">Payment Method :</div><div class="gt"><span>Grand Total :</span><span>RP. ${F.angka(c.grand)}</span></div></div>
  <div class="under">
    <div class="bank">
      <div><span>Bank</span><span>: ${esc(bank.nama)}</span></div>
      <div><span>Account</span><span>: ${esc(bank.atasNama)}</span></div>
      <div><span>No. Rekening</span><span>: ${esc(bank.rekening)}</span></div>
    </div>
    ${String(inv.catatan || '').trim() ? `<div class="note"><b>Catatan :</b><p>${esc(String(inv.catatan).trim())}</p></div>` : ''}
  </div>
  <div class="foot"><div class="rule2"></div><div class="row">
    <div class="it"><svg viewBox="0 0 24 24" fill="none" stroke="${AMBER}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg><span>${esc(cfg.footerTelepon)}</span></div>
    <div class="it"><svg viewBox="0 0 24 24" fill="none" stroke="${AMBER}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg><span>${esc(cfg.footerAlamat)}</span></div>
  </div></div>
</div></body></html>`;
}

/* --------------------------------------------------------------- PENAWARAN */

function tabelHtml(t) {
  const n = t.headers.length;
  const cg = t.widths.map((w) => `<col style="width:${w}%">`).join('');
  const th = t.headers.map((h) => `<th>${esc(h)}</th>`).join('');
  const body = t.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('');
  const tot = t.total
    ? `<tr class="tot"><td>${esc(t.total.label)}</td><td colspan="${n - 1}">${esc(t.total.text)}</td></tr>`
    : '';
  const notes = t.notes.length ? `<tr class="notes"><td colspan="${n}">${t.notes.map(esc).join('<br>')}</td></tr>` : '';
  return `${t.title ? `<p class="ttl">${esc(t.title)}</p>` : ''}<table class="price"><colgroup>${cg}</colgroup><thead><tr>${th}</tr></thead><tbody>${body}${tot}${notes}</tbody></table>`;
}

function blokHtml(blocks) {
  let out = '';
  let inList = false;
  for (const b of blocks) {
    if (b.type !== 'bullet' && inList) {
      out += '</ul>';
      inList = false;
    }
    if (b.type === 'bullet') {
      if (!inList) {
        out += '<ul>';
        inList = true;
      }
      out += `<li>${richHtml(b.text)}</li>`;
    } else if (b.type === 'numhead') {
      out += `<p class="nh"><span>${esc(b.num)}.</span><b>${richHtml(b.text)}</b></p>`;
    } else {
      out += `<p class="hd"><b>${richHtml(b.text)}</b></p>`;
    }
  }
  if (inList) out += '</ul>';
  return out;
}

function penawaranHtml(m, assets, portfolioFiles) {
  const kop = m.kop;
  const portfolio = m.portofolio && portfolioFiles && portfolioFiles.length;
  let pf = '';
  if (portfolio) {
    let rows = '';
    for (let i = 0; i < portfolioFiles.length; i += 2) {
      const a = portfolioFiles[i];
      const b = portfolioFiles[i + 1];
      rows += `<div class="prow"><div><img src="${assets}/portfolio/${a}"></div><div>${b ? `<img src="${assets}/portfolio/${b}">` : ''}</div></div>`;
    }
    pf = `<div class="pf"><p class="pft">PORTOFOLIO KAMI</p>${rows}</div>`;
  }
  return `<!doctype html><html><head><meta charset="utf-8"><title>Penawaran ${esc(m.klien)}</title>
<style>
@page{size:A4;margin:10mm 30mm 18mm 30mm}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:'Times New Roman',Times,'Liberation Serif',serif;font-size:12pt;line-height:1.18;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}
table.frame{width:100%;border-collapse:collapse}
table.frame>thead{display:table-header-group}
table.frame>thead td,table.frame>tbody>tr>td{padding:0;border:0}
.kop{position:relative;text-align:center;border-bottom:1.2pt solid #EFA725;padding:0 0 2.5mm 0;margin-bottom:6mm}
.kop img{position:absolute;left:-8mm;top:.5mm;height:17.5mm}
.kop .nm{font-weight:700;font-size:18pt;color:#D98509;line-height:1.1}
.kop .ad{font-size:12pt;line-height:1.2}
.tgl{text-align:right;margin:0 0 5mm}
.lbl{display:grid;grid-template-columns:19mm 4mm 1fr;margin:0}
p{margin:0}
.opening{margin-top:5mm}
.indent{text-indent:10mm;text-align:justify;margin:0 0 3mm}
p.ttl{font-weight:700;margin:6mm 0 2mm;break-after:avoid}
table.price{width:100%;border-collapse:collapse;margin-bottom:2mm;font-size:12pt}
table.price th,table.price td{border:.8pt solid #000;padding:1.6mm 2mm;text-align:center;vertical-align:middle}
table.price th{background:#F7CAAC;font-weight:700}
table.price tr{break-inside:avoid}
table.price tr.tot td{font-weight:700}
table.price tr.notes td{text-align:left;font-size:10.5pt;line-height:1.25}
.hd{margin:6mm 0 1.5mm;break-after:avoid}
.nh{display:flex;gap:2.5mm;margin:3.5mm 0 1mm;break-after:avoid;padding-left:3mm}
ul{margin:0 0 1mm;padding-left:10mm}
li{text-align:justify;margin:0 0 1.2mm}
.sig{margin-top:6mm;break-inside:avoid}
.sig .sp{height:17mm}
.bayar{margin-top:5mm;break-inside:avoid}
.pf{break-before:page}
.pft{text-align:center;font-weight:700;margin:0 0 4mm}
.prow{display:grid;grid-template-columns:1fr 1fr;gap:6mm;height:86mm;margin-bottom:5mm;break-inside:avoid}
.prow div{text-align:center;display:flex;align-items:center;justify-content:center}
.prow img{max-width:100%;max-height:86mm;object-fit:contain}
</style></head><body>
<table class="frame"><thead><tr><td>
  <div class="kop"><img src="${assets}/logo.png">
    <div class="nm">${esc(kop.perusahaan)}</div>
    <div class="ad">${esc(kop.alamat1)}<br>${esc(kop.alamat2)}<br>Tlp : ${esc(kop.telepon)} | Website : ${esc(kop.website)}</div>
  </div>
</td></tr></thead><tbody><tr><td>
  <p class="tgl">${esc(m.tanggal)}</p>
  <p class="lbl"><b>Perihal</b><b>:</b><span>${esc(m.perihal)}</span></p>
  <p class="lbl"><b>Kepada</b><b>:</b><b>${esc(m.klien)}</b></p>
  <p class="opening" style="margin-bottom:1mm">Dengan hormat,</p>
  <p class="indent">${richHtml(m.intro)}</p>
  ${m.tables.map(tabelHtml).join('')}
  ${m.sections.map(blokHtml).join('')}
  <div style="margin-top:5mm">${m.penutup.map((p) => `<p class="indent">${richHtml(p)}</p>`).join('')}</div>
  ${m.pembayaran ? `<div class="bayar"><p><b>Sistem Pembayaran:</b></p><p>Untuk pembayaran bisa dilakukan melalui rekening berikut ini:</p><p><b>${esc(m.pembayaran.baris1)}</b></p><p>${esc(m.pembayaran.baris2)}</p></div>` : ''}
  <div class="sig"><p><b>Hormat kami,</b></p><div class="sp"></div><p><b>${esc(m.ttd.nama)}</b></p><p>${esc(m.ttd.jabatan)}</p><p>${esc(m.ttd.website)}</p></div>
  ${pf}
</td></tr></tbody></table>
</body></html>`;
}

module.exports = { invoiceHtml, penawaranHtml };
