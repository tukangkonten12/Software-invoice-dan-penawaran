'use strict';
// Fungsi pembantu yang dipakai bersama oleh renderer HTML/PDF, DOCX, dan antarmuka.

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/** 4000000 -> "4.000.000" */
function angka(n) {
  const v = Math.round(Number(n) || 0);
  const s = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (v < 0 ? '-' : '') + s;
}

/** 4000000 -> "Rp. 4.000.000" */
function rupiah(n) {
  return 'Rp. ' + angka(n);
}

/** "Rp. 4.000.000" / "4000000" -> 4000000 */
function parseAngka(s) {
  if (typeof s === 'number') return s;
  const d = String(s || '').replace(/[^\d-]/g, '');
  return d ? parseInt(d, 10) : 0;
}

/** Sel harga bebas: jika isinya hanya angka (boleh "Rp") jadikan format Rupiah, selain itu biarkan apa adanya. */
function sel(text) {
  const t = String(text == null ? '' : text).trim();
  if (/^(rp\.?\s*)?[\d.,]+$/i.test(t) && /\d/.test(t)) return rupiah(parseAngka(t));
  return t;
}

/** "2026-10-30" -> "30 Oktober 2026" */
function tanggalID(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!m) return iso || '';
  return `${parseInt(m[3], 10)} ${BULAN[parseInt(m[2], 10) - 1]} ${m[1]}`;
}

function hariIniISO() {
  const d = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Qty bisa "1", "30", atau persentase "10%". */
function isPersen(qty) {
  return /%\s*$/.test(String(qty == null ? '' : qty));
}

/** Total baris sebelum diskon (qty x harga, atau persen dari harga). */
function brutoBaris(it) {
  const harga = parseAngka(it.price);
  const q = String(it.qty == null ? '' : it.qty).trim();
  if (isPersen(q)) {
    const pct = parseFloat(q.replace(',', '.')) || 0;
    return Math.round((harga * pct) / 100);
  }
  const n = parseFloat(q.replace(',', '.'));
  return Math.round(harga * (isNaN(n) ? 0 : n));
}

/**
 * Diskon: "10%" = persen dari base, selain itu dianggap nominal Rupiah ("50.000").
 * Hasil tidak pernah negatif dan tidak pernah melebihi base.
 */
function hitungDiskon(disc, base) {
  const t = String(disc == null ? '' : disc).trim();
  if (!t) return 0;
  let d;
  if (isPersen(t)) {
    const pct = Math.min(Math.max(parseFloat(t.replace(',', '.')) || 0, 0), 100);
    d = Math.round((base * pct) / 100);
  } else {
    d = Math.max(parseAngka(t), 0);
  }
  return Math.max(0, Math.min(d, Math.max(base, 0)));
}

/** Nilai diskon satu baris (Rupiah). */
function diskonBaris(it) {
  return hitungDiskon(it.disc, brutoBaris(it));
}

/** Total baris setelah diskon baris. */
function totalBaris(it) {
  return brutoBaris(it) - diskonBaris(it);
}

function hitungInvoice(inv) {
  const items = (inv.items || []).filter((it) => String(it.desc || '').trim() || parseAngka(it.price));
  const sub = items.reduce((a, it) => a + totalBaris(it), 0);
  const diskonTotal = hitungDiskon(inv.discTotal, sub);
  const afterDisc = sub - diskonTotal;
  const taxPct = parseFloat(String(inv.taxPct || 0).replace(',', '.')) || 0;
  const tax = Math.round((afterDisc * taxPct) / 100);
  return { items, sub, diskonTotal, afterDisc, taxPct, tax, grand: afterDisc + tax };
}

/** Ganti {klien}, {fee}, dst. */
function isiVar(text, vars) {
  return String(text == null ? '' : text).replace(/\{(\w+)\}/g, (all, k) =>
    vars && vars[k] != null && vars[k] !== '' ? String(vars[k]) : all
  );
}

/** "Halo **tebal** biasa" -> [{t:'Halo ',b:false},{t:'tebal',b:true},...] */
function runs(text) {
  const out = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m;
  const s = String(text || '');
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ t: s.slice(last, m.index), b: false });
    out.push({ t: m[1], b: true });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ t: s.slice(last), b: false });
  return out;
}

/**
 * Teks isi -> blok.
 *   "1. Judul"   -> {type:'numhead'}  (judul tebal bernomor)
 *   "- teks"     -> {type:'bullet'}
 *   baris lain   -> {type:'head'}     (judul tebal, mis. "Kebutuhan Kami:")
 */
function parseBody(text, vars) {
  const blocks = [];
  String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((l) => {
      const line = isiVar(l, vars);
      let m;
      if ((m = /^(\d+)\.\s+(.*)$/.exec(line))) blocks.push({ type: 'numhead', num: m[1], text: m[2] });
      else if ((m = /^[-•]\s+(.*)$/.exec(line))) blocks.push({ type: 'bullet', text: m[1] });
      else blocks.push({ type: 'head', text: line });
    });
  return blocks;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** "PT. Halona / Digital: 1" -> aman dipakai sebagai nama file */
function namaFile(s) {
  return String(s || 'dokumen')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90);
}

module.exports = { BULAN, angka, rupiah, parseAngka, sel, tanggalID, hariIniISO, isPersen, brutoBaris, hitungDiskon, diskonBaris, totalBaris, hitungInvoice, isiVar, runs, parseBody, esc, namaFile };
