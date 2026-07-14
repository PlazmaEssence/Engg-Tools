/* ============================================================
   Egg Tools — Pipe Wall Thickness (tmin) calculator
   Straight pipe under internal pressure.

   B31.3 §304.1.2 (thin-wall, t < D/6):
     t = P·D / (2·(S·E·W + P·Y))

   B31.4 §403.2.1:
     t = P·D / (2·S·E·F)

   Both then get: tm = t + c   (corrosion/mechanical allowance)
                  t_nominal_min = tm / (1 - mill tolerance)

   Material quick-fills are intentionally minimal — only values
   well established enough to state with confidence (ambient-
   temperature basic allowable stress for common CS pipe under
   B31.3, and SMYS values that are definitional to the API 5L
   grade name under B31.4). Everything is editable; nothing here
   substitutes for looking up the current code edition's tables.
   ============================================================ */

const PSI_TO_MPA = 0.006894757293168;
const IN_TO_MM = 25.4;

// NPS -> outside diameter (in), per ASME B36.10/19 — fixed geometry standard.
const NPS_OD = [
  ['1/8', 0.405], ['1/4', 0.540], ['3/8', 0.675], ['1/2', 0.840],
  ['3/4', 1.050], ['1', 1.315], ['1 1/4', 1.660], ['1 1/2', 1.900],
  ['2', 2.375], ['2 1/2', 2.875], ['3', 3.500], ['3 1/2', 4.000],
  ['4', 4.500], ['5', 5.563], ['6', 6.625], ['8', 8.625],
  ['10', 10.750], ['12', 12.750], ['14', 14.000], ['16', 16.000],
  ['18', 18.000], ['20', 20.000], ['22', 22.000], ['24', 24.000],
  ['26', 26.000], ['28', 28.000], ['30', 30.000], ['32', 32.000],
  ['34', 34.000], ['36', 36.000], ['42', 42.000]
];

const CODES = {
  b313: {
    label: 'ASME B31.3 — Process Piping',
    sLabel: 'Allowable Stress, S (Table A-1)',
    materials: [
      { label: 'Custom / manual entry', S_psi: null },
      { label: 'A106 Gr. B / A53 Gr. B (smls/ERW CS) — ambient ≤100°F', S_psi: 20000 },
      { label: 'A333 Gr. 6 (low-temp CS) — ambient', S_psi: 20000 }
    ],
    fields: ['E', 'W', 'Y']
  },
  b314: {
    label: 'ASME B31.4 — Liquid Pipelines',
    sLabel: 'Specified Min. Yield Strength, SMYS',
    materials: [
      { label: 'Custom / manual entry', S_psi: null },
      { label: 'API 5L Gr. B / A53-A106 Gr. B', S_psi: 35000 },
      { label: 'API 5L X42', S_psi: 42000 },
      { label: 'API 5L X46', S_psi: 46000 },
      { label: 'API 5L X52', S_psi: 52000 },
      { label: 'API 5L X56', S_psi: 56000 },
      { label: 'API 5L X60', S_psi: 60000 },
      { label: 'API 5L X65', S_psi: 65000 },
      { label: 'API 5L X70', S_psi: 70000 }
    ],
    fields: ['E', 'F']
  }
};

