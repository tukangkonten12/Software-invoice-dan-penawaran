'use strict';
const fs = require('fs');
const path = require('path');
const D = require('docx');
const F = require('./format');

const FONT = 'Times New Roman';
const SZ = 24; // 12pt
const PAGE_W = 11906;
const PAGE_H = 16838;
const MAR = { top: 2268, right: 1701, bottom: 1701, left: 1701, header: 709, footer: 709 };
const CONTENT_W = PAGE_W - MAR.left - MAR.right; // 8504

const tr = (text, o = {}) => new D.TextRun(Object.assign({ text, font: FONT, size: SZ }, o));
const rich = (text, o = {}) => F.runs(text).map((r) => tr(r.t, Object.assign({}, o, r.b ? { bold: true } : {})));

function pngSize(buf) {
  // IHDR: lebar di byte 16-19, tinggi 20-23
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

const thin = { style: D.BorderStyle.SINGLE, size: 4, color: '000000' };
const borders = { top: thin, bottom: thin, left: thin, right: thin };
const none = { style: D.BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBorders = { top: none, bottom: none, left: none, right: none };

function cell(text, width, o = {}) {
  return new D.TableCell({
    width: { size: width, type: D.WidthType.DXA },
    columnSpan: o.span,
    borders,
    verticalAlign: D.VerticalAlign.CENTER,
    shading: o.fill ? { type: D.ShadingType.CLEAR, color: 'auto', fill: o.fill } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: (Array.isArray(text) ? text : [text]).map(
      (t) =>
        new D.Paragraph({
          alignment: o.left ? D.AlignmentType.LEFT : D.AlignmentType.CENTER,
          children: [tr(t, { bold: !!o.bold, size: o.size || SZ })],
        })
    ),
  });
}

function tabel(t) {
  const widths = t.widths.map((p) => Math.round((CONTENT_W * p) / 100));
  widths[widths.length - 1] += CONTENT_W - widths.reduce((a, b) => a + b, 0);
  const n = widths.length;
  const rows = [];
  rows.push(new D.TableRow({ tableHeader: true, cantSplit: true, children: t.headers.map((h, i) => cell(h, widths[i], { bold: true, fill: 'F7CAAC' })) }));
  t.rows.forEach((r) => rows.push(new D.TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, widths[i])) })));
  if (t.total) {
    rows.push(
      new D.TableRow({
        cantSplit: true,
        children: [cell(t.total.label, widths[0], { bold: true }), cell(t.total.text, CONTENT_W - widths[0], { bold: true, span: n - 1 })],
      })
    );
  }
  if (t.notes.length) {
    rows.push(new D.TableRow({ cantSplit: true, children: [cell(t.notes, CONTENT_W, { span: n, left: true, size: 21 })] }));
  }
  return new D.Table({ width: { size: CONTENT_W, type: D.WidthType.DXA }, columnWidths: widths, rows });
}

const gap = (after = 120) => new D.Paragraph({ spacing: { after }, children: [] });

function blok(blocks) {
  return blocks.map((b) => {
    if (b.type === 'bullet') {
      return new D.Paragraph({ numbering: { reference: 'bullets', level: 0 }, alignment: D.AlignmentType.JUSTIFIED, spacing: { after: 40 }, children: rich(b.text) });
    }
    if (b.type === 'numhead') {
      return new D.Paragraph({
        keepNext: true,
        spacing: { before: 140, after: 40 },
        indent: { left: 567, hanging: 340 },
        tabStops: [{ type: D.TabStopType.LEFT, position: 567 }],
        children: [tr(`${b.num}.\t`, { bold: true }), ...rich(b.text, { bold: true })],
      });
    }
    return new D.Paragraph({ keepNext: true, spacing: { before: 240, after: 60 }, children: rich(b.text, { bold: true }) });
  });
}

