/* ============================================================
   Egg Tools - Bolt Torque
   Short-form torque equation:

     T = K · D · F_bolt          F_bolt = F_total / N

   and, with the clamped annulus (ID, OD):

     A = π/4 · (OD² − ID²)       σ = F_total / A

   Everything is computed in SI (m, N, N·m, Pa) and converted to
   the selected display units.
   ============================================================ */

const BT_LEN = {
  mm: { label: 'mm', f: 1e-3 },
  cm: { label: 'cm', f: 1e-2 },
  m:  { label: 'm',  f: 1 },
  in: { label: 'in', f: 0.0254 }
};
const BT_LEN_ORDER = ['mm', 'cm', 'm', 'in'];

const BT_FORCE = {
  N:   { label: 'N',   f: 1 },
  kN:  { label: 'kN',  f: 1e3 },
  lbf: { label: 'lbf', f: 4.4482216152605 },
  kip: { label: 'kip', f: 4448.2216152605 }
};
const BT_FORCE_ORDER = ['N', 'kN', 'lbf', 'kip'];

const BT_TORQUE = {
  Nm:   { label: 'N·m',    f: 1 },
  ftlb: { label: 'ft·lbf', f: 1.3558179483314 },
  inlb: { label: 'in·lbf', f: 0.1129848290276 }
};
const BT_TORQUE_ORDER = ['Nm', 'ftlb', 'inlb'];

const BT_STRESS = {
  MPa: { label: 'MPa', f: 1e6 },
  kPa: { label: 'kPa', f: 1e3 },
  psi: { label: 'psi', f: 6894.757293168 },
  ksi: { label: 'ksi', f: 6894757.293168 }
};
const BT_STRESS_ORDER = ['MPa', 'kPa', 'psi', 'ksi'];

