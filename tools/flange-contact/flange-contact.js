/* ============================================================
   Egg Tools - Flange Contact Area
   Draws the faces of a flanged joint and finds where they touch.

   Two mating annular surfaces each have an ID and an OD. They only
   touch where both exist, so the contact annulus is:

     ID_contact = max(ID_1, ID_2)         OD_contact = min(OD_1, OD_2)
     A_contact  = π/4 · (OD_contact² − ID_contact²)

   Everything is held in INCHES internally and converted for display.
   Pipe OD / wall come from pipe-data.js (CS_SIZES, HDPE_SIZES); the
   flange sizes below are approximate ASME B16.5 Class 150 values.
   They are a starting point only - every dimension is editable, and
   HDPE adapter / stub end dimensions in particular vary by maker.
   ============================================================ */

/* ASME B16.5 Class 150, approximate. fo = flange OD, rf = raised face
   diameter, t = slip-on thickness, bore = slip-on / lap joint bore. */
const FC_FLANGE = {
  '3':  { fo: 7.5,  rf: 5.00,  t: 0.75, bore: 3.58 },
  '4':  { fo: 9,    rf: 6.19,  t: 0.94, bore: 4.57 },
  '6':  { fo: 11,   rf: 8.50,  t: 1.00, bore: 6.72 },
  '8':  { fo: 13.5, rf: 10.62, t: 1.12, bore: 8.72 },
  '10': { fo: 16,   rf: 12.75, t: 1.19, bore: 10.88 },
  '12': { fo: 19,   rf: 15.00, t: 1.25, bore: 12.88 },
  '14': { fo: 21,   rf: 16.25, t: 1.38, bore: 14.14 },
  '16': { fo: 23.5, rf: 18.50, t: 1.44, bore: 16.16 },
  '18': { fo: 25,   rf: 21.00, t: 1.56, bore: 18.20 },
  '20': { fo: 27.5, rf: 23.00, t: 1.69, bore: 20.25 },
  '24': { fo: 32,   rf: 27.25, t: 1.88, bore: 24.25 }
};

const FC_LEN = {
  in: { label: 'in', f: 1,    dp: 3, step: 0.001 },
  mm: { label: 'mm', f: 25.4, dp: 1 }
};

/* ── Component library ──────────────────────────────────────
   Each component is drawn as the LEFT side of the joint with its
   mating face at x = 0 and the pipe running off to −x. The right
   side is the same thing mirrored. Polygons are [x, r] in inches
   (r = radius from the pipe centreline).

   face(p)    : the sealing face that meets the other side's face
   bearing(p) : optional second interface inside the same side
                (loose flange / ring bearing on the back of a lap or
                collar). x is the plane's distance behind the face.
   draw(p, d) : polygons for the half-section, d = { L, h } where
                L is the pipe stub length and h the raised-face height. */