async function buatDocx(m, assetsDir, portfolioFiles) {
  const logo = fs.readFileSync(path.join(assetsDir, 'logo.png'));
  const kop = m.kop;

  const header = new D.Header({
    children: [
      new D.Paragraph({
        alignment: D.AlignmentType.CENTER,
        children: [
          new D.ImageRun({
            type: 'png',
            data: logo,
            transformation: { width: 76, height: 66 },
            floating: {
              horizontalPosition: { relative: D.HorizontalPositionRelativeFrom.MARGIN, offset: -300000 },
              verticalPosition: { relative: D.VerticalPositionRelativeFrom.PARAGRAPH, offset: 0 },
              wrap: { type: D.TextWrappingType.NONE },
            },
          }),
          tr(kop.perusahaan, { bold: true, size: 36, color: 'D98509' }),
        ],
      }),
      new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [tr(kop.alamat1)] }),
      new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [tr(kop.alamat2)] }),
      new D.Paragraph({
        alignment: D.AlignmentType.CENTER,
        border: { bottom: { style: D.BorderStyle.SINGLE, size: 12, color: 'EFA725', space: 4 } },
        children: [tr(`Tlp : ${kop.telepon} | Website : ${kop.website}`)],
      }),
    ],
  });

  const body = [];
  body.push(new D.Paragraph({ alignment: D.AlignmentType.RIGHT, spacing: { before: 200, after: 240 }, children: [tr(m.tanggal)] }));
  const lbl = (a, b, bold) =>
    new D.Paragraph({
      tabStops: [{ type: D.TabStopType.LEFT, position: 1100 }, { type: D.TabStopType.LEFT, position: 1300 }],
      children: [tr(a, { bold: true }), tr('\t:\t', { bold: true }), tr(b, { bold })],
    });
  body.push(lbl('Perihal', m.perihal, false));
  body.push(lbl('Kepada', m.klien, true));
  body.push(new D.Paragraph({ spacing: { before: 240, after: 40 }, children: [tr('Dengan hormat,')] }));
  body.push(new D.Paragraph({ alignment: D.AlignmentType.JUSTIFIED, spacing: { after: 160 }, indent: { firstLine: 567 }, children: rich(m.intro) }));

  m.tables.forEach((t) => {
    if (t.title) body.push(new D.Paragraph({ keepNext: true, spacing: { before: 200, after: 100 }, children: [tr(t.title, { bold: true })] }));
    body.push(tabel(t));
    body.push(gap(80));
  });
  m.sections.forEach((s) => body.push(...blok(s)));

  body.push(gap(120));
  m.penutup.forEach((p) =>
    body.push(new D.Paragraph({ alignment: D.AlignmentType.JUSTIFIED, spacing: { after: 160 }, indent: { firstLine: 567 }, children: rich(p) }))
  );

  if (m.pembayaran) {
    body.push(new D.Paragraph({ keepNext: true, spacing: { before: 200 }, children: [tr('Sistem Pembayaran:', { bold: true })] }));
    body.push(new D.Paragraph({ keepNext: true, children: [tr('Untuk pembayaran bisa dilakukan melalui rekening berikut ini:')] }));
    body.push(new D.Paragraph({ keepNext: true, children: [tr(m.pembayaran.baris1, { bold: true })] }));
    body.push(new D.Paragraph({ children: [tr(m.pembayaran.baris2)] }));
  }

  body.push(new D.Paragraph({ keepNext: true, spacing: { before: 280 }, children: [tr('Hormat kami,', { bold: true })] }));
  body.push(new D.Paragraph({ keepNext: true, spacing: { after: 700 }, children: [] }));
  body.push(new D.Paragraph({ keepNext: true, children: [tr(m.ttd.nama, { bold: true })] }));
  body.push(new D.Paragraph({ keepNext: true, children: [tr(m.ttd.jabatan)] }));
  body.push(new D.Paragraph({ children: [tr(m.ttd.website)] }));

  if (m.portofolio && portfolioFiles && portfolioFiles.length) {
    body.push(new D.Paragraph({ pageBreakBefore: true, alignment: D.AlignmentType.CENTER, spacing: { after: 160 }, children: [tr('PORTOFOLIO KAMI', { bold: true })] }));
    const colW = Math.floor(CONTENT_W / 2);
    const boxW = 255; // piksel (~6.7 cm)
    const boxH = 320; // piksel (~8.5 cm)
    const mkImg = (file) => {
      if (!file) return new D.Paragraph({ children: [] });
      const data = fs.readFileSync(path.join(assetsDir, 'portfolio', file));
      const { w, h } = pngSize(data);
      const k = Math.min(boxW / w, boxH / h);
      return new D.Paragraph({
        alignment: D.AlignmentType.CENTER,
        spacing: { after: 160 },
        children: [new D.ImageRun({ type: 'png', data, transformation: { width: Math.round(w * k), height: Math.round(h * k) } })],
      });
    };
    const rows = [];
    for (let i = 0; i < portfolioFiles.length; i += 2) {
      rows.push(
        new D.TableRow({
          cantSplit: true,
          children: [portfolioFiles[i], portfolioFiles[i + 1]].map(
            (f) => new D.TableCell({ width: { size: colW, type: D.WidthType.DXA }, borders: noBorders, verticalAlign: D.VerticalAlign.CENTER, children: [mkImg(f)] })
          ),
        })
      );
    }
    body.push(new D.Table({ width: { size: colW * 2, type: D.WidthType.DXA }, columnWidths: [colW, colW], rows }));
  }

  const doc = new D.Document({
    creator: kop.perusahaan,
    title: `Penawaran ${m.klien}`,
    styles: { default: { document: { run: { font: FONT, size: SZ }, paragraph: { spacing: { line: 276 } } } } },
    numbering: {
      config: [
        {
          reference: 'bullets',
          levels: [
            {
              level: 0,
              format: D.LevelFormat.BULLET,
              text: '•',
              alignment: D.AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 1000, hanging: 360 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: { page: { size: { width: PAGE_W, height: PAGE_H }, margin: MAR } },
        headers: { default: header },
        children: body,
      },
    ],
  });
  return D.Packer.toBuffer(doc);
}

module.exports = { buatDocx };
