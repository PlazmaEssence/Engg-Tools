/* ============================================================
   Egg Tools — Pipe Thermal Growth
   Free (unrestrained) axial expansion of a pipe run:

     ΔL = α · L · ΔT           ΔT = T_high − T_install

   Each input and the output carry their own unit dropdown, so
   any mix is allowed (e.g. length in ft, temperatures in °F, a
   coefficient in µm/(m·°C), output in mm).

   The coefficient α is normalized to strain per °C-degree. A
   value quoted "per °F" (µin/(in·°F), 1/°F, 1/°R) is multiplied
   by 1.8, since one °C step spans 1.8 °F worth of strain.

   Material quick-fills are approximate mean coefficients near
   room temperature — α is temperature-dependent, so real design
   should use the mean coefficient between installation and
   design temperature from the applicable code table.
   ============================================================ */

/* length units -> meters */
const TG_LEN = {
  um:  { label: 'µm',        f: 1e-6 },
  mm:  { label: 'mm',        f: 1e-3 },
  cm:  { label: 'cm',        f: 1e-2 },
  m:   { label: 'm',         f: 1 },
  mil: { label: 'mil (thou)', f: 2.54e-5 },
  in:  { label: 'in',        f: 0.0254 },
  ft:  { label: 'ft',        f: 0.3048 },
  yd:  { label: 'yd',        f: 0.9144 }
};
const TG_LEN_IN_ORDER  = ['mm', 'cm', 'm', 'in', 'ft', 'yd'];
const TG_LEN_OUT_ORDER = ['µm-key', 'mm', 'cm', 'm', 'mil', 'in', 'ft'];
// (µm belongs in the output list; keep the real key)
TG_LEN_OUT_ORDER[0] = 'um';

/* temperature units. Absolute conversions to/from °C, plus a flag
   for whether a *difference* in this unit scales by 5/9 to reach
   °C-degrees (true for °F and °R). */
const TG_TEMP = {
  C: { label: '°C', toC: v => v,               fromC: c => c,              deg: 1 },
  F: { label: '°F', toC: v => (v - 32) * 5 / 9, fromC: c => c * 9 / 5 + 32, deg: 5 / 9 },
  K: { label: 'K',  toC: v => v - 273.15,       fromC: c => c + 273.15,     deg: 1 },
  R: { label: '°R', toC: v => (v - 491.67) * 5 / 9, fromC: c => (c + 273.15) * 9 / 5, deg: 5 / 9 }
};
const TG_TEMP_ORDER = ['C', 'F', 'K', 'R'];

/* coefficient units -> strain per °C-degree.
   perC = value * f * (fam === 'F' ? 1.8 : 1) */
const TG_ALPHA = {
  um_m_C:   { label: 'µm/(m·°C)',   f: 1e-6, fam: 'C' },
  mm_m_C:   { label: 'mm/(m·°C)',   f: 1e-3, fam: 'C' },
  per_C:    { label: '1/°C',        f: 1,    fam: 'C' },
  per_K:    { label: '1/K',         f: 1,    fam: 'C' },
  uin_in_F: { label: 'µin/(in·°F)', f: 1e-6, fam: 'F' },
  per_F:    { label: '1/°F',        f: 1,    fam: 'F' },
  per_R:    { label: '1/°R',        f: 1,    fam: 'F' }
};
const TG_ALPHA_ORDER = ['um_m_C', 'mm_m_C', 'per_C', 'per_K', 'uin_in_F', 'per_F', 'per_R'];

/* material quick-fills (TG_MATERIALS) live in materials.js, loaded
   before this script — edit that data file to add materials. */

function tgAlphaPerC(value, key) {
  const u = TG_ALPHA[key];
  return value * u.f * (u.fam === 'F' ? 1.8 : 1);
}