const FC_COMP = {
  slipon: {
    label: 'Slip-on flange (raised face)',
    short: 'Slip-on RF',
    steel: true,
    params: [
      { k: 'pipeOD', label: 'Pipe OD' },
      { k: 'pipeID', label: 'Pipe ID' },
      { k: 'bore',   label: 'Flange bore' },
      { k: 'rf',     label: 'Raised face OD' },
      { k: 'fo',     label: 'Flange OD' },
      { k: 't',      label: 'Flange thickness' }
    ],
    defaults: (pipe, fl) => ({ pipeOD: pipe.od, pipeID: pipe.id, bore: fl.bore, rf: fl.rf, fo: fl.fo, t: fl.t }),
    face: p => ({ name: 'Slip-on raised face', id: p.bore, od: p.rf, idK: 'bore', odK: 'rf' }),
    bearing: null,
    draw(p, d) {
      const B = p.bore / 2, G = p.rf / 2, F = p.fo / 2, ro = p.pipeOD / 2, ri = p.pipeID / 2;
      const T = p.t, L = d.L, h = d.h;
      const sb = Math.min(Math.max((ro - ri), 0.1), 0.3);   // pipe set back from the face
      const w = Math.max(0.12, (ro - ri) * 0.7);             // back fillet weld leg
      return [
        { cls: 'steel', pts: [[0, B], [0, G], [-h, G], [-h, F], [-T, F], [-T, B]] },
        { cls: 'steel', pts: [[-sb, ri], [-sb, ro], [-T - L, ro], [-T - L, ri]] },
        { cls: 'weld',  pts: [[-T, ro], [-T, ro + w], [-T - w, ro]] }
      ];
    }
  },

  lap: {
    label: 'Lap joint (stub end + loose flange)',
    short: 'Lap joint',
    steel: true,
    params: [
      { k: 'pipeOD', label: 'Pipe OD' },
      { k: 'pipeID', label: 'Stub end ID' },
      { k: 'lap',    label: 'Lap (face) OD' },
      { k: 'tl',     label: 'Lap thickness' },
      { k: 'bore',   label: 'Loose flange bore' },
      { k: 'fo',     label: 'Flange OD' },
      { k: 't',      label: 'Flange thickness' }
    ],
    defaults: (pipe, fl) => ({ pipeOD: pipe.od, pipeID: pipe.id, lap: fl.rf, tl: Math.max(0.25, pipe.wall), bore: fl.bore, fo: fl.fo, t: fl.t }),
    face: p => ({ name: 'Stub end face', id: p.pipeID, od: p.lap, idK: 'pipeID', odK: 'lap' }),
    bearing: p => ({
      x: p.tl,
      s1: { name: 'Loose flange face', id: p.bore, od: p.fo, idK: 'bore', odK: 'fo' },
      s2: { name: 'Stub end lap back', id: p.pipeOD, od: p.lap, idK: 'pipeOD', odK: 'lap' }
    }),
    draw(p, d) {
      const G = p.lap / 2, ro = p.pipeOD / 2, ri = p.pipeID / 2, B = p.bore / 2, F = p.fo / 2;
      const tl = p.tl, T = p.t, L = d.L;
      return [
        { cls: 'steel', pts: [[0, ri], [0, G], [-tl, G], [-tl, ro], [-tl - T - L, ro], [-tl - T - L, ri]] },
        { cls: 'steel', pts: [[-tl, B], [-tl, F], [-tl - T, F], [-tl - T, B]] }
      ];
    }
  },

  hdpe: {
    label: 'HDPE flange adapter + backing ring',
    short: 'HDPE adapter',
    steel: false,
    params: [
      { k: 'pipeOD', label: 'Pipe / adapter OD' },
      { k: 'pipeID', label: 'Pipe / adapter ID' },
      { k: 'face',   label: 'Sealing face OD' },
      { k: 'tc',     label: 'Collar thickness' },
      { k: 'rbore',  label: 'Backing ring bore' },
      { k: 'fo',     label: 'Backing ring OD' },
      { k: 't',      label: 'Backing ring thickness' }
    ],
    defaults: (pipe, fl) => ({
      pipeOD: pipe.od, pipeID: pipe.id, face: fl.rf, tc: +(0.5 + 0.04 * pipe.od).toFixed(2),
      rbore: +(pipe.od + Math.max(0.12, 0.01 * pipe.od)).toFixed(3), fo: fl.fo, t: fl.t
    }),
    face: p => ({ name: 'HDPE adapter face', id: p.pipeID, od: p.face, idK: 'pipeID', odK: 'face' }),
    bearing: p => ({
      x: p.tc,
      s1: { name: 'Backing ring face', id: p.rbore, od: p.fo, idK: 'rbore', odK: 'fo' },
      s2: { name: 'Adapter collar back', id: p.pipeOD, od: p.face, idK: 'pipeOD', odK: 'face' }
    }),
    draw(p, d) {
      const G = p.face / 2, ro = p.pipeOD / 2, ri = p.pipeID / 2, R = p.rbore / 2, F = p.fo / 2;
      const tc = p.tc, T = p.t, L = d.L;
      return [
        { cls: 'hdpe',  pts: [[0, ri], [0, G], [-tc, G], [-tc, ro], [-tc - T - L, ro], [-tc - T - L, ri]] },
        { cls: 'steel', pts: [[-tc, R], [-tc, F], [-tc - T, F], [-tc - T, R]] }
      ];
    }
  }
};

