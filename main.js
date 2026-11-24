'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { pathToFileURL } = require('url');

const { DEFAULT_SETTINGS, TEMPLATES } = require('./src/core/templates');
const { invoiceHtml, penawaranHtml } = require('./src/core/render-html');
const { bangunPenawaran } = require('./src/core/model');
const { auditHtml } = require('./src/core/render-audit');
const Audit = require('./src/core/audit');
const { buatDocx } = require('./src/core/render-docx');
const F = require('./src/core/format');

/* ------------------------------------------------------------ lokasi file */
let assetsDir = path.join(__dirname, 'assets');
if (app.isPackaged) assetsDir = assetsDir.replace('app.asar', 'app.asar.unpacked');
const assetsUrl = pathToFileURL(assetsDir).href;
const portfolioFiles = () =>
  fs.existsSync(path.join(assetsDir, 'portfolio')) ? fs.readdirSync(path.join(assetsDir, 'portfolio')).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort() : [];

const dataDir = () => app.getPath('userData');
const settingsFile = () => path.join(dataDir(), 'settings.json');
const historyFile = () => path.join(dataDir(), 'history.json');

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return fallback;
  }
}
function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, file); // tulis atomik supaya data tidak rusak jika aplikasi tertutup mendadak
}

function mergeDeep(base, extra) {
  if (Array.isArray(base) || typeof base !== 'object' || base === null) return extra === undefined ? base : extra;
  const out = Object.assign({}, base);
  for (const k of Object.keys(extra || {})) out[k] = k in base ? mergeDeep(base[k], extra[k]) : extra[k];
  return out;
}
const getSettings = () => mergeDeep(DEFAULT_SETTINGS, readJson(settingsFile(), {}));
const getHistory = () => readJson(historyFile(), []);