(function initThermal() {
  // current unit state, so a dropdown change can convert the value
  let curLen = 'ft';
  let curTemp = 'F';
  let curAlpha = 'um_m_C';
  let curOut = 'in';

  const el = id => document.getElementById(id);
  const fLEl = el('f-L'), uLEl = el('u-L');
  const uTEl = el('u-T'), tInEl = el('f-Tinstall'), tHiEl = el('f-Thigh');
  const matEl = el('f-material'), fAEl = el('f-alpha'), uAEl = el('u-alpha');
  const uOutEl = el('u-out');
  const outDLEl = el('out-dL'), outDTEl = el('out-dT'), outStrainEl = el('out-strain');
  const formulaEl = el('formula-box');

  function opts(table, order) {
    return order.map(k => `<option value="${k}">${table[k].label}</option>`).join('');
  }

  function trim(n) {
    if (!isFinite(n)) return '—';
    if (Math.abs(n) >= 1e6 || (Math.abs(n) < 1e-4 && n !== 0)) return n.toExponential(4);
    return parseFloat(n.toPrecision(6)).toString();
  }

  function val(node) {
    const v = parseFloat(node.value);
    return isNaN(v) ? NaN : v;
  }

  // populate every dropdown
  uLEl.innerHTML = opts(TG_LEN, TG_LEN_IN_ORDER);
  uTEl.innerHTML = opts(TG_TEMP, TG_TEMP_ORDER);
  uAEl.innerHTML = opts(TG_ALPHA, TG_ALPHA_ORDER);
  uOutEl.innerHTML = opts(TG_LEN, TG_LEN_OUT_ORDER);
  matEl.innerHTML = TG_MATERIALS.map((m, i) => `<option value="${i}">${m.label}</option>`).join('');

  uLEl.value = curLen;
  uTEl.value = curTemp;
  uAEl.value = curAlpha;
  uOutEl.value = curOut;
  matEl.value = '1'; // Carbon steel matches the default α = 11.7 µm/(m·°C)

  function compute() {
    const L = val(fLEl);
    const Ti = val(tInEl);
    const Th = val(tHiEl);
    const alpha = val(fAEl);

    const tempU = TG_TEMP[curTemp];
    const dTdisp = Th - Ti;                 // in the selected temperature unit
    const dTc = dTdisp * tempU.deg;          // in °C-degrees
    const alphaPerC = tgAlphaPerC(alpha, curAlpha);
    const strain = alphaPerC * dTc;          // dimensionless
    const Lm = L * TG_LEN[curLen].f;
    const dLm = strain * Lm;
    const dLout = dLm / TG_LEN[curOut].f;

    const ok = [L, Ti, Th, alpha].every(isFinite);

    outDLEl.textContent = ok ? `${trim(dLout)} ${TG_LEN[curOut].label}` : '–';
    outDTEl.textContent = ok ? `${trim(dTdisp)} ${tempU.label}` : '–';
    outStrainEl.textContent = ok ? trim(strain * 1e6) : '–';

    if (!ok) {
      formulaEl.textContent = 'Enter valid inputs to see the calculation.';
      return;
    }

    const perC = trim(alphaPerC);
    formulaEl.textContent =
      `ΔL = α · L · ΔT\n` +
      `ΔT = T₂ − T₁ = ${trim(Th)} − ${trim(Ti)} = ${trim(dTdisp)} ${tempU.label}  (= ${trim(dTc)} °C-deg)\n` +
      `α  = ${trim(alpha)} ${TG_ALPHA[curAlpha].label} = ${perC} /°C\n` +
      `L  = ${trim(L)} ${TG_LEN[curLen].label} = ${trim(Lm)} m\n` +
      `ΔL = ${perC} × ${trim(Lm)} m × ${trim(dTc)} °C = ${trim(dLm)} m = ${trim(dLout)} ${TG_LEN[curOut].label}` +
      (dLm < 0 ? '\n\nNote: T₂ < T₁, so this is thermal contraction (ΔL is negative).' : '');
  }

  // --- unit-change handlers keep the physical value constant ---
  uLEl.addEventListener('change', () => {
    const v = val(fLEl);
    if (isFinite(v)) fLEl.value = trim(v * TG_LEN[curLen].f / TG_LEN[uLEl.value].f);
    curLen = uLEl.value;
    compute();
  });

  uTEl.addEventListener('change', () => {
    const from = TG_TEMP[curTemp], to = TG_TEMP[uTEl.value];
    [tInEl, tHiEl].forEach(node => {
      const v = val(node);
      if (isFinite(v)) node.value = trim(to.fromC(from.toC(v)));
    });
    curTemp = uTEl.value;
    compute();
  });

  uAEl.addEventListener('change', () => {
    const v = val(fAEl);
    if (isFinite(v)) {
      const perC = tgAlphaPerC(v, curAlpha);
      const t = TG_ALPHA[uAEl.value];
      fAEl.value = trim(perC / (t.f * (t.fam === 'F' ? 1.8 : 1)));
    }
    curAlpha = uAEl.value;
    // an explicit α edit no longer matches a canned material
    matEl.value = '0';
    compute();
  });

  uOutEl.addEventListener('change', () => {
    curOut = uOutEl.value;
    compute();
  });

  matEl.addEventListener('change', () => {
    const m = TG_MATERIALS[matEl.value];
    if (m && m.a != null) {
      fAEl.value = m.a;
      uAEl.value = 'um_m_C';
      curAlpha = 'um_m_C';
    }
    compute();
  });

  [fLEl, tInEl, tHiEl].forEach(node => node.addEventListener('input', compute));
  fAEl.addEventListener('input', () => { matEl.value = '0'; compute(); });

  compute();
})();
