/* ============================================================
   Photo → KMZ
   Turn a set of photos into a KMZ (a zip of doc.kml + the
   images) that opens in Google Earth with one pin per photo.

   Everything runs in the browser — no uploads, no libraries.
   The two "hard" pieces are hand-rolled and small:
     - a minimal EXIF reader (pulls GPS lat/lon + orientation)
     - a minimal ZIP writer (store method; KMZ is just a zip)
   ============================================================ */

(function () {
  'use strict';

  // ---- state -------------------------------------------------
  let photos = [];          // { id, file, name, lat, lon, caption, fromExif, thumbUrl }
  let seq = 0;

  const $ = (id) => document.getElementById(id);

  // ---- EXIF: minimal GPS + orientation reader ----------------
  // Reads the APP1/Exif segment of a JPEG and returns
  // { lat, lon, orientation } — any field may be undefined.
  function readExif(buffer) {
    const dv = new DataView(buffer);
    if (dv.byteLength < 4 || dv.getUint16(0) !== 0xffd8) return {}; // not a JPEG

    // Walk JPEG markers to find APP1 (0xFFE1) carrying "Exif\0\0".
    let offset = 2;
    let tiff = -1;
    while (offset + 4 <= dv.byteLength) {
      if (dv.getUint16(offset) !== 0xffe1) {
        // Not APP1 — skip this segment using its length field.
        if (dv.getUint8(offset) !== 0xff) break;
        const len = dv.getUint16(offset + 2);
        if (len < 2) break;
        offset += 2 + len;
        continue;
      }
      // APP1: check for the "Exif\0\0" identifier.
      if (dv.getUint32(offset + 4) === 0x45786966 && dv.getUint16(offset + 8) === 0x0000) {
        tiff = offset + 10;
      }
      break;
    }
    if (tiff < 0) return {};

    // TIFF header: byte order + magic 42.
    const le = dv.getUint16(tiff) === 0x4949;   // 'II' = little-endian
    const u16 = (o) => dv.getUint16(o, le);
    const u32 = (o) => dv.getUint32(o, le);
    if (u16(tiff + 2) !== 42) return {};

    const out = {};
    const ifd0 = tiff + u32(tiff + 4);

    // Read a rational (num/den) at a given absolute offset.
    const rational = (o) => u32(o) / (u32(o + 4) || 1);

    // Scan an IFD's entries, calling fn(tag, type, count, valueOffset).
    function eachEntry(ifd, fn) {
      if (ifd + 2 > dv.byteLength) return;
      const n = u16(ifd);
      for (let i = 0; i < n; i++) {
        const e = ifd + 2 + i * 12;
        if (e + 12 > dv.byteLength) return;
        fn(u16(e), u16(e + 2), u32(e + 4), e + 8);
      }
    }

    let gpsIfd = -1;
    eachEntry(ifd0, (tag, type, count, valOff) => {
      if (tag === 0x0112) out.orientation = u16(valOff);       // Orientation
      if (tag === 0x8825) gpsIfd = tiff + u32(valOff);          // GPS IFD pointer
    });

    if (gpsIfd >= 0) {
      let latRef, lonRef, lat, lon;
      const dms = (valOff) => {
        // 3 rationals (deg, min, sec); values live at valOff (a pointer).
        const p = tiff + u32(valOff);
        return rational(p) + rational(p + 8) / 60 + rational(p + 16) / 3600;
      };
      eachEntry(gpsIfd, (tag, type, count, valOff) => {
        if (tag === 1) latRef = String.fromCharCode(dv.getUint8(valOff));
        else if (tag === 2) lat = dms(valOff);
        else if (tag === 3) lonRef = String.fromCharCode(dv.getUint8(valOff));
        else if (tag === 4) lon = dms(valOff);
      });
      if (isFinite(lat) && isFinite(lon)) {
        out.lat = latRef === 'S' ? -lat : lat;
        out.lon = lonRef === 'W' ? -lon : lon;
      }
    }
    return out;
  }

  // ---- image resize (canvas) --------------------------------
  // Downscales to maxEdge and normalizes EXIF orientation,
  // returning JPEG bytes (Uint8Array). Falls back to the
  // original file bytes if anything goes wrong.
  async function encodeImage(file, maxEdge) {
    try {
      let bitmap;
      try {
        bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      } catch (e) {
        bitmap = await createImageBitmap(file);
      }
      let { width, height } = bitmap;
      const scale = Math.min(1, maxEdge / Math.max(width, height));
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
      if (bitmap.close) bitmap.close();

      const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
      if (!blob) throw new Error('toBlob failed');
      return new Uint8Array(await blob.arrayBuffer());
    } catch (e) {
      return new Uint8Array(await file.arrayBuffer());
    }
  }

  // ---- KML ---------------------------------------------------
  function xmlEscape(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  function buildKml(items, docName) {
    const marks = items.map((it) => {
      const desc =
        '<img src="' + it.path + '" style="max-width:480px;width:100%;height:auto;" />' +
        (it.caption ? '<br/><p>' + xmlEscape(it.caption) + '</p>' : '');
      return (
        '  <Placemark>\n' +
        '    <name>' + xmlEscape(it.name) + '</name>\n' +
        '    <description><![CDATA[' + desc + ']]></description>\n' +
        '    <Point><coordinates>' + it.lon + ',' + it.lat + ',0</coordinates></Point>\n' +
        '  </Placemark>'
      );
    }).join('\n');

    return (
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<kml xmlns="http://www.opengis.net/kml/2.2">\n' +
      '<Document>\n' +
      '  <name>' + xmlEscape(docName || 'Photos') + '</name>\n' +
      marks + '\n' +
      '</Document>\n</kml>\n'
    );
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

  // entries: [{ name, bytes: Uint8Array }]  → Blob (application/vnd.google-earth.kmz)
  function buildZip(entries) {
    const enc = new TextEncoder();
    const parts = [];       // ordered Uint8Array chunks for the file
    const central = [];     // central-directory records
    let offset = 0;

    const push = (u8) => { parts.push(u8); offset += u8.length; };
    const hdr = (size) => new DataView(new ArrayBuffer(size));

    for (const e of entries) {
      const nameBytes = enc.encode(e.name);
      const crc = crc32(e.bytes);
      const size = e.bytes.length;
      const localOffset = offset;

      const lh = hdr(30);
      lh.setUint32(0, 0x04034b50, true); // local file header sig
      lh.setUint16(4, 20, true);         // version needed
      lh.setUint16(6, 0, true);          // flags
      lh.setUint16(8, 0, true);          // method: store
      lh.setUint16(10, 0, true);         // mod time
      lh.setUint16(12, 0, true);         // mod date
      lh.setUint32(14, crc, true);
      lh.setUint32(18, size, true);      // compressed size
      lh.setUint32(22, size, true);      // uncompressed size
      lh.setUint16(26, nameBytes.length, true);
      lh.setUint16(28, 0, true);         // extra length
      push(new Uint8Array(lh.buffer));
      push(nameBytes);
      push(e.bytes);

      const cd = hdr(46);
      cd.setUint32(0, 0x02014b50, true); // central dir sig
      cd.setUint16(4, 20, true);         // version made by
      cd.setUint16(6, 20, true);         // version needed
      cd.setUint16(8, 0, true);
      cd.setUint16(10, 0, true);         // method: store
      cd.setUint16(12, 0, true);
      cd.setUint16(14, 0, true);
      cd.setUint32(16, crc, true);
      cd.setUint32(20, size, true);
      cd.setUint32(24, size, true);
      cd.setUint16(28, nameBytes.length, true);
      cd.setUint16(30, 0, true);         // extra
      cd.setUint16(32, 0, true);         // comment
      cd.setUint16(34, 0, true);         // disk number
      cd.setUint16(36, 0, true);         // internal attrs
      cd.setUint32(38, 0, true);         // external attrs
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

    return new Blob(parts, { type: 'application/vnd.google-earth.kmz' });
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

  // ---- ingest -----------------------------------------------
  async function addFiles(fileList) {
    const files = Array.from(fileList).filter((f) => /^image\//.test(f.type) || /\.(jpe?g|png)$/i.test(f.name));
    for (const file of files) {
      const id = ++seq;
      const photo = {
        id, file,
        name: baseName(file.name),
        lat: '', lon: '', caption: '',
        fromExif: false,
        thumbUrl: URL.createObjectURL(file),
      };
      photos.push(photo);

      // Try to pull GPS from EXIF (JPEG only).
      if (/jpe?g/i.test(file.type) || /\.jpe?g$/i.test(file.name)) {
        try {
          const exif = readExif(await file.arrayBuffer());
          if (exif.lat != null && exif.lon != null) {
            photo.lat = exif.lat.toFixed(6);
            photo.lon = exif.lon.toFixed(6);
            photo.fromExif = true;
          }
        } catch (e) { /* ignore — user can enter coords */ }
      }
    }
    render();
  }

  // ---- rendering --------------------------------------------
  function render() {
    const list = $('photo-list');
    const empty = $('empty-state');
    list.innerHTML = '';

    if (!photos.length) {
      empty.style.display = '';
      updateBuildState();
      return;
    }
    empty.style.display = 'none';

    photos.forEach((p, idx) => {
      const card = document.createElement('div');
      card.className = 'photo-card input-panel';

      const badge = p.fromExif
        ? '<span class="loc-badge ok">GPS from photo</span>'
        : (hasCoords(p) ? '<span class="loc-badge set">coords set</span>'
                        : '<span class="loc-badge warn">needs coordinates</span>');

      card.innerHTML =
        '<div class="pc-thumb"><img src="' + p.thumbUrl + '" alt=""><span class="pc-num">' + (idx + 1) + '</span></div>' +
        '<div class="pc-fields">' +
          '<div class="pc-row1">' +
            '<input class="pc-name" type="text" value="' + escAttr(p.name) + '" placeholder="Name" data-k="name" data-id="' + p.id + '">' +
            badge +
            '<button class="pc-remove" title="Remove" data-remove="' + p.id + '">✕</button>' +
          '</div>' +
          '<div class="pc-coords">' +
            '<div class="field"><label>Latitude</label><input type="text" inputmode="decimal" value="' + escAttr(p.lat) + '" placeholder="e.g. -33.8688" data-k="lat" data-id="' + p.id + '"></div>' +
            '<div class="field"><label>Longitude</label><input type="text" inputmode="decimal" value="' + escAttr(p.lon) + '" placeholder="e.g. 151.2093" data-k="lon" data-id="' + p.id + '"></div>' +
            '<div class="field paste-field"><label>Paste "lat, lon"</label><input type="text" placeholder="paste from Google Maps" data-paste="' + p.id + '"></div>' +
          '</div>' +
          '<div class="field"><label>Caption (optional)</label><input type="text" value="' + escAttr(p.caption) + '" placeholder="Shown under the photo" data-k="caption" data-id="' + p.id + '"></div>' +
        '</div>';

      list.appendChild(card);
    });

    updateBuildState();
  }

  function escAttr(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function hasCoords(p) {
    const la = parseFloat(p.lat), lo = parseFloat(p.lon);
    return isFinite(la) && la >= -90 && la <= 90 && isFinite(lo) && lo >= -180 && lo <= 180;
  }

  function updateBuildState() {
    const notice = $('build-notice');
    const btn = $('build-btn');
    if (!photos.length) {
      notice.className = 'notice notice-info';
      notice.innerHTML = 'Add some photos to get started.';
      btn.disabled = true;
      $('count-label').textContent = '';
      return;
    }
    const missing = photos.filter((p) => !hasCoords(p)).length;
    $('count-label').textContent = photos.length + (photos.length === 1 ? ' photo' : ' photos');
    if (missing) {
      notice.className = 'notice notice-danger';
      notice.innerHTML = '<strong>' + missing + '</strong> of ' + photos.length +
        ' ' + (photos.length === 1 ? 'photo' : 'photos') + ' still need coordinates. Fill them in (or read them from a geotagged photo) before building.';
      btn.disabled = true;
    } else {
      notice.className = 'notice notice-info';
      notice.innerHTML = 'Ready — <strong>' + photos.length + '</strong> ' +
        (photos.length === 1 ? 'photo' : 'photos') + ' with coordinates.';
      btn.disabled = false;
    }
  }

  // ---- build ------------------------------------------------
  async function build() {
    if (photos.some((p) => !hasCoords(p))) return;
    const btn = $('build-btn');
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = 'Building…';

    try {
      const docName = $('doc-name').value.trim() || 'Photos';
      const downscale = $('downscale').checked;
      const maxEdge = Math.max(200, parseInt($('max-edge').value, 10) || 1600);

      const entries = [];
      const items = [];
      let n = 0;

      for (const p of photos) {
        n++;
        const path = 'files/photo' + n + '.jpg';
        const bytes = downscale
          ? await encodeImage(p.file, maxEdge)
          : new Uint8Array(await p.file.arrayBuffer());
        entries.push({ name: path, bytes });
        items.push({
          name: p.name || ('Photo ' + n),
          caption: p.caption,
          lat: parseFloat(p.lat),
          lon: parseFloat(p.lon),
          path: path,
        });
      }

      const kml = buildKml(items, docName);
      // doc.kml must be the first entry in a KMZ.
      entries.unshift({ name: 'doc.kml', bytes: new TextEncoder().encode(kml) });

      const blob = buildZip(entries);
      download(blob, sanitize(docName, 'photos') + '.kmz');
    } catch (e) {
      const notice = $('build-notice');
      notice.className = 'notice notice-danger';
      notice.textContent = 'Something went wrong building the KMZ: ' + (e && e.message ? e.message : e);
    } finally {
      btn.textContent = original;
      updateBuildState();
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
    input.addEventListener('change', () => { addFiles(input.files); input.value = ''; });

    ['dragenter', 'dragover'].forEach((ev) =>
      drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach((ev) =>
      drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('drag'); }));
    drop.addEventListener('drop', (e) => {
      if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
    });

    // Delegated input handling for the per-photo fields.
    $('photo-list').addEventListener('input', (e) => {
      const t = e.target;
      if (t.dataset.id && t.dataset.k) {
        const p = photos.find((x) => x.id === +t.dataset.id);
        if (!p) return;
        p[t.dataset.k] = t.value;
        if (t.dataset.k === 'lat' || t.dataset.k === 'lon') {
          p.fromExif = false;
          refreshBadge(p);
          updateBuildState();
        }
      } else if (t.dataset.paste) {
        const p = photos.find((x) => x.id === +t.dataset.paste);
        if (!p) return;
        const m = t.value.match(/(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)/);
        if (m) {
          p.lat = m[1]; p.lon = m[2]; p.fromExif = false;
          t.value = '';
          render();
        }
      }
    });

    $('photo-list').addEventListener('click', (e) => {
      const rm = e.target.getAttribute && e.target.getAttribute('data-remove');
      if (rm) {
        const id = +rm;
        const p = photos.find((x) => x.id === id);
        if (p && p.thumbUrl) URL.revokeObjectURL(p.thumbUrl);
        photos = photos.filter((x) => x.id !== id);
        render();
      }
    });

    $('downscale').addEventListener('change', () => {
      $('max-edge-wrap').style.opacity = $('downscale').checked ? '1' : '0.4';
      $('max-edge').disabled = !$('downscale').checked;
    });

    $('build-btn').addEventListener('click', build);
    $('clear-btn').addEventListener('click', () => {
      photos.forEach((p) => p.thumbUrl && URL.revokeObjectURL(p.thumbUrl));
      photos = [];
      render();
    });

    render();
  }

  // Update just the badge on one card without a full re-render
  // (keeps input focus while typing coordinates).
  function refreshBadge(p) {
    const card = Array.from(document.querySelectorAll('.photo-card')).find((c) =>
      c.querySelector('[data-id="' + p.id + '"]'));
    if (!card) return;
    const badge = card.querySelector('.loc-badge');
    if (!badge) return;
    if (hasCoords(p)) {
      badge.className = 'loc-badge set';
      badge.textContent = 'coords set';
    } else {
      badge.className = 'loc-badge warn';
      badge.textContent = 'needs coordinates';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose pure functions for testing in Node/console.
  window.PhotoKMZ = { readExif, buildKml, crc32, buildZip };
})();