/* ------------------------------------------------------------------ jendela */
let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1040,
    minHeight: 680,
    title: 'MHK Dokumen',
    icon: path.join(__dirname, 'build', 'icon.png'),
    backgroundColor: '#faf6ef',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  win.loadFile(path.join(__dirname, 'src', 'renderer', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const tpl = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    { role: 'editMenu' },
    { label: 'Tampilan', submenu: [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

app.whenReady().then(() => {
  buildMenu();
  createWindow();
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});
app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit());

/* -------------------------------------------------------------- PDF engine */
async function htmlToPdf(html) {
  const tmp = path.join(os.tmpdir(), `mhk-${Date.now()}-${Math.random().toString(36).slice(2)}.html`);
  fs.writeFileSync(tmp, html);
  const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  try {
    await w.loadFile(tmp);
    await w.webContents.executeJavaScript('document.fonts && document.fonts.ready ? document.fonts.ready.then(()=>true) : true');
    await new Promise((r) => setTimeout(r, 250)); // beri waktu gambar selesai dimuat
    return await w.webContents.printToPDF({ preferCSSPageSize: true, printBackground: true, margins: { marginType: 'none' } });
  } finally {
    w.destroy();
    fs.unlink(tmp, () => {});
  }
}

function penawaranModel(data) {
  return bangunPenawaran(data, getSettings());
}

async function pilihLokasi(defaultName, ext, label) {
  const dir = path.join(app.getPath('documents'), 'MHK Dokumen');
  fs.mkdirSync(dir, { recursive: true });
  const r = await dialog.showSaveDialog(win, {
    title: 'Simpan dokumen',
    defaultPath: path.join(dir, F.namaFile(defaultName) + '.' + ext),
    filters: [{ name: label, extensions: [ext] }],
  });
  return r.canceled ? null : r.filePath;
}

/* --------------------------------------------------------------------- IPC */
ipcMain.handle('app:init', () => ({
  settings: getSettings(),
  templates: TEMPLATES,
  history: getHistory(),
  platform: process.platform,
  assetsUrl,
  version: app.getVersion(),
  auditTpl: Audit.auditBaru(),
  auditCek: Audit.CEK_ITEMS,
}));

ipcMain.handle('audit:susun', (e, data) => Audit.susunAudit(data));

ipcMain.handle('settings:save', (e, s) => {
  writeJson(settingsFile(), s);
  return getSettings();
});

ipcMain.handle('preview:invoice', (e, data) => invoiceHtml(data, getSettings(), assetsUrl));

ipcMain.handle('preview:audit', (e, data) => {
  let html = auditHtml(data, getSettings(), assetsUrl);
  // tampilan layar: satu lembar panjang berlatar abu-abu
  return html.replace(
    '</style>',
    '@media screen{html{background:#e4e0d8}body{width:210mm;margin:8mm auto;padding:14mm 17mm 16mm;background:#fff;box-shadow:0 2px 14px rgba(0,0,0,.18)}}</style>'
  );
});

ipcMain.handle('preview:penawaran', (e, data) => {
  let html = penawaranHtml(penawaranModel(data), assetsUrl, data.portofolio ? portfolioFiles() : []);
  // tampilan layar: satu lembar panjang berlatar abu-abu
  html = html.replace(
    '</style>',
    `@media screen{html{background:#e4e0d8}body{padding:8mm 0}table.frame{width:210mm;margin:0 auto;background:#fff;box-shadow:0 2px 14px rgba(0,0,0,.18)}table.frame>thead>tr>td{padding:10mm 30mm 0!important}table.frame>tbody>tr>td{padding:0 30mm 18mm!important}}</style>`
  );
  return html;
});

ipcMain.handle('export:pdf', async (e, { kind, data, fileName }) => {
  const target = await pilihLokasi(fileName, 'pdf', 'PDF');
  if (!target) return { canceled: true };
  const html =
    kind === 'invoice'
      ? invoiceHtml(data, getSettings(), assetsUrl)
      : kind === 'audit'
      ? auditHtml(data, getSettings(), assetsUrl)
      : penawaranHtml(penawaranModel(data), assetsUrl, data.portofolio ? portfolioFiles() : []);
  const pdf = await htmlToPdf(html);
  fs.writeFileSync(target, pdf);
  return { path: target };
});

ipcMain.handle('export:docx', async (e, { data, fileName }) => {
  const target = await pilihLokasi(fileName, 'docx', 'Word');
  if (!target) return { canceled: true };
  const buf = await buatDocx(penawaranModel(data), assetsDir, data.portofolio ? portfolioFiles() : []);
  fs.writeFileSync(target, buf);
  return { path: target };
});

ipcMain.handle('file:reveal', (e, p) => shell.showItemInFolder(p));
ipcMain.handle('file:open', (e, p) => shell.openPath(p));

/* Riwayat: simpan/ubah dokumen. Untuk invoice, nomor berikutnya ikut maju otomatis. */
ipcMain.handle('history:save', (e, rec) => {
  const list = getHistory();
  const i = list.findIndex((x) => x.id === rec.id);
  rec.diubah = new Date().toISOString();
  if (i >= 0) list[i] = Object.assign(list[i], rec);
  else list.unshift(Object.assign({ dibuat: rec.diubah }, rec));
  writeJson(historyFile(), list);

  let settings = getSettings();
  if (rec.jenis === 'invoice') {
    const n = parseInt(String(rec.nomor || '').split('/')[0], 10);
    if (!isNaN(n) && n >= settings.invoice.nomorBerikutnya) {
      settings.invoice.nomorBerikutnya = n + 1;
      writeJson(settingsFile(), settings);
    }
  }
  return { history: list, settings };
});

ipcMain.handle('history:delete', (e, id) => {
  const list = getHistory().filter((x) => x.id !== id);
  writeJson(historyFile(), list);
  return list;
});

ipcMain.handle('history:status', (e, { id, status }) => {
  const list = getHistory();
  const it = list.find((x) => x.id === id);
  if (it) it.status = status;
  writeJson(historyFile(), list);
  return list;
});

ipcMain.handle('data:folder', () => shell.openPath(dataDir()));

/* ------------------------------------------------- Google Maps (Places API) */
const PLACES_FIELDS = [
  'id', 'displayName', 'formattedAddress', 'rating', 'userRatingCount', 'primaryTypeDisplayName',
  'types', 'websiteUri', 'nationalPhoneNumber', 'regularOpeningHours', 'googleMapsUri', 'businessStatus',
].map((f) => 'places.' + f).join(',');

/** Tautan Google Maps (termasuk tautan pendek) -> teks pencarian; teks biasa dikembalikan apa adanya. */
async function mapsQueryDariInput(input) {
  const q = String(input || '').trim();
  if (!/^https?:\/\//i.test(q)) return q;
  let url = q;
  try {
    const r = await fetch(q, { redirect: 'follow' });
    url = r.url || q;
  } catch (e) {
    /* abaikan: pakai tautan asli */
  }
  let m = /\/maps\/place\/([^/@?]+)/.exec(url);
  if (!m) m = /[?&]q=([^&]+)/.exec(url);
  if (m) {
    try {
      return decodeURIComponent(m[1].replace(/\+/g, ' '));
    } catch (e) {
      return m[1].replace(/\+/g, ' ');
    }
  }
  return q;
}

/* ------------------------------------------------------------- Outscraper */
const OUTSCRAPER = 'https://api.app.outscraper.com';
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

function petaOutscraper(o) {
  const tipe = String(o.type || o.category || '').trim();
  const subs = (Array.isArray(o.subtypes) ? o.subtypes.join(',') : String(o.subtypes || ''))
    .split(',').map((x) => x.trim()).filter(Boolean);
  const utama = tipe || subs[0] || '';
  const lain = subs.filter((x) => x.toLowerCase() !== utama.toLowerCase());
  return {
    sumber: 'outscraper',
    nama: o.name || '',
    alamat: o.address || '',
    rating: o.rating == null ? '' : o.rating,
    ulasan: o.reviews == null ? 0 : o.reviews,
    kategoriUtama: utama,
    kategoriLain: lain.join(', '),
    website: o.website || '',
    telepon: o.phone || '',
    punyaJam: !!(o.working_hours && Object.keys(o.working_hours).length),
    deskripsi: !!(o.description && String(o.description).trim()),
    posts: Array.isArray(o.posts) && o.posts.length > 0,
    url: o.location_link || '',
    status: o.business_status || '',
    verifikasi: o.verified === true ? true : o.verified === false ? false : null,
  };
}

async function cariOutscraper(key, query, limit) {
  const headers = { 'X-API-KEY': key };
  const u = new URL(OUTSCRAPER + '/maps/search-v3');
  u.searchParams.set('query', query);
  u.searchParams.set('limit', String(limit));
  u.searchParams.set('language', 'id');
  u.searchParams.set('region', 'ID');
  u.searchParams.set('async', 'false');
  try {
    let res = await fetch(u, { headers });
    let j = await res.json().catch(() => ({}));
    if (!res.ok) return { error: j.errorMessage || j.error || `Outscraper menolak permintaan (HTTP ${res.status}). Periksa API key.` };
    // jika proses belum selesai, tunggu sampai ± 60 detik
    for (let i = 0; i < 20 && /^(pending|running)$/i.test(String(j.status || '')) && j.id; i++) {
      await tidur(3000);
      res = await fetch(`${OUTSCRAPER}/requests/${encodeURIComponent(j.id)}`, { headers });
      j = await res.json().catch(() => ({}));
    }
    if (!/^success$/i.test(String(j.status || ''))) return { error: 'Outscraper belum selesai memproses. Coba lagi sebentar lagi.' };
    const places = (j.data || []).flat().filter((o) => o && o.name).map(petaOutscraper);
    return { places, query };
  } catch (err) {
    return { error: 'Tidak bisa menghubungi Outscraper. Periksa koneksi internet. (' + err.message + ')' };
  }
}

/* ---------------------------------------------------------------- SerpApi */
function petaSerpApi(o) {
  const semua = Array.isArray(o.types) ? o.types : Array.isArray(o.type) ? o.type : o.type ? [o.type] : [];
  const utama = String(semua[0] || '').trim();
  const lain = semua.slice(1).map((x) => String(x).trim()).filter((x) => x && x.toLowerCase() !== utama.toLowerCase());
  const jam = o.operating_hours || o.hours;
  return {
    sumber: 'serpapi',
    nama: o.title || '',
    alamat: o.address || '',
    rating: o.rating == null ? '' : o.rating,
    ulasan: o.reviews == null ? 0 : o.reviews,
    kategoriUtama: utama,
    kategoriLain: lain.join(', '),
    website: o.website || '',
    telepon: o.phone || '',
    punyaJam: Array.isArray(jam) ? jam.length > 0 : jam && typeof jam === 'object' ? Object.keys(jam).length > 0 : !!jam,
    deskripsi: !!(o.description && String(o.description).trim()),
    posts: false,
    url: o.place_id ? 'https://www.google.com/maps/place/?q=place_id:' + o.place_id : '',
    status: o.unclaimed_listing ? 'UNCLAIMED' : '',
    verifikasi: o.unclaimed_listing ? false : true,
  };
}

async function cariSerpApi(key, query) {
  const u = new URL('https://serpapi.com/search.json');
  u.searchParams.set('engine', 'google_maps');
  u.searchParams.set('type', 'search');
  u.searchParams.set('q', query);
  u.searchParams.set('hl', 'id');
  u.searchParams.set('gl', 'id');
  u.searchParams.set('api_key', key);
  try {
    const res = await fetch(u);
    const j = await res.json().catch(() => ({}));
    if (j.error) {
      if (/hasn't returned any results|no results/i.test(String(j.error))) return { places: [], query };
      return { error: 'SerpApi: ' + j.error };
    }
    if (!res.ok) return { error: `SerpApi menolak permintaan (HTTP ${res.status}). Periksa API key.` };
    // satu hasil pasti bisa dikembalikan sebagai place_results, banyak hasil sebagai local_results
    const rows = Array.isArray(j.local_results) ? j.local_results : j.place_results ? [j.place_results] : [];
    return { places: rows.filter((o) => o && o.title).slice(0, 5).map(petaSerpApi), query };
  } catch (err) {
    return { error: 'Tidak bisa menghubungi SerpApi. Periksa koneksi internet. (' + err.message + ')' };
  }
}

ipcMain.handle('maps:search', async (e, input) => {
  const st = getSettings();
  const skey = String(st.serpApiKey || '').trim();
  const okey = String(st.outscraperKey || '').trim();
  const key = String(st.mapsApiKey || '').trim();
  if (!skey && !okey && !key) return { error: 'API key belum diisi. Buka menu Pengaturan > Google Maps.' };
  const query = await mapsQueryDariInput(input);
  if (!query) return { error: 'Isi link Google Maps atau nama bisnis terlebih dahulu.' };
  // Urutan pemakaian: SerpApi, lalu Outscraper, lalu Google Places API (sesuai key yang diisi).
  if (skey) return cariSerpApi(skey, query);
  if (okey) return cariOutscraper(okey, query, /^https?:\/\//i.test(String(input).trim()) ? 1 : 3);
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': PLACES_FIELDS },
      body: JSON.stringify({ textQuery: query, languageCode: 'id', regionCode: 'ID', pageSize: 5 }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return { error: (j.error && j.error.message) || `Google menolak permintaan (HTTP ${res.status}).` };
    const places = (j.places || []).map((p) => ({
      nama: (p.displayName && p.displayName.text) || '',
      alamat: p.formattedAddress || '',
      rating: p.rating == null ? '' : p.rating,
      ulasan: p.userRatingCount == null ? 0 : p.userRatingCount,
      kategoriUtama: (p.primaryTypeDisplayName && p.primaryTypeDisplayName.text) || '',
      website: p.websiteUri || '',
      telepon: p.nationalPhoneNumber || '',
      punyaJam: !!p.regularOpeningHours,
      url: p.googleMapsUri || '',
      status: p.businessStatus || '',
    }));
    return { places, query };
  } catch (err) {
    return { error: 'Tidak bisa menghubungi Google. Periksa koneksi internet. (' + err.message + ')' };
  }
});