(function initTmin() {
  let currentCode = 'b313';
  let currentUnit = 'us'; // 'us' = psi/in, 'si' = MPa/mm

  const codeRowEl = document.getElementById('code-row');
  const unitSelectEl = document.getElementById('unit-system');
  const inputGridEl = document.getElementById('input-grid');
  const warningSlotEl = document.getElementById('warning-slot');
  const formulaBoxEl = document.getElementById('formula-box');

  function pLabel() { return currentUnit === 'us' ? 'psi' : 'MPa'; }
  function lLabel() { return currentUnit === 'us' ? 'in' : 'mm'; }

  function renderCodeRow() {
    codeRowEl.innerHTML = Object.keys(CODES).map(key => `
      <button type="button" class="pill pill-gold${key === currentCode ? ' active' : ''}" data-code="${key}">
        ${CODES[key].label}
      </button>`).join('');

    codeRowEl.querySelectorAll('[data-code]').forEach(btn => {
      btn.addEventListener('click', () => {
        currentCode = btn.dataset.code;
        document.body.className = 'code-' + currentCode;
        renderCodeRow();
        renderInputGrid();
        compute();
      });
    });
  }

  function fieldTemplate(id, label, value, opts) {
    opts = opts || {};
    const cls = opts.cls ? ` ${opts.cls}` : '';
    const hint = opts.hint ? `<div class="hint">${opts.hint}</div>` : '';
    return `<div class="field${cls}">
      <label>${label}</label>
      <input type="number" step="any" id="${id}" value="${value}">
      ${hint}
    </div>`;
  }

  function renderInputGrid() {
    const code = CODES[currentCode];
    const materialOpts = code.materials.map((m, i) => `<option value="${i}">${m.label}</option>`).join('');
    const npsOpts = `<option value="">—</option>` + NPS_OD.map(([nps], i) => `<option value="${i}">NPS ${nps}</option>`).join('');

    let html = '';
    html += `<div class="field">
      <label>NPS (quick-fill OD)</label>
      <select id="f-nps">${npsOpts}</select>
    </div>`;
    html += fieldTemplate('f-D', `Outside Diameter, D (${lLabel()})`, currentUnit === 'us' ? '4.500' : '114.30');
    html += fieldTemplate('f-P', `Design Pressure, P (${pLabel()})`, currentUnit === 'us' ? '150' : '1.03');
    html += `<div class="field">
      <label>Material quick-fill</label>
      <select id="f-material">${materialOpts}</select>
    </div>`;
    const defaultS_psi = currentCode === 'b313' ? 20000 : 35000;
    html += fieldTemplate('f-S', `${code.sLabel} (${pLabel()})`, trim(currentUnit === 'us' ? defaultS_psi : defaultS_psi * PSI_TO_MPA));
    html += fieldTemplate('f-E', 'Quality / Joint Factor, E', '1.00', { hint: 'Seamless = 1.00; confirm for welded pipe.' });

    if (currentCode === 'b313') {
      html += fieldTemplate('f-W', 'Weld Joint Strength Reduction, W', '1.00', { cls: 'b313-only', hint: '1.00 unless design temp exceeds Table 302.3.5 threshold.' });
      html += fieldTemplate('f-Y', 'Coefficient, Y', '0.40', { cls: 'b313-only', hint: 'Valid ≤900°F (482°C) for ferritic/austenitic steel.' });
    } else {
      html += fieldTemplate('f-F', 'Design Factor, F', '0.72', { cls: 'b314-only', hint: 'Standard 0.72; lower for certain crossings — confirm.' });
    }

    html += fieldTemplate('f-c', `Corrosion Allowance, c (${lLabel()})`, '0.0625', { hint: 'Plus any threading/mechanical allowance.' });
    html += fieldTemplate('f-mill', 'Mill Under-tolerance (%)', '12.5', { hint: 'Typical 12.5% for seamless pipe.' });

    inputGridEl.innerHTML = html;
    document.body.className = 'code-' + currentCode;

    document.getElementById('f-nps').addEventListener('change', e => {
      const idx = e.target.value;
      if (idx === '') return;
      const odIn = NPS_OD[idx][1];
      document.getElementById('f-D').value = trim(currentUnit === 'us' ? odIn : odIn * IN_TO_MM);
      compute();
    });

    document.getElementById('f-material').addEventListener('change', e => {
      const mat = code.materials[e.target.value];
      if (mat.S_psi == null) return;
      document.getElementById('f-S').value = trim(currentUnit === 'us' ? mat.S_psi : mat.S_psi * PSI_TO_MPA);
      compute();
    });

    inputGridEl.querySelectorAll('input').forEach(inp => inp.addEventListener('input', compute));
  }

  function convertFieldsOnUnitChange(from, to) {
    if (from === to) return;
    const lengthIds = ['f-D', 'f-c'];
    const pressureIds = ['f-P', 'f-S'];
    const toMm = v => v * IN_TO_MM;
    const toIn = v => v / IN_TO_MM;
    const toMPa = v => v * PSI_TO_MPA;
    const toPsi = v => v / PSI_TO_MPA;

    lengthIds.forEach(id => {
      const el = document.getElementById(id);
      if (!el || el.value === '') return;
      const v = parseFloat(el.value);
      el.value = trim(to === 'si' ? toMm(v) : toIn(v));
    });
    pressureIds.forEach(id => {
      const el = document.getElementById(id);
      if (!el || el.value === '') return;
      const v = parseFloat(el.value);
      el.value = trim(to === 'si' ? toMPa(v) : toPsi(v));
    });

    renderFieldLabels();
  }

  function renderFieldLabels() {
    const code = CODES[currentCode];
    const map = {
      'f-D': `Outside Diameter, D (${lLabel()})`,
      'f-P': `Design Pressure, P (${pLabel()})`,
      'f-S': `${code.sLabel} (${pLabel()})`,
      'f-c': `Corrosion Allowance, c (${lLabel()})`
    };
    Object.keys(map).forEach(id => {
      const el = document.getElementById(id);
      const label = el && el.parentElement.querySelector('label');
      if (label) label.textContent = map[id];
    });
  }

  unitSelectEl.addEventListener('change', () => {
    const from = currentUnit;
    const to = unitSelectEl.value;
    convertFieldsOnUnitChange(from, to);
    currentUnit = to;
    compute();
  });

  function trim(n) {
    if (!isFinite(n)) return '—';
    if (Math.abs(n) >= 1e6 || (Math.abs(n) < 1e-4 && n !== 0)) return n.toExponential(4);
    return parseFloat(n.toPrecision(6)).toString();
  }

  function val(id) {
    const el = document.getElementById(id);
    return el ? parseFloat(el.value) : NaN;
  }

  function compute() {
    const D = val('f-D');
    const P = val('f-P');
    const S = val('f-S');
    const E = val('f-E');
    const c = val('f-c') || 0;
    const millPct = val('f-mill');

    let t, formula;
    warningSlotEl.innerHTML = '';

    if (currentCode === 'b313') {
      const W = val('f-W');
      const Y = val('f-Y');
      t = (P * D) / (2 * (S * E * W + P * Y));
      formula = `B31.3 §304.1.2\nt = P·D / (2·(S·E·W + P·Y))\n  = (${P} × ${D}) / (2 × (${S} × ${E} × ${W} + ${P} × ${Y}))\n  = ${trim(t)} ${lLabel()}`;

      if (isFinite(t) && D > 0) {
        const thinWallOk = (t / D) < (1 / 6) && (P / (S * E)) <= 0.385;
        if (!thinWallOk) {
          warningSlotEl.innerHTML = `<div class="notice notice-danger">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <div>t ≥ D/6 or P/(S·E) &gt; 0.385 — this is outside the thin-wall assumption behind this formula. Per B31.3 §304.1.2(b), use the thick-wall equations instead; the results below are not valid for this case.</div>
          </div>`;
        }
      }
    } else {
      const F = val('f-F');
      t = (P * D) / (2 * S * E * F);
      formula = `B31.4 §403.2.1\nt = P·D / (2·S·E·F)\n  = (${P} × ${D}) / (2 × ${S} × ${E} × ${F})\n  = ${trim(t)} ${lLabel()}`;
    }

    const tm = t + c;
    const tnom = tm / (1 - millPct / 100);

    document.getElementById('out-t').textContent = isFinite(t) ? trim(t) : '–';
    document.getElementById('out-tm').textContent = isFinite(tm) ? trim(tm) : '–';
    document.getElementById('out-tnom').textContent = isFinite(tnom) ? trim(tnom) : '–';

    formulaBoxEl.textContent = isFinite(t)
      ? `${formula}\n\ntm = t + c = ${trim(t)} + ${c} = ${trim(tm)} ${lLabel()}\nt_nominal_min = tm / (1 − mill%) = ${trim(tm)} / (1 − ${millPct}/100) = ${trim(tnom)} ${lLabel()}`
      : 'Enter valid inputs to see the calculation.';
  }

  renderCodeRow();
  document.body.className = 'code-' + currentCode;
  renderInputGrid();
  compute();
})();