const FC_JOINTS = [
  { id: 'slipon-slipon', label: 'Slip-on flange to slip-on flange',           a: 'slipon', b: 'slipon' },
  { id: 'lap-lap',       label: 'Lap joint to lap joint',                     a: 'lap',    b: 'lap' },
  { id: 'hdpe-hdpe',     label: 'HDPE flange adapter to HDPE flange adapter', a: 'hdpe',   b: 'hdpe' },
  { id: 'hdpe-slipon',   label: 'HDPE flange adapter to slip-on flange',      a: 'hdpe',   b: 'slipon' },
  { id: 'hdpe-lap',      label: 'HDPE flange adapter to lap joint',           a: 'hdpe',   b: 'lap' }
];

/* ── State ───────────────────────────────────────────────── */
const fcState = { joint: 'hdpe-slipon', nps: '4', sched: 'STD', dr: 11, unit: 'in', iface: 'seal', A: {}, B: {},
  gasket: { on: false, type: 'ring', id: 0, od: 0, t: 0.125 } };

const $ = id => document.getElementById(id);
const SVGNS = 'http://www.w3.org/2000/svg';

function fcJoint() { return FC_JOINTS.find(j => j.id === fcState.joint); }
function fcComp(side) { return FC_COMP[fcJoint()[side === 'A' ? 'a' : 'b']]; }

/* ── Defaults from the pipe tables ───────────────────────── */
function fcPipe(steel) {
  const row = steel
    ? CS_SIZES.find(s => s.nps === fcState.nps)
    : HDPE_SIZES.find(s => s.nps === fcState.nps);
  const od = row.od_in;
  let wall;
  if (steel) wall = row.walls[fcState.sched] ?? row.walls.STD;
  else wall = od / fcState.dr;
  return { od, wall, id: od - 2 * wall };
}

function fcLoadDefaults() {
  const fl = FC_FLANGE[fcState.nps];
  for (const side of ['A', 'B']) {
    const c = fcComp(side);
    fcState[side] = c.defaults(fcPipe(c.steel), fl);
  }
  fcGasketDefaults();
}

/* Ring gasket: steel pipe ID out to the raised face. Full face: out to the flange OD. */
function fcGasketDefaults() {
  const fl = FC_FLANGE[fcState.nps], g = fcState.gasket;
  g.id = fcPipe(true).id;
  g.od = g.type === 'full' ? fl.fo : fl.rf;
  g.t = 0.125;
}

/* ── Unit helpers ────────────────────────────────────────── */
const fcToDisp = v => v * FC_LEN[fcState.unit].f;
const fcFromDisp = v => v / FC_LEN[fcState.unit].f;
const fcLen = v => fcToDisp(v).toFixed(FC_LEN[fcState.unit].dp);
function fcArea(v_in2) {
  const f = FC_LEN[fcState.unit].f;
  const a = v_in2 * f * f;
  return fcState.unit === 'in' ? a.toFixed(2) : Math.round(a).toLocaleString('en-US');
}
function fcAreaAlt(v_in2) {
  // second unit shown under the main figure
  return fcState.unit === 'in'
    ? (v_in2 * 645.16).toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' mm²'
    : (v_in2).toFixed(3) + ' in²';
}
const fcAreaUnit = () => (fcState.unit === 'in' ? 'in²' : 'mm²');
const fcAnnulus = (id, od) => (od > id ? Math.PI / 4 * (od * od - id * id) : 0);

/* ── Interface selection ─────────────────────────────────── */
function fcInterfaces() {
  const list = fcState.gasket.on
    ? [{ id: 'gA', label: 'Side A face to gasket' }, { id: 'gB', label: 'Gasket to side B face' }]
    : [{ id: 'seal', label: 'Sealing faces (A face to B face)' }];
  for (const side of ['A', 'B']) {
    const c = fcComp(side);
    if (c.bearing) {
      const b = c.bearing(fcState[side]);
      list.push({ id: 'bear' + side, label: `Side ${side} bearing (${b.s1.name.toLowerCase()} on ${b.s2.name.toLowerCase()})` });
    }
  }
  return list;
}