(function initBoltTorque() {
  const el = id => document.getElementById(id);
  const NEl = el('f-N'), KEl = el('f-K');
  const DEl = el('f-D'), uDEl = el('u-D');
  const FEl = el('f-F'), uFEl = el('u-F');
  const TEl = el('f-T'), uTEl = el('u-T');
  const advEl = el('f-adv'), advFields = el('adv-fields');
  const IDEl = el('f-ID'), uIDEl = el('u-ID');
  const ODEl = el('f-OD'), uODEl = el('u-OD');
  const uSEl = el('u-S');

  const cur = { D: 'mm', F: 'kN', T: 'Nm', ID: 'mm', OD: 'mm' };

  function opts(table, order) {
    return order.map(k => `<option value="${k}">${table[k].label}</option>`).join('');
  }
  function trim(n) {
    if (!isFinite(n)) return '-';
    if (Math.abs(n) >= 1e7 || (Math.abs(n) < 1e-4 && n !== 0)) return n.toExponential(4);
    return parseFloat(n.toPrecision(6)).toString();
  }
  function val(node) {
    const v = parseFloat(node.value);
    return isNaN(v) ? NaN : v;
  }

  uDEl.innerHTML = opts(BT_LEN, BT_LEN_ORDER);
  uIDEl.innerHTML = opts(BT_LEN, BT_LEN_ORDER);
  uODEl.innerHTML = opts(BT_LEN, BT_LEN_ORDER);
  uFEl.innerHTML = opts(BT_FORCE, BT_FORCE_ORDER);
  uTEl.innerHTML = opts(BT_TORQUE, BT_TORQUE_ORDER);
  uSEl.innerHTML = opts(BT_STRESS, BT_STRESS_ORDER);
  uDEl.value = cur.D; uIDEl.value = cur.ID; uODEl.value = cur.OD;
  uFEl.value = cur.F; uTEl.value = cur.T; uSEl.value = 'MPa';

  // --- LaTeX (KaTeX loads deferred; fall back to plain text if it is blocked) ---
  function renderTex(id, tex) {
    const node = el(id);
    if (window.katex) {
      katex.render(tex, node, { displayMode: true, throwOnError: false });
    } else {
      node.textContent = tex;
    }
  }
  function renderEquations() {
    renderTex('eq-main', String.raw`T = K \, D \, F_{\mathrm{bolt}}, \qquad F_{\mathrm{bolt}} = \frac{F_{\mathrm{total}}}{N}`);
    el('eq-where').innerHTML =
      'T = torque per bolt, K = nut factor, D = nominal bolt diameter, ' +
      'F<sub>bolt</sub> = clamping load per bolt, F<sub>total</sub> = total clamping load, N = number of bolts.';
    renderTex('eq-stress', String.raw`\sigma = \frac{F_{\mathrm{total}}}{A}, \qquad A = \frac{\pi}{4}\left(\mathrm{OD}^{2} - \mathrm{ID}^{2}\right)`);
  }
  if (window.katex) renderEquations();
  else {
    renderEquations();
    window.addEventListener('load', renderEquations);
  }

  // Whichever of load / torque the user typed last drives the other.
  let driver = 'F';

  function setCalc(inputEl, tagEl, value) {
    inputEl.value = isFinite(value) ? trim(value) : '';
    inputEl.classList.add('calc');
    tagEl.textContent = '(calculated)';
  }
  function clearCalc(inputEl, tagEl) {
    inputEl.classList.remove('calc');
    tagEl.textContent = '';
  }

  function compute() {
    const adv = advEl.checked;
    advFields.hidden = !adv;
    el('stat-stress').hidden = !adv;
    el('eq-adv').hidden = !adv;

    const N = val(NEl), K = val(KEl);
    const D = val(DEl) * BT_LEN[cur.D].f;
    const fU = BT_FORCE[cur.F], tU = BT_TORQUE[cur.T];
    const params = [N, K, D].every(isFinite) && N >= 1 && K > 0 && D > 0;

    // if the driving field was emptied, fall back to the other one
    if (driver === 'F' && !isFinite(val(FEl)) && isFinite(val(TEl)) && !TEl.classList.contains('calc')) driver = 'T';
    if (driver === 'T' && !isFinite(val(TEl)) && isFinite(val(FEl)) && !FEl.classList.contains('calc')) driver = 'F';

    let Ftot = NaN, Tb = NaN;
    if (driver === 'F') {
      clearCalc(FEl, el('tag-F'));
      Ftot = val(FEl) * fU.f;
      Tb = params ? K * D * (Ftot / N) : NaN;
      setCalc(TEl, el('tag-T'), Tb / tU.f);
    } else {
      clearCalc(TEl, el('tag-T'));
      Tb = val(TEl) * tU.f;
      Ftot = params ? Tb * N / (K * D) : NaN;
      setCalc(FEl, el('tag-F'), Ftot / fU.f);
    }
    if (!params || !isFinite(Ftot) || !isFinite(Tb)) {
      // nothing sensible to show for the calculated field
      const calcEl = driver === 'F' ? TEl : FEl;
      calcEl.value = '';
    }
    const Fb = Ftot / N;
    const ok = params && isFinite(Ftot) && isFinite(Tb);

    el('out1').textContent = ok ? `${trim(Tb / tU.f)} ${tU.label}` : '–';
    el('out2').textContent = ok ? `${trim(Fb / fU.f)} ${fU.label}` : '–';

    let stressLine = '';
    if (adv) {
      const ID = val(IDEl) * BT_LEN[cur.ID].f;
      const OD = val(ODEl) * BT_LEN[cur.OD].f;
      const sU = BT_STRESS[uSEl.value];
      const geomOk = isFinite(ID) && isFinite(OD) && ID >= 0 && OD > ID;
      if (ok && geomOk) {
        const A = Math.PI / 4 * (OD * OD - ID * ID);
        const sigma = Ftot / A;
        el('out3').textContent = `${trim(sigma / sU.f)} ${sU.label}`;
        stressLine = `\nA  = π/4 × (${trim(OD)}² − ${trim(ID)}²) = ${trim(A)} m²  (${trim(A * 1e6)} mm²)\n` +
                     `σ  = F_total / A = ${trim(Ftot)} / ${trim(A)} = ${trim(sigma)} Pa = ${trim(sigma / sU.f)} ${sU.label}`;
      } else {
        el('out3').textContent = '–';
        stressLine = '\nClamping stress needs ID ≥ 0 and OD > ID.';
      }
    }

    if (!ok) {
      el('formula-box').textContent = 'Enter N ≥ 1, K > 0, D > 0 and either the clamping load or the torque to see the calculation.';
      return;
    }
    el('formula-box').textContent =
      `D       = ${trim(val(DEl))} ${BT_LEN[cur.D].label} = ${trim(D)} m\n` +
      (driver === 'F'
        ? `F_total = ${trim(Ftot)} N,  F_bolt = F_total / N = ${trim(Ftot)} / ${trim(N)} = ${trim(Fb)} N\n` +
          `T       = K · D · F_bolt = ${trim(K)} × ${trim(D)} × ${trim(Fb)} = ${trim(Tb)} N·m`
        : `T       = ${trim(Tb)} N·m\n` +
          `F_bolt  = T / (K · D) = ${trim(Tb)} / (${trim(K)} × ${trim(D)}) = ${trim(Fb)} N\n` +
          `F_total = N · F_bolt = ${trim(N)} × ${trim(Fb)} = ${trim(Ftot)} N`) +
      stressLine;
  }

  // unit changes keep the physical quantity constant
  function bindUnit(selEl, inputEl, table, key) {
    selEl.addEventListener('change', () => {
      const v = val(inputEl);
      if (isFinite(v) && !inputEl.classList.contains('calc')) inputEl.value = trim(v * table[cur[key]].f / table[selEl.value].f);
      cur[key] = selEl.value;
      compute();
    });
  }
  bindUnit(uDEl, DEl, BT_LEN, 'D');
  bindUnit(uIDEl, IDEl, BT_LEN, 'ID');
  bindUnit(uODEl, ODEl, BT_LEN, 'OD');
  bindUnit(uFEl, FEl, BT_FORCE, 'F');
  bindUnit(uTEl, TEl, BT_TORQUE, 'T');
  uSEl.addEventListener('change', compute);

  [NEl, KEl, DEl, IDEl, ODEl].forEach(n => n.addEventListener('input', compute));
  FEl.addEventListener('input', () => { if (isFinite(val(FEl))) driver = 'F'; compute(); });
  TEl.addEventListener('input', () => { if (isFinite(val(TEl))) driver = 'T'; compute(); });
  advEl.addEventListener('change', compute);

  compute();
})();
