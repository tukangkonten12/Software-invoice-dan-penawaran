'use strict';
/* ============================================================ utilitas kecil */
const $ = (s, el = document) => el.querySelector(s);
const clone = (o) => JSON.parse(JSON.stringify(o));

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'value') el.value = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  kids.flat(2).forEach((c) => {
    if (c == null || c === false) return;
    el.append(c.nodeType ? c : document.createTextNode(c));
  });
  return el;
}

const angka = (n) => {
  const v = Math.round(Number(n) || 0);
  return (v < 0 ? '-' : '') + String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};
const rupiah = (n) => 'Rp. ' + angka(n);
const parseAngka = (s) => {
  if (typeof s === 'number') return s;
  const d = String(s || '').replace(/[^\d-]/g, '');
  return d ? parseInt(d, 10) : 0;
};
const isPersen = (q) => /%\s*$/.test(String(q == null ? '' : q));
function totalBaris(it) {
  const harga = parseAngka(it.price);
  const q = String(it.qty == null ? '' : it.qty).trim();
  if (isPersen(q)) return Math.round((harga * (parseFloat(q.replace(',', '.')) || 0)) / 100);
  const n = parseFloat(q.replace(',', '.'));
  return Math.round(harga * (isNaN(n) ? 0 : n));
}
const hariIni = () => {
  const d = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const tglID = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${+m[3]} ${BULAN[+m[2] - 1]} ${m[1]}` : iso || '';
};
const debounce = (fn, ms) => {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
};

let toastTimer;
function toast(msg, opt = {}) {
  const t = $('#toast');
  t.className = opt.err ? 'err' : '';
  t.textContent = msg;
  if (opt.action) t.append(h('button', { class: 'btn sm', onclick: opt.action.fn }, opt.action.label));
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), opt.err ? 6000 : 5000);
}

/* ================================================================== state */
const S = { settings: null, templates: [], history: [], view: 'home', inv: null, pen: null, platform: '' };
const tplById = (id) => S.templates.find((t) => t.id === id);

/* ============================================================== komponen */
function field(label, input, hint) {
  return h('label', { class: 'f' }, label, input, hint ? h('span', { class: 'hint' }, hint) : null);
}
function text(value, onInput, o = {}) {
  return h('input', { type: o.type || 'text', value: value == null ? '' : value, placeholder: o.ph, list: o.list, class: o.cls, oninput: (e) => onInput(e.target.value, e) });
}
function area(value, onInput, rows = 4) {
  return h('textarea', { rows, value: value == null ? '' : value, oninput: (e) => onInput(e.target.value) });
}
function select(options, value, onChange) {
  const el = h('select', { onchange: (e) => onChange(e.target.value, e.target.selectedIndex) }, options.map((o) => h('option', { value: o.v }, o.t)));
  el.value = value;
  return el;
}
function money(value, onChange, cls) {
  const el = h('input', {
    type: 'text',
    class: 'num ' + (cls || ''),
    inputmode: 'numeric',
    value: value ? angka(parseAngka(value)) : '',
    oninput: (e) => onChange(parseAngka(e.target.value)),
    onblur: (e) => (e.target.value = parseAngka(e.target.value) ? angka(parseAngka(e.target.value)) : ''),
  });
  return el;
}
function check(label, checked, onChange) {
  return h('label', { class: 'f chk' }, h('input', { type: 'checkbox', checked: checked, onchange: (e) => onChange(e.target.checked) }), label);
}

/* Pratinjau: iframe yang diskalakan agar seluruh lembar A4 terlihat */
function createPreview(getHtml, { fixedHeight } = {}) {
  const frame = h('iframe', { class: 'pv-frame', title: 'Pratinjau' });
  const wrap = h('div', { class: 'pv-wrap' }, frame);
  const fit = () => {
    const k = Math.min(1, (wrap.clientWidth - 20) / 794);
    frame.style.transform = `scale(${k})`;
    wrap.style.height = frame.offsetHeight * k + 20 + 'px';
  };
  new ResizeObserver(() => requestAnimationFrame(fit)).observe(wrap);
  frame.addEventListener('load', () => {
    if (fixedHeight) frame.style.height = fixedHeight + 'px';
    else {
      try {
        frame.style.height = '300px';
        frame.style.height = frame.contentDocument.documentElement.scrollHeight + 'px';
      } catch (e) {}
    }
    fit();
  });
  let seq = 0;
  const update = debounce(async () => {
    const n = ++seq;
    try {
      const html = await getHtml();
      if (n === seq) frame.srcdoc = html;
    } catch (e) {
      console.error(e);
    }
  }, 220);
  return { el: wrap, update };
}

/* ============================================================== navigasi */
function go(view, arg) {
  S.view = view;
  document.querySelectorAll('#sidebar nav button').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  const main = $('#main');
  main.innerHTML = '';
  main.scrollTop = 0;
  ({ home: viewHome, invoice: viewInvoice, penawaran: viewPenawaran, riwayat: viewRiwayat, pengaturan: viewPengaturan })[view](main, arg);
}

/* ================================================================ BERANDA */
function viewHome(root) {
  const recent = S.history.slice(0, 6);
  root.append(
    h('div', { class: 'page' },
      h('h1', {}, 'Selamat datang 👋'),
      h('p', { class: 'sub' }, 'Buat invoice dan penawaran dalam hitungan detik. Semua tersimpan otomatis di Riwayat.'),
      h('div', { class: 'hero' },
        h('button', { class: 'tile', onclick: () => go('invoice') }, h('div', { class: 'big' }, '＄'), h('h2', {}, 'Buat Invoice'), h('p', {}, 'Nomor otomatis, total & fee % dihitung sendiri, hasil PDF.')),
        h('button', { class: 'tile', onclick: () => go('penawaran') }, h('div', { class: 'big' }, '✎'), h('h2', {}, 'Buat Penawaran'), h('p', {}, '4 template siap pakai, hasil PDF atau Word (.docx).'))
      ),
      h('div', { class: 'card' },
        h('h3', {}, 'Dokumen terakhir'),
        recent.length ? historyTable(recent, true) : h('div', { class: 'empty' }, 'Belum ada dokumen. Mulai dengan membuat invoice atau penawaran pertama Anda.')
      )
    )
  );
}

/* ================================================================ INVOICE */
function nomorOtomatis(tanggal) {
  const c = S.settings.invoice;
  const yy = String(tanggal || hariIni()).slice(2, 4);
  return `${c.nomorBerikutnya}/${c.prefix}/${yy}`;
}

function invoiceBaru() {
  return {
    id: String(Date.now()),
    jenis: 'invoice',
    klien: '',
    tanggal: hariIni(),
    nomor: nomorOtomatis(hariIni()),
    nomorManual: false,
    taxPct: S.settings.invoice.ppnBawaan || 0,
    catatan: '',
    items: [{ desc: '', qty: '1', price: '' }],
    status: 'Belum dibayar',
    _baru: true,
  };
}

function viewInvoice(root, rec) {
  const inv = rec ? clone(rec.data) : invoiceBaru();
  if (rec) {
    inv.id = rec.id;
    inv.status = rec.status;
  }
  S.inv = inv;

  const preview = createPreview(() => api.previewInvoice(dataInvoice()), { fixedHeight: 1123 });
  const refresh = () => {
    recalcAuto();
    paintTotals();
    preview.update();
  };

  const sumBudget = () => inv.items.filter((i) => !i.auto && /budget/i.test(i.desc || '')).reduce((a, i) => a + totalBaris(i), 0);
  function recalcAuto() {
    inv.items.forEach((it) => {
      if (it.auto) it.price = sumBudget();
    });
    // perbarui sel yang otomatis tanpa merender ulang seluruh tabel
    inv.items.forEach((it, i) => {
      const inp = itemsBody && itemsBody.querySelector(`[data-price="${i}"]`);
      if (inp && it.auto && document.activeElement !== inp) inp.value = it.price ? angka(it.price) : '';
    });
  }

  const sumBox = h('div', { class: 'sum' });
  function paintTotals() {
    const sub = inv.items.reduce((a, it) => a + totalBaris(it), 0);
    const tax = Math.round((sub * (parseFloat(String(inv.taxPct).replace(',', '.')) || 0)) / 100);
    sumBox.replaceChildren(
      h('div', {}, h('span', {}, 'Sub Total'), h('span', {}, rupiah(sub))),
      h('div', {}, h('span', {}, 'Tax / PPN'), h('span', {}, tax ? rupiah(tax) : '-')),
      h('div', { class: 'gt' }, h('span', {}, 'Grand Total'), h('span', {}, rupiah(sub + tax)))
    );
    inv.items.forEach((it, i) => {
      const c = itemsBody && itemsBody.querySelector(`[data-total="${i}"]`);
      if (c) c.textContent = rupiah(totalBaris(it));
    });
  }

  const itemsBody = h('tbody');
  function priceInput(it, i) {
    const el = money(it.price, (v) => { it.price = v; it.auto = false; refresh(); });
    el.setAttribute('data-price', i);
    return el;
  }
  function paintItems() {
    itemsBody.replaceChildren(
      ...inv.items.map((it, i) =>
        h('tr', {},
          h('td', { style: 'width:40%' }, text(it.desc, (v) => {
            it.desc = v;
            const svc = S.settings.layanan.find((l) => l.desc.toLowerCase() === v.toLowerCase());
            if (svc && !parseAngka(it.price)) {
              it.price = svc.price;
              const inp = itemsBody.querySelector(`[data-price="${i}"]`);
              if (inp) inp.value = angka(svc.price);
            }
            refresh();
          }, { list: 'layananList', ph: 'Nama layanan' })),
          h('td', { style: 'width:11%' }, text(it.qty, (v) => { it.qty = v; refresh(); }, { cls: 'num', ph: '1 atau 10%' })),
          h('td', { style: 'width:19%' }, priceInput(it, i)),
          h('td', { class: 'tot', 'data-total': i }, rupiah(totalBaris(it))),
          h('td', { style: 'width:34px' }, h('button', { class: 'btn sm dan', title: 'Hapus baris', onclick: () => { inv.items.splice(i, 1); if (!inv.items.length) inv.items.push({ desc: '', qty: '1', price: '' }); paintItems(); refresh(); } }, '✕'))
        )
      )
    );
  }

  const nomorInput = text(inv.nomor, (v) => { inv.nomor = v; inv.nomorManual = true; preview.update(); });
  const tglInput = text(inv.tanggal, (v) => {
    inv.tanggal = v;
    if (!inv.nomorManual && inv._baru) {
      inv.nomor = nomorOtomatis(v);
      nomorInput.value = inv.nomor;
    }
    preview.update();
  }, { type: 'date' });

  const svcSelect = select(
    [{ v: '', t: '+ Tambah dari layanan tersimpan…' }].concat(S.settings.layanan.map((l, i) => ({ v: String(i), t: `${l.desc} — ${rupiah(l.price)}` }))),
    '',
    (v) => {
      if (v === '') return;
      const l = S.settings.layanan[+v];
      const last = inv.items[inv.items.length - 1];
      const row = { desc: l.desc, qty: '1', price: l.price };
      if (last && !last.desc && !parseAngka(last.price)) inv.items[inv.items.length - 1] = row;
      else inv.items.push(row);
      svcSelect.value = '';
      paintItems();
      refresh();
    }
  );

  const form = h('div', {},
    h('div', { class: 'card' },
      h('h3', {}, 'Data invoice'),
      h('div', { class: 'grid g2' },
        field('Kepada (nama klien / perusahaan)', text(inv.klien, (v) => { inv.klien = v; preview.update(); }, { ph: 'mis. PT Halona Digital Solutions' })),
        field('Tanggal', tglInput),
        field('Nomor invoice', nomorInput, 'Terisi otomatis & naik sendiri setelah disimpan. Boleh diubah.'),
        field('PPN / Tax (%)', text(inv.taxPct, (v) => { inv.taxPct = v; refresh(); }, { type: 'number', ph: '0' }), 'Isi 0 jika tanpa pajak (tampil "-").')
      )
    ),
    h('div', { class: 'card' },
      h('h3', {}, 'Rincian layanan'),
      h('table', { class: 'it' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Deskripsi'), h('th', {}, 'Qty'), h('th', {}, 'Harga'), h('th', { style: 'text-align:right' }, 'Total'), h('th', {}))),
        itemsBody
      ),
      h('div', { class: 'row', style: 'margin-top:10px' },
        h('button', { class: 'btn sm', onclick: () => { inv.items.push({ desc: '', qty: '1', price: '' }); paintItems(); refresh(); } }, '+ Baris kosong'),
        h('button', { class: 'btn sm', title: 'Menambah baris fee berupa persen dari total budget iklan', onclick: () => {
          inv.items.push({ desc: 'Fee jasa pengelolaan iklan', qty: '10%', price: sumBudget(), auto: true });
          paintItems();
          refresh();
        } }, '+ Fee pengelolaan iklan (%)'),
        svcSelect
      ),
      h('p', { class: 'hint', style: 'margin:10px 0 0' }, 'Tips: isi Qty dengan persen (mis. 10%) agar total dihitung sebagai persentase dari harga. Baris fee otomatis mengikuti total baris yang bertuliskan "budget".'),
      sumBox
    ),
    h('div', { class: 'card' }, h('h3', {}, 'Catatan (opsional)'), area(inv.catatan, (v) => { inv.catatan = v; preview.update(); }, 2))
  );

  const dl = h('datalist', { id: 'layananList' }, S.settings.layanan.map((l) => h('option', { value: l.desc })));

  const btnPdf = h('button', { class: 'btn pri', onclick: () => exportInvoice(btnPdf) }, 'Simpan PDF');
  const btnDraf = h('button', { class: 'btn', onclick: async () => { if (await simpanRiwayatInvoice()) toast('Draf tersimpan di Riwayat'); } }, 'Simpan draf');
  root.append(
    h('div', { class: 'topbar' }, h('h1', {}, rec ? 'Edit Invoice' : 'Invoice Baru'), h('div', { class: 'sp' }), btnDraf, btnPdf),
    h('div', { class: 'editor' }, form, h('div', { class: 'preview' }, preview.el, h('p', { class: 'pv-note' }, 'Pratinjau langsung — sama persis dengan hasil PDF.'))),
    dl
  );
  paintItems();
  paintTotals();
  preview.update();

  function dataInvoice() {
    const d = clone(inv);
    d.items = d.items.map((i) => ({ desc: i.desc, qty: i.qty, price: i.price }));
    return d;
  }
  function validasi() {
    if (!inv.klien.trim()) return 'Isi nama klien terlebih dahulu.';
    if (!inv.nomor.trim()) return 'Nomor invoice belum diisi.';
    if (!inv.items.some((i) => parseAngka(i.price) > 0)) return 'Tambahkan minimal satu layanan dengan harga.';
    return null;
  }
  async function simpanRiwayatInvoice() {
    const sub = inv.items.reduce((a, it) => a + totalBaris(it), 0);
    const tax = Math.round((sub * (parseFloat(String(inv.taxPct).replace(',', '.')) || 0)) / 100);
    const r = await api.saveHistory({
      id: inv.id, jenis: 'invoice', judul: `Invoice ${inv.nomor}`, nomor: inv.nomor, klien: inv.klien,
      total: sub + tax, tanggal: inv.tanggal, status: inv.status || 'Belum dibayar', data: dataInvoice(),
    });
    S.history = r.history;
    S.settings = r.settings;
    inv._baru = false;
    return true;
  }
  async function exportInvoice(btn) {
    const err = validasi();
    if (err) return toast(err, { err: true });
    btn.disabled = true;
    btn.textContent = 'Membuat PDF…';
    try {
      const res = await api.exportPdf({ kind: 'invoice', data: dataInvoice(), fileName: `Invoice ${inv.nomor.replace(/\//g, '-')} - ${inv.klien}` });
      if (!res.canceled) {
        await simpanRiwayatInvoice();
        toast('PDF tersimpan', { action: { label: 'Tampilkan', fn: () => api.reveal(res.path) } });
      }
    } catch (e) {
      toast('Gagal membuat PDF: ' + e.message, { err: true });
    } finally {
      btn.disabled = false;
      btn.textContent = 'Simpan PDF';
    }
  }
}