function fcActiveInterface() {
  const list = fcInterfaces();
  if (!list.some(i => i.id === fcState.iface)) fcState.iface = list[0].id;
  const id = fcState.iface;
  const fA = () => { const f = fcComp('A').face(fcState.A); f.name = 'A: ' + f.name; f.obj = 'A'; return f; };
  const fB = () => { const f = fcComp('B').face(fcState.B); f.name = 'B: ' + f.name; f.obj = 'B'; return f; };
  const gk = () => ({ name: 'Gasket', id: fcState.gasket.id, od: fcState.gasket.od, idK: 'id', odK: 'od', obj: 'gasket' });
  if (id === 'seal') return { id, s1: fA(), s2: fB(), x: 0, gs: 0, dir1: -1, side: null };
  if (id === 'gA') return { id, s1: fA(), s2: gk(), x: 0, gs: 0, dir1: -1, side: null };
  if (id === 'gB') return { id, s1: gk(), s2: fB(), x: 0, gs: 1, dir1: -1, side: null };
  const side = id.slice(-1);
  const b = fcComp(side).bearing(fcState[side]);
  b.s1.obj = b.s2.obj = side;
  const sign = side === 'A' ? -1 : 1;           // which way the side runs from the face
  return { id, s1: b.s1, s2: b.s2, x: sign * b.x, gs: side === 'B' && fcState.gasket.on ? 1 : 0, dir1: sign, side };
}

function fcContact(s1, s2) {
  const id = Math.max(s1.id, s2.id), od = Math.min(s1.od, s2.od);
  const ok = od > id;
  return {
    id, od, ok,
    idBy: s1.id >= s2.id ? 1 : 2,
    odBy: s1.od <= s2.od ? 1 : 2,
    area: ok ? fcAnnulus(id, od) : 0
  };
}

/* Radial ranges of a surface that has nothing to touch. */
function fcOnly(s, c) {
  if (!c.ok) return [[s.id, s.od]];
  const r = [];
  if (c.id > s.id) r.push([s.id, c.id]);
  if (s.od > c.od) r.push([c.od, s.od]);
  return r;
}

/* ── SVG helpers ─────────────────────────────────────────── */
function el(name, attrs, parent, text) {
  const e = document.createElementNS(SVGNS, name);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (text != null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}

function ringPath(cx, cy, ro, ri) {
  let d = `M${cx + ro} ${cy}A${ro} ${ro} 0 1 0 ${cx - ro} ${cy}A${ro} ${ro} 0 1 0 ${cx + ro} ${cy}Z`;
  if (ri > 0) d += `M${cx + ri} ${cy}A${ri} ${ri} 0 1 0 ${cx - ri} ${cy}A${ri} ${ri} 0 1 0 ${cx + ri} ${cy}Z`;
  return d;
}

function svgDefs(svg, uid) {
  const defs = el('defs', {}, svg);
  const mk = (id, rot, col) => {
    const p = el('pattern', { id: id + uid, width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: `rotate(${rot})` }, defs);
    el('rect', { width: 7, height: 7, fill: col, 'fill-opacity': 0.16 }, p);
    el('line', { x1: 0, y1: 0, x2: 0, y2: 7, stroke: col, 'stroke-width': 2.2 }, p);
  };
  mk('hA', 45, 'var(--blue)');
  mk('hB', -45, 'var(--gold)');
  return defs;
}

function label(svg, x, y, txt, opts = {}) {
  const a = { x, y, class: 'dim-txt' + (opts.cls ? ' ' + opts.cls : '') + (opts.edit ? ' editable' : ''), 'text-anchor': opts.anchor || 'middle' };
  const t = el('text', a, svg, txt);
  if (opts.edit) {
    el('title', {}, t, 'Click to edit');
    t.addEventListener('click', () => fcEditLabel(t, opts.edit));
  }
  return t;
}

/* Click a contact ID / OD label to edit it in place. The value belongs to
   whichever surface sets it, so that is the dimension that gets changed. */
function fcEditLabel(textEl, ed) {
  document.querySelectorAll('.label-edit').forEach(e => e.remove());
  const host = textEl.closest('.viz-body');
  const hr = host.getBoundingClientRect(), tr = textEl.getBoundingClientRect();
  const wrap = document.createElement('div');
  wrap.className = 'label-edit';
  wrap.style.left = Math.max(4, tr.left - hr.left - 8) + 'px';
  wrap.style.top = Math.max(4, tr.top - hr.top - 6) + 'px';
  const inp = document.createElement('input');
  inp.type = 'number'; inp.step = 'any'; inp.min = '0';
  inp.value = +fcToDisp(ed.value).toFixed(4);
  const cap = document.createElement('div');
  cap.textContent = `${ed.which.toUpperCase()} of ${ed.surface.name} (${FC_LEN[fcState.unit].label})`;
  wrap.append(inp, cap);
  host.appendChild(wrap);
  inp.focus(); inp.select();
  let done = false;
  const finish = ok => {
    if (done) return;
    done = true;
    const v = parseFloat(inp.value);
    wrap.remove();
    if (!ok || !(v > 0)) return;
    const target = ed.surface.obj === 'gasket' ? fcState.gasket : fcState[ed.surface.obj];
    target[ed.which === 'id' ? ed.surface.idK : ed.surface.odK] = fcFromDisp(v);
    syncParamInputs(); syncGasketInputs();
    render();
  };
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') finish(true);
    else if (e.key === 'Escape') finish(false);
  });
  inp.addEventListener('blur', () => finish(true));
}

