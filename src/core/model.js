'use strict';
const F = require('./format');

/**
 * Mengubah data form penawaran menjadi struktur final yang dipakai
 * renderer HTML (PDF) dan renderer DOCX, supaya hasil keduanya konsisten.
 */
function bangunPenawaran(d, s) {
  const vars = Object.assign({}, d.vars || {}, { klien: d.klien || '{klien}' });
  const v = (t) => F.isiVar(t, vars);

  const tables = (d.tables || [])
    .filter((t) => t.enabled)
    .map((t) => {
      if (t.mode === 'calc') {
        const rows = (t.rows || []).map((r) => {
          const harga = F.parseAngka(r.harga);
          const qty = parseFloat(String(r.qty).replace(',', '.')) || 0;
          return { harga, qty, total: Math.round(harga * qty), jasa: v(r.jasa) };
        });
        const sum = rows.reduce((a, r) => a + r.total, 0);
        return {
          title: v(t.title),
          headers: t.headers,
          widths: [40, 24, 12, 24],
          align: ['c', 'c', 'c', 'c'],
          rows: rows.map((r) => [r.jasa, F.rupiah(r.harga), String(r.qty), F.rupiah(r.total)]),
          total: t.showTotal ? { label: 'Total', text: F.rupiah(sum) } : null,
          notes: v(t.notes).split(/\r?\n/).map((x) => x.trim()).filter(Boolean),
        };
      }
      return {
        title: v(t.title),
        headers: t.headers,
        widths: [50, 15, 35],
        align: ['c', 'c', 'c'],
        rows: (t.rows || []).map((r) => [v(r[0]), v(r[1]), F.sel(v(r[2]))]),
        total: t.totalText ? { label: 'TOTAL', text: v(t.totalText) } : null,
        notes: v(t.notes).split(/\r?\n/).map((x) => x.trim()).filter(Boolean),
      };
    });

  const sections = (d.sections || []).map((sec) => F.parseBody(sec.text, vars));
  const penutup = v(d.penutup).split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const bank = s.bank || {};

  return {
    kop: {
      perusahaan: s.perusahaan,
      alamat1: s.alamat1,
      alamat2: s.alamat2,
      telepon: d.telepon || (s.telepon || [])[0] || '',
      website: s.website,
    },
    tanggal: `${d.kota || s.kota}, ${F.tanggalID(d.tanggal)}`,
    perihal: v(d.perihal),
    klien: d.klien || '',
    intro: v(d.intro),
    tables,
    sections,
    penutup,
    pembayaran: d.pembayaran
      ? { baris1: `${bank.nama || ''} - ${bank.rekening || ''}`, baris2: bank.atasNama || '' }
      : null,
    ttd: { nama: (d.penandatangan || {}).nama || '', jabatan: (d.penandatangan || {}).jabatan || '', website: s.website },
    portofolio: !!d.portofolio,
  };
}

module.exports = { bangunPenawaran };
