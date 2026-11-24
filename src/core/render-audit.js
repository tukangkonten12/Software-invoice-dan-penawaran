'use strict';
const F = require('./format');
const { bangunAudit } = require('./audit');
const { fontFaces, richHtml } = require('./render-html');
const { esc } = F;

/** Sel tabel: "//" = baris baru. */
const sel = (t) => String(t == null ? '' : t).split('//').map((x) => esc(x.trim())).join('<br>');

function auditHtml(a, settings, assets) {
  const m = bangunAudit(a, settings);
  const kop = m.kop;

  const info = m.info
    .map(([k, v, warn]) => `<tr><th>${esc(k)}</th><td${warn ? ' class="warn"' : ''}>${esc(v)}</td></tr>`)
    .join('');
  const temuan = m.temuan.map((t) => `<li>${richHtml(t)}</li>`).join('');
  const proyeksi = m.proyeksi.length
    ? `<table class="proj"><colgroup><col style="width:18%"><col style="width:24%"><col style="width:24%"><col style="width:34%"></colgroup>
<thead><tr>${m.proyeksiHead.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
<tbody>${m.proyeksi.map((r) => `<tr>${[0, 1, 2, 3].map((i) => `<td>${sel(r[i])}</td>`).join('')}</tr>`).join('')}</tbody></table>`
    : '';
  const rek = m.rekomendasi.map((t, i) => `<li><span class="no">${i + 1}.</span><div>${richHtml(t)}</div></li>`).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><title>Audit Google Maps - ${esc(m.nama)}</title>
<style>
${fontFaces(assets)}
@page{size:A4;margin:14mm 17mm 16mm 17mm}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:'Open Sans','Segoe UI',Calibri,Arial,sans-serif;font-size:10.3pt;line-height:1.5;color:#1f2937;-webkit-print-color-adjust:exact;print-color-adjust:exact}
p{margin:0}
.kop{position:relative;text-align:center;border-bottom:1.3pt solid #EBC98E;padding:0 0 3mm;margin-bottom:6mm}
.kop img{position:absolute;left:0;top:0;height:18mm}
.kop .nm{font-family:Georgia,'Times New Roman','Liberation Serif',serif;font-weight:700;font-size:19pt;color:#E9B96B;line-height:1.15}
.kop .ad{font-family:Georgia,'Times New Roman','Liberation Serif',serif;font-size:10.5pt;line-height:1.35;color:#6b7280;margin-top:1mm}
.hero{background:#1F2933;color:#fff;padding:5.5mm 6mm 5mm;margin-bottom:5mm;break-inside:avoid}
.hero .lb{font-size:7.8pt;font-weight:700;letter-spacing:.2px;color:#8FB9F5;text-transform:uppercase}
.hero h1{font-size:19pt;margin:1.5mm 0 1.5mm;line-height:1.2;font-weight:700}
.hero .sb{font-size:9.6pt;color:#CBD5E1}
table.info{width:100%;border-collapse:collapse;margin-bottom:2mm;break-inside:avoid}
table.info th,table.info td{padding:2.2mm 2.6mm;text-align:left;vertical-align:top;border-bottom:.6pt solid #D8DEE8}
table.info th{width:31%;font-weight:700}
table.info tr:nth-child(odd){background:#F1F5F9}
table.info td.warn{color:#B91C1C;font-weight:700}
h2{font-size:12.5pt;margin:6.5mm 0 3mm;padding-bottom:1.5mm;border-bottom:1.6pt solid #2563EB;color:#1f2937;break-after:avoid}
ul.tm{list-style:none;margin:0;padding:0}
ul.tm li{position:relative;padding-left:5mm;margin:0 0 2.3mm;text-align:justify}
ul.tm li::before{content:'';position:absolute;left:0;top:2.1mm;width:1.7mm;height:1.7mm;background:#2563EB}
.intro{margin:0 0 3mm;text-align:justify}
table.proj{width:100%;border-collapse:collapse;font-size:9.3pt;line-height:1.4;margin-bottom:2mm}
table.proj th{background:#1F2933;color:#fff;text-align:left;padding:2.2mm 2.4mm;font-weight:700;border:.6pt solid #1F2933}
table.proj td{padding:2.2mm 2.4mm;vertical-align:top;border:.6pt solid #C9D1DD}
table.proj tr{break-inside:avoid}
table.proj tbody tr:nth-child(even){background:#F7F9FC}
table.proj td:first-child{font-weight:700}
ol.rk{list-style:none;margin:0;padding:0}
ol.rk li{display:flex;gap:2.2mm;margin:0 0 2.4mm;text-align:justify}
ol.rk .no{font-weight:700;color:#2563EB;min-width:5mm}
.cat{margin-top:6mm;padding:3mm 4mm;background:#F1F5F9;border-left:2pt solid #94A3B8;font-size:9pt;color:#475569;text-align:justify;break-inside:avoid}
</style></head><body>
<div class="kop"><img src="${assets}/logo.png">
  <div class="nm">${esc(kop.perusahaan)}</div>
  <div class="ad">${esc(kop.alamat1)}<br>${esc(kop.alamat2)}<br>Tlp : ${esc(kop.telepon)} | Website : ${esc(kop.website)}</div>
</div>
<div class="hero"><div class="lb">Laporan Audit &amp; Analisis Google Business Profile</div>
  <h1>${esc(m.nama)}</h1>
  <div class="sb">Evaluasi Teknis Profil Google Maps, Kelengkapan Standar Local SEO &amp; Proyeksi Kebutuhan Ulasan</div></div>
<table class="info">${info}</table>

<h2>1. Analisis Kekurangan &amp; Temuan Utama Profil</h2>
<ul class="tm">${temuan}</ul>

${m.ulasan ? `<h2>2. Evaluasi &amp; Proyeksi Kebutuhan Ulasan (Review)</h2>
${m.proyeksiIntro ? `<p class="intro">${richHtml(m.proyeksiIntro)}</p>` : ''}
${proyeksi}` : ''}

<h2>${m.ulasan ? 3 : 2}. Rekomendasi Langkah Perbaikan Prioritas</h2>
<ol class="rk">${rek}</ol>
${m.catatan ? `<div class="cat"><b>Catatan Standar Kepatuhan:</b> ${richHtml(m.catatan)}</div>` : ''}
</body></html>`;
}

module.exports = { auditHtml };