/* Which surface sets the contact ID / OD, and its current value. */
function fcEdit(I, C, which) {
  const surface = (which === 'id' ? C.idBy : C.odBy) === 1 ? I.s1 : I.s2;
  return { which, surface, value: which === 'id' ? C.id : C.od };
}

/* ── Plan view (looking along the bolt axis) ─────────────── */
function drawPlan(I, C) {
  const svg = $('plan-svg');
  svg.innerHTML = '';
  const S = 400, cx = S / 2, cy = S / 2;
  svgDefs(svg, 'p');
  const rmax = Math.max(I.s1.od, I.s2.od) / 2;
  const k = 150 / rmax;                       // px per inch

  const draw = (rng, fill) => rng.forEach(([a, b]) =>
    el('path', { d: ringPath(cx, cy, b / 2 * k, a / 2 * k), fill, 'fill-rule': 'evenodd', stroke: 'none' }, svg));
  draw(fcOnly(I.s1, C), 'url(#hAp)');
  draw(fcOnly(I.s2, C), 'url(#hBp)');
  if (C.ok) {
    el('path', { d: ringPath(cx, cy, C.od / 2 * k, C.id / 2 * k), fill: 'var(--green)', 'fill-opacity': 0.5, 'fill-rule': 'evenodd', stroke: 'var(--green)', 'stroke-width': 1.5 }, svg);
  }
  // outlines of both surfaces
  [I.s1, I.s2].forEach((s, i) => {
    const col = i === 0 ? 'var(--blue)' : 'var(--gold)';
    el('circle', { cx, cy, r: s.od / 2 * k, fill: 'none', stroke: col, 'stroke-width': 1, 'stroke-dasharray': '4 3', opacity: 0.8 }, svg);
    el('circle', { cx, cy, r: s.id / 2 * k, fill: 'none', stroke: col, 'stroke-width': 1, 'stroke-dasharray': '4 3', opacity: 0.8 }, svg);
  });
  // centre marks
  el('line', { x1: 14, y1: cy, x2: S - 14, y2: cy, class: 'cl' }, svg);
  el('line', { x1: cx, y1: 14, x2: cx, y2: S - 14, class: 'cl' }, svg);

  if (C.ok) {
    const ri = C.id / 2 * k, ro = C.od / 2 * k;
    // ID dimension: chord along the horizontal, label in the bore
    el('line', { x1: cx - ri, y1: cy + 18, x2: cx + ri, y2: cy + 18, class: 'dimline' }, svg);
    label(svg, cx, cy + 14, 'ID ' + fcLen(C.id) + ' ' + FC_LEN[fcState.unit].label, { cls: 'dim-id', edit: fcEdit(I, C, 'id') });
    // OD dimension: diagonal diameter
    const a = -Math.PI / 4, dx = Math.cos(a) * ro, dy = Math.sin(a) * ro;
    el('line', { x1: cx - dx, y1: cy - dy, x2: cx + dx, y2: cy + dy, class: 'dimline od' }, svg);
    label(svg, cx + dx + 4, cy + dy - 6, 'OD ' + fcLen(C.od) + ' ' + FC_LEN[fcState.unit].label, { anchor: 'start', cls: 'dim-od', edit: fcEdit(I, C, 'od') });
  }
}