/* ============================================================== PENAWARAN */
function viewPenawaran(root, rec) {
  if (!rec && !S.penTplPick) return pilihTemplate(root);
  return editorPenawaran(root, rec);
}

function pilihTemplate(root) {
  root.append(
    h('div', { class: 'page' },
      h('h1', {}, 'Penawaran Baru'),
      h('p', { class: 'sub' }, 'Pilih template penawaran yang ingin dipakai.'),
      h('div', { class: 'tpls' },
        S.templates.map((t, i) =>
          h('button', { class: 'tpl', onclick: () => { S.penTplPick = t.id; go('penawaran'); } },
            h('span', { class: 'n' }, 'Template ' + (i + 1)), h('h3', {}, t.nama), h('p', {}, t.deskripsi))
        )
      )
    )
  );
}

function penawaranBaru(t) {
  const s = S.settings;
  return {
    id: String(Date.now()),
    jenis: 'penawaran',
    templateId: t.id,
    klien: '',
    tanggal: hariIni(),
    kota: s.kota,
    perihal: t.perihal,
    intro: t.intro,
    telepon: s.telepon[t.telepon] || s.telepon[0] || '',
    penandatangan: clone(s.penandatangan[t.penandatangan] || s.penandatangan[0] || { nama: '', jabatan: '' }),
    vars: clone(t.vars || {}),
    tables: clone(t.tables),
    sections: clone(t.sections),
    penutup: t.penutup,
    pembayaran: t.pembayaran,
    portofolio: t.portofolio,
    status: 'Draf',
  };
}

