/* ============================================================
   Egg Tools — Pipe Flow & Velocity
   Pick a pipe (HDPE or carbon steel), NPS size and schedule/DR,
   and the tool autofills OD, wall thickness and inner diameter.
   OD/wall/ID stay editable and linked:
       edit ID   -> wall = (OD − ID) / 2
       edit wall -> ID   = OD − 2·wall
       edit OD   -> ID   = OD − 2·wall   (wall held)
   Any manual edit flips the schedule/DR dropdown to "Custom".

   Enter a flow rate (volume ÷ time, same compound dropdowns as the
   Unit Converter) to get the velocity — or enter a velocity to get
   the required flow rate. The two are linked live:
       A = π/4 · ID²      v = Q / A      Q = v · A

   The physics is done once in SI (m, m³/s, m/s); every unit list
   carries a factor to the SI base. The "Download Excel" button
   writes a small .xlsx whose cells are live formulas (with the
   unit-conversion factors as their own cells), so the sheet
   recalculates if you change an input — no pipe lookup, just the
   calculation.

   Dimensional data lives in pipe-data.js, loaded before this file.
   ============================================================ */

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const IN_TO_M = 0.0254; // table dimensions are stored in inches

  // ---- state -------------------------------------------------
  let category = 'cs';       // 'cs' | 'hdpe'
  let curDim = 'mm';         // pipe-dimension display unit key
  let curNum = 'usgal';      // flow numerator (volume) key
  let curDen = 'min';        // flow denominator (time) key
  let curVel = 'fps';        // velocity unit key
  let driver = 'flow';       // 'flow' | 'velocity' — which field was last set

  // ---- unit helpers ------------------------------------------
  const find = (table, key) => table.find((u) => u.key === key);
  const findSize = (table, nps) => table.find((s) => s.nps === nps);
  const dimFactor = (key) => find(FV_DIM_UNITS, key).factor;   // -> m
  const volFactor = (key) => find(FV_VOLUME_UNITS, key).factor; // -> m³
  const timeFactor = (key) => find(FV_TIME_UNITS, key).factor;  // -> s
  const velFactor = (key) => find(FV_VELOCITY_UNITS, key).factor; // -> m/s
  const sizeList = () => (category === 'cs' ? CS_SIZES : HDPE_SIZES);

  function num(node) {
    const v = parseFloat(node.value);
    return isNaN(v) ? NaN : v;
  }

  function trim(n) {
    if (!isFinite(n)) return '';
    if (Math.abs(n) >= 1e6 || (Math.abs(n) < 1e-4 && n !== 0)) return n.toExponential(4);
    return parseFloat(n.toPrecision(6)).toString();
  }

  // ---- pure calculation (exposed for testing) ----------------
  // ID in metres -> flow area in m².
  function areaM2(idM) {
    return (Math.PI / 4) * idM * idM;
  }
  // Q (m³/s), A (m²) -> velocity (m/s), and the inverse.
  function velFromFlow(qM3s, aM2) {
    return aM2 > 0 ? qM3s / aM2 : NaN;
  }
  function flowFromVel(vMs, aM2) {
    return vMs * aM2;
  }

  // ---- DOM refs ----------------------------------------------
  const catPillsEl = $('cat-pills');
  const sizeEl = $('size-select');
  const ratingEl = $('rating-select');
  const ratingLabelEl = $('rating-label');
  const dimEl = $('dim-unit');
  const odEl = $('f-od');
  const wallEl = $('f-wall');
  const idEl = $('f-id');
  const flowEl = $('f-flow');
  const flowUnitsEl = $('flow-units');
  const velEl = $('f-vel');
  const velUnitEl = $('vel-unit');
  const formulaEl = $('formula-box');
  const dlBtn = $('download-btn');

  // ---- option builders ---------------------------------------
  function optsFromTable(table, useSym) {
    return table.map((u) => `<option value="${u.key}">${useSym ? u.sym : u.label}</option>`).join('');
  }

  function ratingOptions() {
    let html;
    if (category === 'cs') {
      const size = findSize(CS_SIZES, sizeEl.value);
      const keys = CS_SCHED_ORDER.filter((k) => size && size.walls[k] != null);
      html = keys.map((k) => {
        const label = /^\d/.test(k) ? 'Sch ' + k : k; // "40" -> "Sch 40"; STD/XS/XXS as-is
        return `<option value="${k}">${label}</option>`;
      }).join('');
    } else {
      html = HDPE_DR.map((dr) => `<option value="${dr}">DR ${dr}</option>`).join('');
    }
    return html + '<option value="custom">Custom</option>';
  }

  // ---- populate ----------------------------------------------
  function renderCatPills() {
    const cats = [
      { key: 'cs', label: 'Carbon Steel' },
      { key: 'hdpe', label: 'HDPE' }
    ];
    catPillsEl.innerHTML = cats.map((c) =>
      `<button type="button" class="pill pill-gold${c.key === category ? ' active' : ''}" data-cat="${c.key}">${c.label}</button>`
    ).join('');
    catPillsEl.querySelectorAll('[data-cat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.cat === category) return;
        category = btn.dataset.cat;
        renderCatPills();
        populateSizes();
        applySize();
      });
    });
  }

  function populateSizes() {
    sizeEl.innerHTML = sizeList().map((s) => `<option value="${s.nps}">${s.nps}"</option>`).join('');
    // default to 6" if present, else first
    sizeEl.value = sizeList().some((s) => s.nps === '6') ? '6' : sizeList()[0].nps;
    ratingLabelEl.textContent = category === 'cs' ? 'Schedule' : 'DR (dimension ratio)';
  }

  function populateRatings() {
    ratingEl.innerHTML = ratingOptions();
    if (category === 'cs') {
      ratingEl.value = findSize(CS_SIZES, sizeEl.value).walls.STD != null ? 'STD' : ratingEl.options[0].value;
    } else {
      ratingEl.value = HDPE_DR.includes(11) ? '11' : String(HDPE_DR[0]);
    }
  }

  // ---- dimension autofill ------------------------------------
  // Write an inches value into a field in the current display unit.
  function setDimField(node, inches) {
    node.value = trim((inches * IN_TO_M) / dimFactor(curDim));
  }
  // Read a field (display unit) back to metres.
  function fieldM(node) {
    const v = num(node);
    return isNaN(v) ? NaN : v * dimFactor(curDim);
  }

  function applySize() {
    populateRatings();
    const size = findSize(sizeList(), sizeEl.value);
    setDimField(odEl, size.od_in);
    applyRating();
  }

  // Set wall (and ID) from the current schedule/DR selection.
  function applyRating() {
    const key = ratingEl.value;
    const size = findSize(sizeList(), sizeEl.value);
    setDimField(odEl, size.od_in);
    if (key !== 'custom') {
      let wallIn;
      if (category === 'cs') {
        wallIn = size.walls[key];
      } else {
        wallIn = size.od_in / parseFloat(key); // wall = OD / DR
      }
      setDimField(wallEl, wallIn);
    }
    // ID = OD − 2·wall
    idEl.value = trim((fieldM(odEl) - 2 * fieldM(wallEl)) / dimFactor(curDim));
    recompute();
  }

  // ---- OD / wall / ID coupling -------------------------------
  function markCustom() {
    ratingEl.value = 'custom';
  }
  function fromOD() {
    idEl.value = trim((fieldM(odEl) - 2 * fieldM(wallEl)) / dimFactor(curDim));
    markCustom();
    recompute();
  }
  function fromWall() {
    idEl.value = trim((fieldM(odEl) - 2 * fieldM(wallEl)) / dimFactor(curDim));
    markCustom();
    recompute();
  }
  function fromID() {
    wallEl.value = trim(((fieldM(odEl) - fieldM(idEl)) / 2) / dimFactor(curDim));
    markCustom();
    recompute();
  }

  // ---- flow / velocity ---------------------------------------
  function flowM3s() {
    const v = num(flowEl);
    return isNaN(v) ? NaN : v * (volFactor(curNum) / timeFactor(curDen));
  }
  function velMs() {
    const v = num(velEl);
    return isNaN(v) ? NaN : v * velFactor(curVel);
  }

  function recompute() {
    const idM = fieldM(idEl);
    const A = areaM2(idM);
    const badGeom = !isFinite(idM) || idM <= 0;

    if (driver === 'flow') {
      const Q = flowM3s();
      const v = badGeom ? NaN : velFromFlow(Q, A);
      velEl.value = isFinite(v) ? trim(v / velFactor(curVel)) : '';
    } else {
      const v = velMs();
      const Q = badGeom ? NaN : flowFromVel(v, A);
      flowEl.value = isFinite(Q) ? trim(Q / (volFactor(curNum) / timeFactor(curDen))) : '';
    }

    updateFormula(A, badGeom);
    dlBtn.disabled = badGeom || !isFinite(flowM3s()) || !isFinite(A) || A <= 0;
  }

  function updateFormula(A, badGeom) {
    if (badGeom) {
      formulaEl.textContent = 'Inner diameter must be positive — check OD and wall thickness.';
      return;
    }
    const idM = fieldM(idEl);
    const Q = flowM3s();
    const vMs = isFinite(Q) ? velFromFlow(Q, A) : velMs();
    const dimSym = find(FV_DIM_UNITS, curDim).sym;
    const volSym = find(FV_VOLUME_UNITS, curNum).sym;
    const timeSym = find(FV_TIME_UNITS, curDen).sym;
    const velSym = find(FV_VELOCITY_UNITS, curVel).sym;

    formulaEl.textContent =
      `A = π/4 · ID²\n` +
      `ID = ${trim(num(idEl))} ${dimSym} = ${trim(idM)} m\n` +
      `A  = π/4 × (${trim(idM)} m)² = ${trim(A)} m²\n` +
      `Q  = ${trim(num(flowEl))} ${volSym}/${timeSym} = ${trim(Q)} m³/s\n` +
      `v  = Q / A = ${trim(Q)} / ${trim(A)} = ${trim(vMs)} m/s = ${trim(vMs / velFactor(curVel))} ${velSym}`;
  }

  // ---- unit-change handlers (keep the physical value) --------
  function onDimChange() {
    const oldF = dimFactor(curDim);
    const newKey = dimEl.value;
    const newF = dimFactor(newKey);
    [odEl, wallEl, idEl].forEach((node) => {
      const v = num(node);
      if (isFinite(v)) node.value = trim((v * oldF) / newF);
    });
    curDim = newKey;
    recompute();
  }

  function onVelUnitChange() {
    const oldF = velFactor(curVel);
    curVel = velUnitEl.value;
    const newF = velFactor(curVel);
    const v = num(velEl);
    if (isFinite(v)) velEl.value = trim((v * oldF) / newF); // keep physical v
    recompute();
  }

  function onFlowUnitChange() {
    const oldF = volFactor(curNum) / timeFactor(curDen);
    curNum = flowUnitsEl.querySelector('[data-role="num"]').value;
    curDen = flowUnitsEl.querySelector('[data-role="den"]').value;
    const newF = volFactor(curNum) / timeFactor(curDen);
    const v = num(flowEl);
    if (isFinite(v)) flowEl.value = trim((v * oldF) / newF); // keep physical Q
    recompute();
  }

  // ---- build compound flow dropdowns -------------------------
  function buildFlowUnits() {
    flowUnitsEl.innerHTML =
      `<select class="unit-select" data-role="num">${optsFromTable(FV_VOLUME_UNITS, true)}</select>` +
      `<span class="unit-sep">/</span>` +
      `<select class="unit-select" data-role="den">${optsFromTable(FV_TIME_UNITS, true)}</select>`;
    flowUnitsEl.querySelector('[data-role="num"]').value = curNum;
    flowUnitsEl.querySelector('[data-role="den"]').value = curDen;
    flowUnitsEl.querySelectorAll('select').forEach((sel) =>
      sel.addEventListener('change', onFlowUnitChange));
  }

  /* =========================================================
     Excel export — minimal XLSX writer with live formulas.
     Adapted from tools/kml-to-excel/kml-to-excel.js and extended
     with a formula cell type. An .xlsx is just a zip of a few XML
     parts written with the store method + CRC32.
     ========================================================= */
  function xmlEscape(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }
  function colLetter(n) {
    let s = '';
    while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = (n - r - 1) / 26; }
    return s;
  }
  function cellXml(cell) {
    const ref = colLetter(cell.c) + cell.r;
    const s = cell.s ? ` s="${cell.s}"` : '';
    if (cell.kind === 'str') {
      return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xmlEscape(cell.v)}</t></is></c>`;
    }
    if (cell.kind === 'f') {
      return `<c r="${ref}"${s}><f>${xmlEscape(cell.f)}</f><v>${cell.v}</v></c>`;
    }
    return `<c r="${ref}"${s}><v>${cell.v}</v></c>`; // number
  }
  function buildSheet(cells) {
    const byRow = {};
    cells.forEach((c) => { (byRow[c.r] = byRow[c.r] || []).push(c); });
    let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<cols>' +
      '<col min="1" max="1" width="46" customWidth="1"/>' +
      '<col min="2" max="2" width="20" customWidth="1"/>' +
      '<col min="3" max="3" width="14" customWidth="1"/>' +
      '</cols><sheetData>';
    Object.keys(byRow).map(Number).sort((a, b) => a - b).forEach((r) => {
      xml += `<row r="${r}">` + byRow[r].sort((a, b) => a.c - b.c).map(cellXml).join('') + '</row>';
    });
    xml += '</sheetData></worksheet>';
    return xml;
  }
  function stylesXml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="3">' +
      '<font><sz val="11"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="11"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="12"/><name val="Calibri"/></font>' +
      '</fonts>' +
      '<fills count="3"><fill><patternFill patternType="none"/></fill>' +
      '<fill><patternFill patternType="gray125"/></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/><bgColor indexed="64"/></patternFill></fill></fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="4">' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +           // 0 normal
      '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' + // 1 bold
      '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' + // 2 title
      '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' + // 3 bold + highlight
      '</cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '</styleSheet>';
  }
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
      lh.setUint16(4, 20, true); lh.setUint16(6, 0, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, 0, true); lh.setUint16(12, 0, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, size, true); lh.setUint32(22, size, true);
      lh.setUint16(26, nameBytes.length, true); lh.setUint16(28, 0, true);
      push(new Uint8Array(lh.buffer)); push(nameBytes); push(e.bytes);

      const cd = hdr(46);
      cd.setUint32(0, 0x02014b50, true);
      cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0, true);
      cd.setUint16(10, 0, true); cd.setUint16(12, 0, true); cd.setUint16(14, 0, true);
      cd.setUint32(16, crc, true); cd.setUint32(20, size, true); cd.setUint32(24, size, true);
      cd.setUint16(28, nameBytes.length, true); cd.setUint16(30, 0, true); cd.setUint16(32, 0, true);
      cd.setUint16(34, 0, true); cd.setUint16(36, 0, true); cd.setUint32(38, 0, true);
      cd.setUint32(42, localOffset, true);
      central.push({ head: new Uint8Array(cd.buffer), name: nameBytes });
    }

    const cdStart = offset;
    for (const c of central) { push(c.head); push(c.name); }
    const cdSize = offset - cdStart;

    const eocd = hdr(22);
    eocd.setUint32(0, 0x06054b50, true);
    eocd.setUint16(4, 0, true); eocd.setUint16(6, 0, true);
    eocd.setUint16(8, entries.length, true); eocd.setUint16(10, entries.length, true);
    eocd.setUint32(12, cdSize, true); eocd.setUint32(16, cdStart, true); eocd.setUint16(20, 0, true);
    push(new Uint8Array(eocd.buffer));

    return new Blob(parts, { type: mimeType });
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  // Build the workbook cells from the current on-screen values.
  // Flow is always the input and velocity the computed result, so
  // the sheet reads the way the tool's headline calc does.
  function buildCells() {
    const dimSym = find(FV_DIM_UNITS, curDim).sym;
    const volSym = find(FV_VOLUME_UNITS, curNum).sym;
    const timeSym = find(FV_TIME_UNITS, curDen).sym;
    const velSym = find(FV_VELOCITY_UNITS, curVel).sym;

    const od = num(odEl), wall = num(wallEl);
    const idDisp = od - 2 * wall;
    const dF = dimFactor(curDim);
    const idM = idDisp * dF;
    const A = areaM2(idM);
    const qF = volFactor(curNum) / timeFactor(curDen);
    const flow = num(flowEl);
    const qM3s = flow * qF;
    const vMs = velFromFlow(qM3s, A);
    const vF = velFactor(curVel);
    const vOut = vMs / vF;

    const rows = [];
    const R = (r, c, kind, val, s, f) => rows.push({ r, c, kind, v: val, s, f });

    R(1, 1, 'str', 'Pipe Flow & Velocity — calculation', 2);
    R(2, 1, 'str', 'Change any input or factor cell (yellow result recalculates).', 0);

    R(4, 1, 'str', 'INPUTS', 1);
    R(5, 1, 'str', `Outer diameter (${dimSym})`, 0);   R(5, 2, 'num', od, 0);
    R(6, 1, 'str', `Wall thickness (${dimSym})`, 0);   R(6, 2, 'num', wall, 0);
    R(7, 1, 'str', `Flow rate (${volSym}/${timeSym})`, 0); R(7, 2, 'num', flow, 0);

    R(9, 1, 'str', 'CALCULATION', 1);
    R(10, 1, 'str', `Inner diameter (${dimSym}) = OD − 2·wall`, 0); R(10, 2, 'f', idDisp, 0, 'B5-2*B6');
    R(11, 1, 'str', `Dimension → metre factor (${dimSym})`, 0);    R(11, 2, 'num', dF, 0);
    R(12, 1, 'str', 'Inner diameter (m)', 0);                       R(12, 2, 'f', idM, 0, 'B10*B11');
    R(13, 1, 'str', 'Flow area A (m²) = π/4·ID²', 0);               R(13, 2, 'f', A, 0, 'PI()/4*B12^2');
    R(14, 1, 'str', `Flow → m³/s factor (${volSym}/${timeSym})`, 0); R(14, 2, 'num', qF, 0);
    R(15, 1, 'str', 'Flow rate Q (m³/s)', 0);                       R(15, 2, 'f', qM3s, 0, 'B7*B14');
    R(16, 1, 'str', 'Velocity (m/s) = Q / A', 0);                   R(16, 2, 'f', vMs, 0, 'B15/B13');
    R(17, 1, 'str', `m/s → ${velSym} factor`, 0);                   R(17, 2, 'num', vF, 0);
    R(18, 1, 'str', `Velocity (${velSym})`, 3);                     R(18, 2, 'f', vOut, 3, 'B16/B17');

    return rows;
  }

  function doDownload() {
    if (dlBtn.disabled) return;
    const original = dlBtn.textContent;
    dlBtn.disabled = true; dlBtn.textContent = 'Building…';
    try {
      const sheetXml = buildSheet(buildCells());
      const blob = buildXlsx(sheetXml, 'Velocity');
      const label = category === 'cs' ? 'CS' : 'HDPE';
      const name = `pipe-velocity_${label}_${sizeEl.value.replace(/\//g, '-')}in.xlsx`;
      download(blob, name);
    } finally {
      dlBtn.textContent = original;
      dlBtn.disabled = false;
      recompute();
    }
  }

  // ---- wiring ------------------------------------------------
  function init() {
    dimEl.innerHTML = optsFromTable(FV_DIM_UNITS, false);
    dimEl.value = curDim;
    velUnitEl.innerHTML = optsFromTable(FV_VELOCITY_UNITS, true);
    velUnitEl.value = curVel;

    renderCatPills();
    populateSizes();
    buildFlowUnits();

    dimEl.addEventListener('change', onDimChange);
    velUnitEl.addEventListener('change', onVelUnitChange);
    sizeEl.addEventListener('change', applySize);
    ratingEl.addEventListener('change', () => { if (ratingEl.value !== 'custom') applyRating(); });

    odEl.addEventListener('input', fromOD);
    wallEl.addEventListener('input', fromWall);
    idEl.addEventListener('input', fromID);

    flowEl.addEventListener('input', () => { driver = 'flow'; recompute(); });
    velEl.addEventListener('input', () => { driver = 'velocity'; recompute(); });

    dlBtn.addEventListener('click', doDownload);

    // seed defaults: 6" carbon steel STD, 500 US gal/min
    flowEl.value = '500';
    applySize();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose pure pieces for a Node/console test harness.
  window.FlowVelocity = {
    areaM2, velFromFlow, flowFromVel, colLetter, crc32, buildZip, buildXlsx, buildSheet
  };
})();