/* ── Half-section view ───────────────────────────────────── */
function bbox(polys) {
  let x0 = Infinity, x1 = -Infinity, r1 = 0, r0 = Infinity;
  polys.forEach(p => p.pts.forEach(([x, r]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); r1 = Math.max(r1, r); r0 = Math.min(r0, r); }));
  return { x0, x1, r1, r0 };
}
const mirror = polys => polys.map(p => ({ cls: p.cls, pts: p.pts.map(([x, r]) => [-x, r]) }));

function drawSection(I, C) {
  const svg = $('sec-svg');
  svg.innerHTML = '';
  const W = 780, H = 400, m = 28, base = H - 46;     // base = y of the centreline
  svgDefs(svg, 's');

  const pipeLen = 0.45 * Math.max(fcState.A.pipeOD, fcState.B.pipeOD);
  const gk = fcState.gasket;
  const build = (h, tg) => {
    const d = { L: pipeLen, h };
    const b = mirror(fcComp('B').draw(fcState.B, d)).map(p => ({ cls: p.cls, pts: p.pts.map(([x, r]) => [x + tg, r]) }));
    return [fcComp('A').draw(fcState.A, d), b];
  };
  let [pa, pb] = build(0, gk.on ? gk.t : 0);
  const ba = bbox(pa), bb = bbox(pb);
  const extL = -ba.x0, extR = bb.x1;
  const rmax = Math.max(ba.r1, bb.r1);
  // the bore is empty space, so crop the radial axis just under the pipe ID
  const rmin = 0.85 * Math.min(ba.r0, bb.r0);
  const s = Math.min((W - 2 * m) / (extL + extR), (base - m) / (rmax - rmin));
  const tg = gk.on ? Math.max(gk.t, 4 / s) : 0;        // gasket never thinner than ~4px
  [pa, pb] = build(Math.max(0.0625, 3 / s), tg);       // raised face never thinner than ~3px
  const ox = m + ((W - 2 * m) - (extL + extR + tg - (gk.on ? gk.t : 0)) * s) / 2 + extL * s;
  const X = x => ox + x * s, Y = r => base - (r - rmin) * s;

  el('line', { x1: m / 2, y1: base + 6, x2: W - m / 2, y2: base + 6, class: 'cl' }, svg);
  label(svg, W - m / 2, base + 20, 'radial axis cropped: this line is ' + fcLen(rmin) + ' ' + FC_LEN[fcState.unit].label + ' from the pipe centreline', { anchor: 'end', cls: 'faint' });

  [...pa, ...pb].forEach(p =>
    el('polygon', { points: p.pts.map(([x, r]) => `${X(x)},${Y(r)}`).join(' '), class: 'part ' + p.cls }, svg));

  if (gk.on) {
    el('polygon', { points: [[0, gk.id / 2], [0, gk.od / 2], [tg, gk.od / 2], [tg, gk.id / 2]].map(([x, r]) => `${X(x)},${Y(r)}`).join(' '), class: 'part gasket' }, svg);
  }

  // interface highlight
  const xi = I.x + I.gs * tg;
  const off = 3.5;
  const seg = (x, r0, r1, dir, cls) =>
    el('line', { x1: X(x) + dir * off, y1: Y(r0 / 2), x2: X(x) + dir * off, y2: Y(r1 / 2), class: 'hl ' + cls }, svg);
  fcOnly(I.s1, C).forEach(([a, b]) => seg(xi, a, b, I.dir1, 'hl-a'));
  fcOnly(I.s2, C).forEach(([a, b]) => seg(xi, a, b, -I.dir1, 'hl-b'));
  if (C.ok) {
    el('line', { x1: X(xi), y1: Y(C.id / 2), x2: X(xi), y2: Y(C.od / 2), class: 'hl hl-c' }, svg);
    const u = FC_LEN[fcState.unit].label;
    const ax = !I.side || I.side === 'A' ? X(xi) + 10 : X(xi) - 10;
    const an = !I.side || I.side === 'A' ? 'start' : 'end';
    label(svg, ax, Y(C.od / 2) - 5, 'OD ' + fcLen(C.od) + ' ' + u, { anchor: an, cls: 'dim-od', edit: fcEdit(I, C, 'od') });
    label(svg, ax, Y(C.id / 2) + 14, 'ID ' + fcLen(C.id) + ' ' + u, { anchor: an, cls: 'dim-id', edit: fcEdit(I, C, 'id') });
  }

  // side captions
  label(svg, m, H - 12, 'A: ' + fcComp('A').short, { anchor: 'start', cls: 'cap' });
  label(svg, W - m, H - 12, 'B: ' + fcComp('B').short, { anchor: 'end', cls: 'cap' });
}