function editorPenawaran(root, rec) {
  let p;
  if (rec) {
    p = clone(rec.data);
    p.id = rec.id;
    p.status = rec.status;
  } else p = penawaranBaru(tplById(S.penTplPick));
  const t = tplById(p.templateId);
  S.pen = p;

  const preview = createPreview(() => api.previewPenawaran(p));
  const upd = () => preview.update();

  /* data utama */
  const varLabels = t.varLabels || {};
  const varFields = Object.keys(p.vars || {}).map((k) => field(varLabels[k] || k, text(p.vars[k], (v) => { p.vars[k] = v; upd(); })));
  const ttdOpts = S.settings.penandatangan.map((x, i) => ({ v: String(i), t: `${x.nama} — ${x.jabatan}` }));
  let ttdIdx = S.settings.penandatangan.findIndex((x) => x.nama === p.penandatangan.nama && x.jabatan === p.penandatangan.jabatan);
  if (ttdIdx < 0) {
    ttdOpts.push({ v: 'x', t: `${p.penandatangan.nama} — ${p.penandatangan.jabatan}` });
    ttdIdx = 'x';
  }
  const telOpts = S.settings.telepon.map((x) => ({ v: x, t: x }));
  if (!S.settings.telepon.includes(p.telepon)) telOpts.push({ v: p.telepon, t: p.telepon });

  const utama = h('div', { class: 'card' },
    h('h3', {}, 'Data penawaran'),
    h('div', { class: 'grid g2' },
      field('Kepada (nama klien / bisnis)', text(p.klien, (v) => { p.klien = v; upd(); }, { ph: 'mis. Sinar Rezeki Jaya' })),
      field('Tanggal', text(p.tanggal, (v) => { p.tanggal = v; upd(); }, { type: 'date' })),
      field('Kota', text(p.kota, (v) => { p.kota = v; upd(); })),
      field('Perihal', text(p.perihal, (v) => { p.perihal = v; upd(); })),
      field('Nomor telepon di kop surat', select(telOpts, p.telepon, (v) => { p.telepon = v; upd(); })),
      field('Penandatangan', select(ttdOpts, String(ttdIdx), (v) => { const x = S.settings.penandatangan[+v]; if (x) p.penandatangan = clone(x); upd(); })),
      varFields
    ),
    h('div', { class: 'row', style: 'margin-top:12px' },
      check('Sertakan sistem pembayaran (rekening)', p.pembayaran, (v) => { p.pembayaran = v; upd(); }),
      check('Sertakan lampiran portofolio', p.portofolio, (v) => { p.portofolio = v; upd(); })
    )
  );

  /* tabel harga */
  const tablesBox = h('div', {});
  function paintTables() {
    tablesBox.replaceChildren(
      ...p.tables.map((tb, ti) => {
        const body = h('div', {});
        const grid = h('table', { class: 'it' });
        const paintGrid = () => {
          if (tb.mode === 'calc') {
            grid.replaceChildren(
              h('thead', {}, h('tr', {}, h('th', {}, 'Jasa'), h('th', {}, 'Harga unit (Rp)'), h('th', {}, 'Qty'), h('th', { style: 'text-align:right' }, 'Total'), h('th', {}))),
              h('tbody', {}, tb.rows.map((r, ri) =>
                h('tr', {},
                  h('td', { style: 'width:38%' }, text(r.jasa, (v) => { r.jasa = v; upd(); })),
                  h('td', { style: 'width:22%' }, money(r.harga, (v) => { r.harga = v; tot(ri); upd(); })),
                  h('td', { style: 'width:10%' }, text(r.qty, (v) => { r.qty = v; tot(ri); upd(); }, { cls: 'num' })),
                  h('td', { class: 'tot', 'data-t': ri }, rupiah(Math.round(parseAngka(r.harga) * (parseFloat(String(r.qty).replace(',', '.')) || 0)))),
                  h('td', {}, h('button', { class: 'btn sm dan', onclick: () => { tb.rows.splice(ri, 1); paintGrid(); upd(); } }, '✕'))
                )
              ))
            );
          } else {
            grid.replaceChildren(
              h('thead', {}, h('tr', {}, tb.headers.map((x) => h('th', {}, x)), h('th', {}))),
              h('tbody', {}, tb.rows.map((r, ri) =>
                h('tr', {},
                  h('td', { style: 'width:44%' }, text(r[0], (v) => { r[0] = v; upd(); })),
                  h('td', { style: 'width:14%' }, text(r[1], (v) => { r[1] = v; upd(); })),
                  h('td', { style: 'width:34%' }, text(r[2], (v) => { r[2] = v; upd(); }, { ph: 'angka → Rp, atau teks bebas' })),
                  h('td', {}, h('button', { class: 'btn sm dan', onclick: () => { tb.rows.splice(ri, 1); paintGrid(); upd(); } }, '✕'))
                )
              ))
            );
          }
        };
        const tot = (ri) => {
          const r = tb.rows[ri];
          const c = grid.querySelector(`[data-t="${ri}"]`);
          if (c) c.textContent = rupiah(Math.round(parseAngka(r.harga) * (parseFloat(String(r.qty).replace(',', '.')) || 0)));
        };
        paintGrid();
        body.append(...[
          field('Judul tabel (opsional)', text(tb.title, (v) => { tb.title = v; upd(); })),
          h('div', { style: 'height:10px' }),
          grid,
          h('div', { class: 'row', style: 'margin:8px 0 10px' },
            h('button', { class: 'btn sm', onclick: () => { tb.rows.push(tb.mode === 'calc' ? { jasa: '', harga: 0, qty: 1 } : ['', '1', '']); paintGrid(); upd(); } }, '+ Tambah baris'),
            tb.mode === 'calc'
              ? check('Tampilkan baris Total', tb.showTotal, (v) => { tb.showTotal = v; upd(); })
              : null
          ),
          tb.mode === 'simple' ? field('Teks baris TOTAL (kosongkan jika tidak perlu)', text(tb.totalText, (v) => { tb.totalText = v; upd(); })) : null,
          h('div', { style: 'height:10px' }),
          field('Catatan di bawah tabel (satu baris = satu catatan)', area(tb.notes, (v) => { tb.notes = v; upd(); }, 3))
        ].filter(Boolean));
        return h('details', { class: 'sec', open: true },
          h('summary', {}, `Tabel harga ${p.tables.length > 1 ? ti + 1 : ''}${tb.title ? ' — ' + tb.title : ''}`),
          h('div', {}, check('Tampilkan tabel ini', tb.enabled, (v) => { tb.enabled = v; upd(); }), body)
        );
      })
    );
  }
  paintTables();

  /* isi teks */
  const isi = h('div', { class: 'card' },
    h('h3', {}, 'Isi penawaran'),
    field('Paragraf pembuka', area(p.intro, (v) => { p.intro = v; upd(); }, 3)),
    h('div', { style: 'height:10px' }),
    p.sections.map((sec) =>
      h('details', { class: 'sec' }, h('summary', {}, sec.label), h('div', {}, area(sec.text, (v) => { sec.text = v; upd(); }, 10)))
    ),
    h('details', { class: 'sec' }, h('summary', {}, 'Paragraf penutup'), h('div', {}, area(p.penutup, (v) => { p.penutup = v; upd(); }, 5), h('p', { class: 'hint' }, 'Satu baris = satu paragraf.'))),
    h('details', { class: 'sec' },
      h('summary', {}, 'ℹ️ Cara menulis isi'),
      h('div', { class: 'hint' },
        h('p', {}, 'Baris biasa = judul tebal (mis. "Kebutuhan Kami:").'),
        h('p', {}, 'Baris diawali "- " = poin (bullet).'),
        h('p', {}, 'Baris diawali "1. " = judul bernomor tebal.'),
        h('p', {}, 'Bungkus kata dengan ** ** agar tebal, mis. **Foto dan video:**.'),
        h('p', {}, '{klien}, {platform}, {fee}, {kontrak} otomatis diganti sesuai isian di atas.')
      )
    )
  );

  const btnPdf = h('button', { class: 'btn pri', onclick: () => exportP('pdf', btnPdf, 'Simpan PDF') }, 'Simpan PDF');
  const btnDocx = h('button', { class: 'btn', onclick: () => exportP('docx', btnDocx, 'Simpan Word (.docx)') }, 'Simpan Word (.docx)');
  const btnDraf = h('button', { class: 'btn', onclick: async () => { await simpanP(); toast('Draf tersimpan di Riwayat'); } }, 'Simpan draf');

  root.append(
    h('div', { class: 'topbar' },
      !rec ? h('button', { class: 'btn', onclick: () => { S.penTplPick = null; go('penawaran'); } }, '← Ganti template') : null,
      h('h1', {}, t.nama),
      h('div', { class: 'sp' }), btnDraf, btnDocx, btnPdf
    ),
    h('div', { class: 'editor' },
      h('div', {}, utama, h('div', { class: 'card' }, h('h3', {}, 'Tabel harga'), tablesBox), isi),
      h('div', { class: 'preview', style: 'max-height:calc(100vh - 96px);overflow:auto' }, preview.el,
        h('p', { class: 'pv-note' }, 'Pratinjau berupa satu lembar panjang. Pembagian halaman final ada pada file PDF / Word.'))
    )
  );
  upd();

  function validasi() {
    if (!p.klien.trim()) return 'Isi nama klien terlebih dahulu.';
    if (!p.tables.some((x) => x.enabled)) return 'Aktifkan minimal satu tabel harga.';
    return null;
  }
  async function simpanP() {
    const r = await api.saveHistory({
      id: p.id, jenis: 'penawaran', judul: p.perihal.replace(/\{(\w+)\}/g, (a, k) => (p.vars && p.vars[k]) || a), templateNama: t.nama,
      klien: p.klien, tanggal: p.tanggal, status: p.status || 'Draf', data: clone(p),
    });
    S.history = r.history;
  }
  async function exportP(kind, btn, label) {
    const err = validasi();
    if (err) return toast(err, { err: true });
    btn.disabled = true;
    btn.textContent = 'Memproses…';
    try {
      const fileName = `Penawaran ${t.nama} - ${p.klien}`;
      const res = kind === 'pdf' ? await api.exportPdf({ kind: 'penawaran', data: clone(p), fileName }) : await api.exportDocx({ data: clone(p), fileName });
      if (!res.canceled) {
        await simpanP();
        toast(kind === 'pdf' ? 'PDF tersimpan' : 'File Word tersimpan', { action: { label: 'Tampilkan', fn: () => api.reveal(res.path) } });
      }
    } catch (e) {
      toast('Gagal menyimpan: ' + e.message, { err: true });
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  }
}

/* ================================================================ RIWAYAT */
function historyTable(list, ringkas) {
  const STAT = { invoice: ['Belum dibayar', 'Lunas'], penawaran: ['Draf', 'Terkirim', 'Deal', 'Batal'] };
  return h('table', { class: 'hist' },
    h('thead', {}, h('tr', {}, h('th', {}, 'Jenis'), h('th', {}, 'Dokumen'), h('th', {}, 'Klien'), h('th', {}, 'Tanggal'), h('th', {}, 'Total'), h('th', {}, 'Status'), h('th', {}))),
    h('tbody', {}, list.map((r) =>
      h('tr', {},
        h('td', {}, h('span', { class: 'tag ' + (r.jenis === 'invoice' ? 'inv' : 'pen') }, r.jenis === 'invoice' ? 'Invoice' : 'Penawaran')),
        h('td', {}, r.jenis === 'invoice' ? r.nomor : [h('div', {}, r.templateNama || 'Penawaran'), h('small', { class: 'hint' }, r.judul)]),
        h('td', {}, r.klien),
        h('td', {}, tglID(r.tanggal)),
        h('td', { style: 'font-variant-numeric:tabular-nums' }, r.total ? rupiah(r.total) : '—'),
        h('td', {}, select(STAT[r.jenis].map((x) => ({ v: x, t: x })), STAT[r.jenis].includes(r.status) ? r.status : STAT[r.jenis][0], async (v) => { S.history = await api.setStatus({ id: r.id, status: v }); })),
        h('td', { style: 'white-space:nowrap;text-align:right' },
          h('button', { class: 'btn sm', onclick: () => go(r.jenis === 'invoice' ? 'invoice' : 'penawaran', r) }, 'Buka / Edit'), ' ',
          ringkas ? null : h('button', { class: 'btn sm', title: 'Buat salinan baru dari dokumen ini', onclick: () => duplikat(r) }, 'Duplikat'), ' ',
          ringkas ? null : h('button', { class: 'btn sm dan', onclick: async () => { if (confirm('Hapus dokumen ini dari riwayat?')) { S.history = await api.deleteHistory(r.id); go('riwayat'); } } }, 'Hapus')
        )
      )
    ))
  );
}

function duplikat(r) {
  const copy = clone(r);
  copy.id = String(Date.now());
  copy.status = r.jenis === 'invoice' ? 'Belum dibayar' : 'Draf';
  copy.data.tanggal = hariIni();
  if (r.jenis === 'invoice') {
    copy.data.nomor = nomorOtomatis(hariIni());
    copy.data.nomorManual = false;
    copy.data._baru = true;
  }
  S.penTplPick = copy.data.templateId || null;
  go(r.jenis === 'invoice' ? 'invoice' : 'penawaran', copy);
}

function viewRiwayat(root) {
  let filter = 'semua';
  let q = '';
  const box = h('div', {});
  const chips = h('div', { class: 'row' });
  const paint = () => {
    chips.replaceChildren(...[['semua', 'Semua'], ['invoice', 'Invoice'], ['penawaran', 'Penawaran']].map(([k, l]) => h('button', { class: 'btn sm' + (filter === k ? ' pri' : ''), onclick: () => { filter = k; paint(); } }, l)));
    const list = S.history.filter((r) => (filter === 'semua' || r.jenis === filter) && (!q || (r.klien + ' ' + (r.nomor || '') + ' ' + (r.judul || '')).toLowerCase().includes(q.toLowerCase())));
    box.replaceChildren(list.length ? historyTable(list) : h('div', { class: 'empty' }, 'Tidak ada dokumen.'));
  };
  root.append(
    h('div', { class: 'page' },
      h('h1', {}, 'Riwayat'),
      h('p', { class: 'sub' }, 'Setiap dokumen yang Anda simpan tercatat di sini. Klik "Buka / Edit" untuk mengubah atau mencetak ulang.'),
      h('div', { class: 'row', style: 'margin-bottom:14px' }, chips, h('div', { class: 'sp' }), h('div', { style: 'width:260px' }, text('', (v) => { q = v; paint(); }, { ph: 'Cari klien / nomor…' }))),
      box
    )
  );
  paint();
}

/* ============================================================ PENGATURAN */
function viewPengaturan(root) {
  const s = clone(S.settings);
  const baris = (arr, f) => arr.map(f).join('\n');
  const tel = area(baris(s.telepon, (x) => x), () => {}, 3);
  const ttd = area(baris(s.penandatangan, (x) => `${x.nama} | ${x.jabatan}`), () => {}, 4);
  const lay = area(baris(s.layanan, (x) => `${x.desc} | ${x.price}`), () => {}, 6);

  const simpan = async () => {
    s.telepon = tel.value.split('\n').map((x) => x.trim()).filter(Boolean);
    s.penandatangan = ttd.value.split('\n').map((x) => x.split('|').map((y) => y.trim())).filter((x) => x[0]).map((x) => ({ nama: x[0], jabatan: x[1] || '' }));
    s.layanan = lay.value.split('\n').map((x) => x.split('|').map((y) => y.trim())).filter((x) => x[0]).map((x) => ({ desc: x[0], price: parseAngka(x[1]) }));
    s.invoice.nomorBerikutnya = parseInt(s.invoice.nomorBerikutnya, 10) || 1;
    s.invoice.ppnBawaan = parseFloat(s.invoice.ppnBawaan) || 0;
    S.settings = await api.saveSettings(s);
    toast('Pengaturan tersimpan');
  };

  root.append(
    h('div', { class: 'page', style: 'max-width:920px' },
      h('div', { class: 'row' }, h('h1', {}, 'Pengaturan'), h('div', { class: 'sp' }), h('button', { class: 'btn pri', onclick: simpan }, 'Simpan pengaturan')),
      h('p', { class: 'sub' }, 'Data perusahaan ini dipakai otomatis di semua invoice dan penawaran.'),
      h('div', { class: 'card' }, h('h3', {}, 'Profil perusahaan (kop surat)'),
        h('div', { class: 'grid g2' },
          field('Nama perusahaan', text(s.perusahaan, (v) => (s.perusahaan = v))),
          field('Website', text(s.website, (v) => (s.website = v))),
          field('Alamat baris 1', text(s.alamat1, (v) => (s.alamat1 = v))),
          field('Alamat baris 2', text(s.alamat2, (v) => (s.alamat2 = v))),
          field('Kota (untuk tanggal surat)', text(s.kota, (v) => (s.kota = v)))
        ),
        h('div', { style: 'height:12px' }),
        field('Nomor telepon kop surat (satu per baris)', tel)
      ),
      h('div', { class: 'card' }, h('h3', {}, 'Rekening pembayaran'),
        h('div', { class: 'grid g3' },
          field('Bank', text(s.bank.nama, (v) => (s.bank.nama = v))),
          field('Nomor rekening', text(s.bank.rekening, (v) => (s.bank.rekening = v))),
          field('Atas nama', text(s.bank.atasNama, (v) => (s.bank.atasNama = v)))
        )
      ),
      h('div', { class: 'card' }, h('h3', {}, 'Invoice'),
        h('div', { class: 'grid g3' },
          field('Kode nomor (mis. MHK)', text(s.invoice.prefix, (v) => (s.invoice.prefix = v))),
          field('Nomor invoice berikutnya', text(s.invoice.nomorBerikutnya, (v) => (s.invoice.nomorBerikutnya = v), { type: 'number' }), 'Format: 378/MHK/26'),
          field('PPN bawaan (%)', text(s.invoice.ppnBawaan, (v) => (s.invoice.ppnBawaan = v), { type: 'number' })),
          field('Domain di pojok invoice', text(s.invoice.domain, (v) => (s.invoice.domain = v))),
          field('Telepon di footer invoice', text(s.invoice.footerTelepon, (v) => (s.invoice.footerTelepon = v))),
          field('Alamat di footer invoice', text(s.invoice.footerAlamat, (v) => (s.invoice.footerAlamat = v)))
        )
      ),
      h('div', { class: 'card' }, h('h3', {}, 'Penandatangan penawaran'),
        field('Satu per baris, format: Nama | Jabatan', ttd)
      ),
      h('div', { class: 'card' }, h('h3', {}, 'Layanan tersimpan (saran cepat di invoice)'),
        field('Satu per baris, format: Deskripsi | Harga', lay)
      ),
      h('div', { class: 'card' }, h('h3', {}, 'Data aplikasi'),
        h('p', { class: 'hint', style: 'margin-top:0' }, 'Riwayat dan pengaturan tersimpan di komputer ini. Salin folder data untuk mencadangkan atau memindahkan ke komputer lain.'),
        h('button', { class: 'btn', onclick: () => api.openDataFolder() }, 'Buka folder data')
      )
    )
  );
}

/* ================================================================== BOOT */
document.querySelectorAll('#sidebar nav button').forEach((b) =>
  b.addEventListener('click', () => {
    if (b.dataset.view === 'penawaran') S.penTplPick = null;
    go(b.dataset.view);
  })
);

(async function boot() {
  const init = await api.init();
  Object.assign(S, { settings: init.settings, templates: init.templates, history: init.history, platform: init.platform });
  $('#sbFoot').textContent = `Versi ${init.version}`;
  go('home');
})();
