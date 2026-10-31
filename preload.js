'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const call = (ch) => (...a) => ipcRenderer.invoke(ch, ...a);

contextBridge.exposeInMainWorld('api', {
  init: call('app:init'),
  saveSettings: call('settings:save'),
  previewInvoice: call('preview:invoice'),
  previewPenawaran: call('preview:penawaran'),
  exportPdf: call('export:pdf'),
  exportDocx: call('export:docx'),
  reveal: call('file:reveal'),
  openFile: call('file:open'),
  saveHistory: call('history:save'),
  deleteHistory: call('history:delete'),
  setStatus: call('history:status'),
  openDataFolder: call('data:folder'),
});