/* ── Results ─────────────────────────────────────────────── */
function fcWarnings() {
  const w = [];
  for (const side of ['A', 'B']) {
    const p = fcState[side], c = fcComp(side);
    if (p.pipeID >= p.pipeOD) w.push(`Side ${side}: pipe ID is not smaller than pipe OD.`);
    if (p.bore != null && p.bore < p.pipeOD) w.push(`Side ${side}: flange bore is smaller than the pipe OD, so the pipe will not pass through.`);
    if (p.rbore != null && p.rbore < p.pipeOD) w.push(`Side ${side}: backing ring bore is smaller than the pipe OD.`);
    const f = c.face(p);
    if (f.od <= f.id) w.push(`Side ${side}: sealing face OD is not larger than its ID.`);
    if (p.fo != null && p.fo < f.od) w.push(`Side ${side}: flange OD is smaller than the sealing face OD.`);
  }
  const g = fcState.gasket;
  if (g.on && g.od <= g.id) w.push('Gasket OD is not larger than its ID.');
  return w;
}

function render() {
  const I = fcActiveInterface();
  const C = fcContact(I.s1, I.s2);
  const u = FC_LEN[fcState.unit].label;

  $('o-id').textContent = C.ok ? fcLen(C.id) : '–';
  $('o-od').textContent = C.ok ? fcLen(C.od) : '–';
  $('o-w').textContent = C.ok ? fcLen((C.od - C.id) / 2) : '–';
  $('o-area').textContent = C.ok ? fcArea(C.area) : '0';
  document.querySelectorAll('.u-len').forEach(e => (e.textContent = u));
  $('o-area-u').textContent = fcAreaUnit();
  $('o-area-alt').textContent = C.ok ? '= ' + fcAreaAlt(C.area) : '';
  $('o-id-by').textContent = C.ok ? 'set by ' + (C.idBy === 1 ? I.s1.name : I.s2.name) : '';
  $('o-od-by').textContent = C.ok ? 'set by ' + (C.odBy === 1 ? I.s1.name : I.s2.name) : '';

  // per-surface table
  const rows = [I.s1, I.s2].map((s, i) => {
    const a = fcAnnulus(s.id, s.od), inC = C.area;
    const pct = a > 0 ? (inC / a * 100) : 0;
    const col = i === 0 ? 'var(--blue)' : 'var(--gold)';
    return `<tr>
      <td><span class="swatch" style="background:${col}"></span>${s.name}</td>
      <td>${fcLen(s.id)}</td><td>${fcLen(s.od)}</td>
      <td>${fcArea(a)}</td><td>${fcArea(Math.max(0, a - inC))}</td>
      <td>${pct.toFixed(1)}%</td></tr>`;
  }).join('');
  $('surf-body').innerHTML = rows;
  $('surf-area-h').textContent = 'Area (' + fcAreaUnit() + ')';
  $('surf-free-h').textContent = 'Not touching (' + fcAreaUnit() + ')';
  $('surf-id-h').textContent = 'ID (' + u + ')';
  $('surf-od-h').textContent = 'OD (' + u + ')';

  const notes = fcWarnings();
  if (!C.ok) notes.unshift('These two surfaces do not overlap, so there is no contact area.');
  const nb = $('warn-box');
  nb.style.display = notes.length ? '' : 'none';
  nb.querySelector('div').innerHTML = notes.map(n => '<div>' + n + '</div>').join('');

  drawPlan(I, C);
  drawSection(I, C);
}

/* ── Controls ────────────────────────────────────────────── */
function fillSelect(sel, items, cur) {
  sel.innerHTML = '';
  items.forEach(([v, t]) => {
    const o = document.createElement('option');
    o.value = v; o.textContent = t;
    if (String(v) === String(cur)) o.selected = true;
    sel.appendChild(o);
  });
}

function buildSchedules() {
  const row = CS_SIZES.find(s => s.nps === fcState.nps);
  const keys = CS_SCHED_ORDER.filter(k => row.walls[k] != null);
  if (!keys.includes(fcState.sched)) fcState.sched = keys.includes('STD') ? 'STD' : keys[0];
  fillSelect($('f-sched'), keys.map(k => [k, k + '  (' + row.walls[k].toFixed(3) + ' in)']), fcState.sched);
}

