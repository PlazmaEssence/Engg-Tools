/* ============================================================
   KML → Excel
   Read a KML route and produce an .xlsx spreadsheet with one
   row per vertex: longitude, latitude, elevation (the raw
   coordinate values) plus segment length and a running
   cumulative length (chainage) along each path.

   Everything runs in the browser — no uploads, no libraries.
   The two "hard" pieces are hand-rolled and small:
     - a KML reader (LineString + gx:Track vertices via DOMParser)
     - a minimal XLSX writer (an .xlsx is just a zip of a few
       small XML parts; written with the store method + CRC32,
       the same trick the Photo → KMZ tool uses for KMZ)
   ============================================================ */

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  // Length unit → metres, and display decimals.
  const UNITS = {
    m:  { label: 'm',  perMetre: 1,            dec: 2 },
    km: { label: 'km', perMetre: 1 / 1000,     dec: 4 },
    ft: { label: 'ft', perMetre: 3.280839895,  dec: 2 },
    mi: { label: 'mi', perMetre: 1 / 1609.344, dec: 4 },
  };

  // ---- state -------------------------------------------------
  let paths = [];       // [{ name, points: [{ lon, lat, ele }] }]
  let sourceName = '';  // KML file base name, for the download name

  // ---- KML parsing ------------------------------------------
  // Split a KML <coordinates> body ("lon,lat,alt lon,lat,alt …")
  // into [{ lon, lat, ele }]. Altitude is optional.
  function parseCoordString(text) {
    const out = [];
    const tuples = String(text || '').trim().split(/\s+/);
    for (const t of tuples) {
      if (!t) continue;
      const parts = t.split(',');
      const lon = parseFloat(parts[0]);
      const lat = parseFloat(parts[1]);
      const ele = parts.length > 2 ? parseFloat(parts[2]) : NaN;
      if (isFinite(lon) && isFinite(lat)) out.push({ lon, lat, ele: isFinite(ele) ? ele : null });
    }
    return out;
  }

  // Local-name lookup that ignores namespace prefixes (kml, gx…).
  function localName(el) {
    return el.localName || el.nodeName.replace(/^.*:/, '');
  }
  function childText(el, name) {
    for (const c of el.children) {
      if (localName(c) === name) return c.textContent;
    }
    return '';
  }
  // Nearest ancestor Placemark's <name>, for labelling the path.
  function placemarkName(el) {
    let n = el.parentNode;
    while (n && n.nodeType === 1) {
      if (localName(n) === 'Placemark') {
        const nm = childText(n, 'name').trim();
        if (nm) return nm;
        break;
      }
      n = n.parentNode;
    }
    return '';
  }

  // Pull every ordered vertex list out of a KML document:
  // <LineString>/<coordinates>, <LinearRing>/<coordinates>, and
  // <gx:Track> (a series of <gx:coord>lon lat alt</gx:coord>).
  function parseKml(text) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) {
      throw new Error('This file is not valid XML/KML.');
    }
    const all = doc.getElementsByTagName('*');
    const found = [];
    let unnamed = 0;

    for (const el of all) {
      const tag = localName(el);
      let points = null;

      if (tag === 'LineString' || tag === 'LinearRing') {
        points = parseCoordString(childText(el, 'coordinates'));
      } else if (tag === 'Track') { // gx:Track
        points = [];
        for (const c of el.children) {
          if (localName(c) !== 'coord') continue;
          const p = c.textContent.trim().split(/\s+/).map(parseFloat);
          if (isFinite(p[0]) && isFinite(p[1])) {
            points.push({ lon: p[0], lat: p[1], ele: isFinite(p[2]) ? p[2] : null });
          }
        }
      }

      if (points && points.length) {
        const name = placemarkName(el) || ('Path ' + (++unnamed));
        found.push({ name, points });
      }
    }
    return found;
  }

  // ---- geometry ---------------------------------------------
  // Great-circle distance in metres between two lat/lon points.
  function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371008.8; // mean Earth radius (metres)
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  // Distance in metres between two consecutive vertices, optionally
  // folding in the elevation change (a 3D / slope distance).
  function segMetres(a, b, use3d) {
    const flat = haversine(a.lat, a.lon, b.lat, b.lon);
    if (use3d && a.ele != null && b.ele != null) {
      const dz = b.ele - a.ele;
      return Math.sqrt(flat * flat + dz * dz);
    }
    return flat;
  }

  // ---- rows --------------------------------------------------
  // Flatten every path into spreadsheet rows. Cumulative length
  // restarts at 0 at the first vertex of each path (chainage).
  function buildRows(use3d, unitKey) {
    const u = UNITS[unitKey] || UNITS.m;
    const rows = [];
    const multi = paths.length > 1;
    for (const path of paths) {
      let cumM = 0;
      path.points.forEach((pt, i) => {
        const segM = i === 0 ? 0 : segMetres(path.points[i - 1], pt, use3d);
        cumM += segM;
        rows.push({
          path: multi ? path.name : '',
          idx: i + 1,
          lon: pt.lon,
          lat: pt.lat,
          ele: pt.ele != null ? pt.ele * u.perMetre : null,
          seg: segM * u.perMetre,
          cum: cumM * u.perMetre,
        });
      });
    }
    return { rows, unit: u, multi };
  }

  // ---- number formatting for the preview --------------------
  function fmt(n, dec) {
    if (n == null || !isFinite(n)) return '';
    return n.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }

  // ---- minimal XLSX writer ----------------------------------
  function xmlEscape(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  // Convert a 1-based column index to a spreadsheet letter (1→A).
  function colLetter(n) {
    let s = '';
    while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = (n - r - 1) / 26; }
    return s;
  }

  // Cell style ids defined in styles.xml below:
  //   1 = bold header, 2 = coordinate (6 dp), 3 = length (2 dp)
  function cellNum(col, row, value, style) {
    if (value == null || !isFinite(value)) return '';
    const ref = colLetter(col) + row;
    const s = style ? ' s="' + style + '"' : '';
    return '<c r="' + ref + '"' + s + '><v>' + value + '</v></c>';
  }
  function cellStr(col, row, value, style) {
    const ref = colLetter(col) + row;
    const s = style ? ' s="' + style + '"' : '';
    return '<c r="' + ref + '"' + s + ' t="inlineStr"><is><t xml:space="preserve">' +
      xmlEscape(value) + '</t></is></c>';
  }

  // Build the worksheet XML from header labels + data rows.
  // columns: [{ header, key, kind: 'str'|'num', style }]
  function buildSheet(columns, rows) {
    let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>';

    // column widths
    xml += '<cols>';
    columns.forEach((c, i) => {
      const w = c.kind === 'str' ? 22 : 15;
      xml += '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>';
    });
    xml += '</cols><sheetData>';

    // header
    xml += '<row r="1">';
    columns.forEach((c, i) => { xml += cellStr(i + 1, 1, c.header, 1); });
    xml += '</row>';

    // data
    rows.forEach((row, r) => {
      const rn = r + 2;
      xml += '<row r="' + rn + '">';
      columns.forEach((c, i) => {
        const v = row[c.key];
        if (c.kind === 'str') {
          if (v !== '' && v != null) xml += cellStr(i + 1, rn, v, c.style);
        } else {
          xml += cellNum(i + 1, rn, v, c.style);
        }
      });
      xml += '</row>';
    });

    xml += '</sheetData></worksheet>';
    return xml;
  }

  function stylesXml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<numFmts count="2">' +
      '<numFmt numFmtId="164" formatCode="0.000000"/>' +
      '<numFmt numFmtId="165" formatCode="#,##0.00"/>' +
      '</numFmts>' +
      '<fonts count="2">' +
      '<font><sz val="11"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="11"/><name val="Calibri"/></font>' +
      '</fonts>' +
      '<fills count="2"><fill><patternFill patternType="none"/></fill>' +
      '<fill><patternFill patternType="gray125"/></fill></fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="4">' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
      '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
      '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
      '</cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '</styleSheet>';
  }

  // Assemble the fixed package parts around one worksheet.
  function buildXlsx(sheetXml, sheetName) {
    const enc = new TextEncoder();
    const files = [
      ['[Content_Types].xml',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '</Types>'],
      ['_rels/.rels',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>'],
      ['xl/workbook.xml',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<sheets><sheet name="' + xmlEscape(sheetName) + '" sheetId="1" r:id="rId1"/></sheets>' +
        '</workbook>'],
      ['xl/_rels/workbook.xml.rels',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        '</Relationships>'],
      ['xl/styles.xml', stylesXml()],
      ['xl/worksheets/sheet1.xml', sheetXml],
    ];
    const entries = files.map(([name, body]) => ({ name, bytes: enc.encode(body) }));
    return buildZip(entries, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }

  // ---- minimal ZIP writer (store / no compression) ----------
  const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  // entries: [{ name, bytes: Uint8Array }] → Blob (mimeType)
  function buildZip(entries, mimeType) {
    const enc = new TextEncoder();
    const parts = [];
    const central = [];
    let offset = 0;

    const push = (u8) => { parts.push(u8); offset += u8.length; };
    const hdr = (size) => new DataView(new ArrayBuffer(size));

    for (const e of entries) {
      const nameBytes = enc.encode(e.name);
      const crc = crc32(e.bytes);
      const size = e.bytes.length;
      const localOffset = offset;

      const lh = hdr(30);
      lh.setUint32(0, 0x04034b50, true);
      lh.setUint16(4, 20, true);
      lh.setUint16(6, 0, true);
      lh.setUint16(8, 0, true);          // method: store
      lh.setUint16(10, 0, true);
      lh.setUint16(12, 0, true);
      lh.setUint32(14, crc, true);
      lh.setUint32(18, size, true);
      lh.setUint32(22, size, true);
      lh.setUint16(26, nameBytes.length, true);
      lh.setUint16(28, 0, true);
      push(new Uint8Array(lh.buffer));
      push(nameBytes);
      push(e.bytes);

      const cd = hdr(46);
      cd.setUint32(0, 0x02014b50, true);
      cd.setUint16(4, 20, true);
      cd.setUint16(6, 20, true);
      cd.setUint16(8, 0, true);
      cd.setUint16(10, 0, true);         // method: store
      cd.setUint16(12, 0, true);
      cd.setUint16(14, 0, true);
      cd.setUint32(16, crc, true);
      cd.setUint32(20, size, true);
      cd.setUint32(24, size, true);
      cd.setUint16(28, nameBytes.length, true);
      cd.setUint16(30, 0, true);
      cd.setUint16(32, 0, true);
      cd.setUint16(34, 0, true);
      cd.setUint16(36, 0, true);
      cd.setUint32(38, 0, true);
      cd.setUint32(42, localOffset, true);
      central.push({ head: new Uint8Array(cd.buffer), name: nameBytes });
    }

    const cdStart = offset;
    for (const c of central) { push(c.head); push(c.name); }
    const cdSize = offset - cdStart;

    const eocd = hdr(22);
    eocd.setUint32(0, 0x06054b50, true);
    eocd.setUint16(4, 0, true);
    eocd.setUint16(6, 0, true);
    eocd.setUint16(8, entries.length, true);
    eocd.setUint16(10, entries.length, true);
    eocd.setUint32(12, cdSize, true);
    eocd.setUint32(16, cdStart, true);
    eocd.setUint16(20, 0, true);
    push(new Uint8Array(eocd.buffer));

    return new Blob(parts, { type: mimeType });
  }

  // ---- helpers ----------------------------------------------
  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function sanitize(s, fallback) {
    const clean = String(s || '').trim().replace(/[^\w.\- ]+/g, '').replace(/\s+/g, '_');
    return clean || fallback;
  }
  function baseName(fileName) {
    return fileName.replace(/\.[^.]+$/, '') || fileName;
  }

  function options() {
    return {
      use3d: $('use-3d').checked,
      unit: $('length-unit').value,
    };
  }

  // Column definitions shared by the preview and the .xlsx.
  function columnsFor(multi, unitLabel) {
    const cols = [];
    if (multi) cols.push({ header: 'Path', key: 'path', kind: 'str', style: 0 });
    cols.push({ header: 'Point #', key: 'idx', kind: 'num', style: 0 });
    cols.push({ header: 'Longitude', key: 'lon', kind: 'num', style: 2 });
    cols.push({ header: 'Latitude', key: 'lat', kind: 'num', style: 2 });
    cols.push({ header: 'Elevation (' + unitLabel + ')', key: 'ele', kind: 'num', style: 3 });
    cols.push({ header: 'Segment (' + unitLabel + ')', key: 'seg', kind: 'num', style: 3 });
    cols.push({ header: 'Cumulative (' + unitLabel + ')', key: 'cum', kind: 'num', style: 3 });
    return cols;
  }

  // ---- rendering --------------------------------------------
  const PREVIEW_LIMIT = 200;

  function render() {
    const notice = $('status-notice');
    const wrap = $('table-wrap');
    const empty = $('empty-state');
    const bar = $('build-bar');

    if (!paths.length) {
      wrap.style.display = 'none';
      empty.style.display = 'none';
      bar.style.display = 'none';
      notice.className = 'notice notice-info';
      notice.textContent = 'Choose a KML file to get started.';
      $('build-btn').disabled = true;
      return;
    }

    const { use3d, unit } = options();
    const { rows, unit: u, multi } = buildRows(use3d, unit);
    const cols = columnsFor(multi, u.label);

    // status summary
    const pathWord = paths.length === 1 ? 'path' : 'paths';
    const totals = paths.map((p) => {
      let m = 0;
      for (let i = 1; i < p.points.length; i++) m += segMetres(p.points[i - 1], p.points[i], use3d);
      return m;
    });
    const grand = totals.reduce((s, m) => s + m, 0) * u.perMetre;
    notice.className = 'notice notice-info';
    notice.innerHTML = '<div><strong>' + rows.length + '</strong> ' +
      (rows.length === 1 ? 'vertex' : 'vertices') + ' across <strong>' + paths.length +
      '</strong> ' + pathWord + ' · total length <strong>' +
      fmt(grand, u.dec) + ' ' + u.label + '</strong>' +
      (use3d ? ' (3D)' : '') + '.</div>';

    // preview table (capped)
    let thead = '<thead><tr>';
    cols.forEach((c) => { thead += '<th class="' + (c.kind === 'str' ? 'txt' : '') + '">' + c.header + '</th>'; });
    thead += '</tr></thead>';

    const shown = rows.slice(0, PREVIEW_LIMIT);
    let tbody = '<tbody>';
    shown.forEach((row) => {
      tbody += '<tr>';
      cols.forEach((c) => {
        if (c.kind === 'str') {
          tbody += '<td class="txt">' + (row[c.key] || '') + '</td>';
        } else if (c.key === 'idx') {
          tbody += '<td>' + row.idx + '</td>';
        } else if (c.key === 'lon' || c.key === 'lat') {
          tbody += '<td>' + fmt(row[c.key], 6) + '</td>';
        } else {
          tbody += '<td>' + fmt(row[c.key], u.dec) + '</td>';
        }
      });
      tbody += '</tr>';
    });
    tbody += '</tbody>';

    $('preview').innerHTML = thead + tbody;
    const more = $('preview-more');
    if (rows.length > PREVIEW_LIMIT) {
      more.style.display = '';
      more.textContent = 'Showing first ' + PREVIEW_LIMIT + ' of ' + rows.length +
        ' rows — the download includes them all.';
    } else {
      more.style.display = 'none';
    }

    wrap.style.display = '';
    empty.style.display = 'none';
    bar.style.display = '';
    $('count-label').textContent = rows.length + (rows.length === 1 ? ' row' : ' rows');
    $('build-btn').disabled = rows.length === 0;
  }

  // ---- ingest -----------------------------------------------
  async function loadFile(file) {
    if (!file) return;
    const notice = $('status-notice');
    try {
      const text = await file.text();
      const found = parseKml(text);
      if (!found.length) {
        paths = [];
        render();
        notice.className = 'notice notice-danger';
        notice.textContent = 'No LineString routes or gx:Track paths found in this KML. ' +
          'This tool reads polyline routes — a KML of individual point pins won\'t produce a chainage.';
        return;
      }
      paths = found;
      sourceName = baseName(file.name);
      render();
    } catch (e) {
      paths = [];
      render();
      notice.className = 'notice notice-danger';
      notice.textContent = 'Could not read this file: ' + (e && e.message ? e.message : e);
    }
  }

  // ---- build ------------------------------------------------
  function build() {
    if (!paths.length) return;
    const btn = $('build-btn');
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Building…';
    try {
      const { use3d, unit } = options();
      const { rows, unit: u, multi } = buildRows(use3d, unit);
      const cols = columnsFor(multi, u.label);
      const sheetXml = buildSheet(cols, rows);
      const blob = buildXlsx(sheetXml, 'Route');
      download(blob, sanitize(sourceName, 'route') + '.xlsx');
    } catch (e) {
      const notice = $('status-notice');
      notice.className = 'notice notice-danger';
      notice.textContent = 'Something went wrong building the spreadsheet: ' + (e && e.message ? e.message : e);
    } finally {
      btn.textContent = original;
      btn.disabled = false;
    }
  }

  // ---- wiring -----------------------------------------------
  function init() {
    const drop = $('dropzone');
    const input = $('file-input');

    drop.addEventListener('click', () => input.click());
    drop.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
    });
    input.addEventListener('change', () => { if (input.files[0]) loadFile(input.files[0]); input.value = ''; });

    ['dragenter', 'dragover'].forEach((ev) =>
      drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach((ev) =>
      drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('drag'); }));
    drop.addEventListener('drop', (e) => {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
    });

    $('length-unit').addEventListener('change', () => { if (paths.length) render(); });
    $('use-3d').addEventListener('change', () => { if (paths.length) render(); });

    $('build-btn').addEventListener('click', build);
    $('clear-btn').addEventListener('click', () => { paths = []; sourceName = ''; render(); });

    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose pure functions for testing in Node/console.
  window.KmlToExcel = { parseKml, parseCoordString, haversine, segMetres, buildRows, crc32, buildZip, buildXlsx, colLetter };
})();
