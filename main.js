'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { pathToFileURL } = require('url');

const { DEFAULT_SETTINGS, TEMPLATES } = require('./src/core/templates');
const { invoiceHtml, penawaranHtml } = require('./src/core/render-html');
const { bangunPenawaran } = require('./src/core/model');
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
}));

ipcMain.handle('settings:save', (e, s) => {
  writeJson(settingsFile(), s);
  return getSettings();
});

ipcMain.handle('preview:invoice', (e, data) => invoiceHtml(data, getSettings(), assetsUrl));

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