function buildParams() {
  for (const side of ['A', 'B']) {
    const c = fcComp(side);
    $('side-' + side + '-title').textContent = `Side ${side}: ${c.label}`;
    const box = $('params-' + side);
    box.innerHTML = '';
    c.params.forEach(pr => {
      const f = document.createElement('div');
      f.className = 'field';
      f.innerHTML = `<label>${pr.label}</label><div class="input-with-unit"><input type="number" step="any" min="0" id="p-${side}-${pr.k}"><span class="u-len unit-tag"></span></div>`;
      box.appendChild(f);
      const inp = f.querySelector('input');
      inp.addEventListener('input', () => {
        const v = parseFloat(inp.value);
        if (!(v > 0)) return;
        fcState[side][pr.k] = fcFromDisp(v);
        render();
      });
    });
  }
}

function syncGasketInputs() {
  const g = fcState.gasket;
  $('f-gasket').checked = g.on;
  $('f-gtype').value = g.type;
  ['id', 'od', 't'].forEach(k => { $('g-' + k).value = +fcToDisp(g[k]).toFixed(4); });
}

function syncParamInputs() {
  for (const side of ['A', 'B']) {
    fcComp(side).params.forEach(pr => {
      const inp = $(`p-${side}-${pr.k}`);
      if (inp) inp.value = (+fcToDisp(fcState[side][pr.k]).toFixed(4));
    });
  }
}

function buildInterfaces() {
  const list = fcInterfaces();
  fillSelect($('f-iface'), list.map(i => [i.id, i.label]), fcState.iface);
}

function toggleConditional() {
  const j = fcJoint();
  const steel = [j.a, j.b].some(k => FC_COMP[k].steel);
  const hdpe = [j.a, j.b].some(k => !FC_COMP[k].steel);
  $('gasket-fields').style.display = fcState.gasket.on ? '' : 'none';
  $('fld-sched').style.display = steel ? '' : 'none';
  $('fld-dr').style.display = hdpe ? '' : 'none';
}

function resetAll() {
  fcLoadDefaults();
  buildInterfaces();
  buildParams();
  toggleConditional();
  syncParamInputs();
  syncGasketInputs();
  render();
}

function init() {
  fillSelect($('f-joint'), FC_JOINTS.map(j => [j.id, j.label]), fcState.joint);
  fillSelect($('f-nps'), Object.keys(FC_FLANGE).map(n => [n, 'NPS ' + n]), fcState.nps);
  fillSelect($('f-dr'), HDPE_DR.map(d => [d, 'DR ' + d]), fcState.dr);
  fillSelect($('f-unit'), Object.keys(FC_LEN).map(k => [k, FC_LEN[k].label]), fcState.unit);
  buildSchedules();

  $('f-joint').addEventListener('change', e => { fcState.joint = e.target.value; fcState.iface = 'seal'; resetAll(); });
  $('f-nps').addEventListener('change', e => { fcState.nps = e.target.value; buildSchedules(); resetAll(); });
  $('f-sched').addEventListener('change', e => { fcState.sched = e.target.value; resetAll(); });
  $('f-dr').addEventListener('change', e => { fcState.dr = parseFloat(e.target.value); resetAll(); });
  $('f-iface').addEventListener('change', e => { fcState.iface = e.target.value; render(); });
  $('f-unit').addEventListener('change', e => { fcState.unit = e.target.value; syncParamInputs(); syncGasketInputs(); render(); });
  $('f-gasket').addEventListener('change', e => { fcState.gasket.on = e.target.checked; buildInterfaces(); toggleConditional(); render(); });
  $('f-gtype').addEventListener('change', e => { fcState.gasket.type = e.target.value; fcGasketDefaults(); syncGasketInputs(); render(); });
  ['id', 'od', 't'].forEach(k => $('g-' + k).addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    if (!(v > 0)) return;
    fcState.gasket[k] = fcFromDisp(v);
    render();
  }));
  $('btn-reset').addEventListener('click', resetAll);

  resetAll();
}

document.addEventListener('DOMContentLoaded', init);
