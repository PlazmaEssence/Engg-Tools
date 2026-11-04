/* ============================================================
   Egg Tools - Friction Loss Calculator
   Pressure loss over a set distance of full pipe: Darcy-Weisbach
   with the Haaland friction factor, plus optional minor losses
   (total K or total Leq/D).

   Reads the shared tables in assets/js/pipe-data.js (CS_SIZES,
   HDPE_SIZES, HDPE_DR, CS_SCHED_ORDER, FV_VOLUME_UNITS,
   FV_TIME_UNITS), so pipe sizes are maintained in one place.
   Add a material by adding a row to MATERIALS below.
   ============================================================ */

(function () {
  var G = 9.80665, PSI = 6894.757293;
  var $ = function (id) { return document.getElementById(id); };

  /* Absolute roughness by material, in mm (new pipe, typical). */
  var MATERIALS = [
    { key: 'hdpe', name: 'HDPE', eps: 0.0015, table: 'hdpe' },
    { key: 'cs',   name: 'Carbon steel', eps: 0.045, table: 'cs' },
    { key: 'ss',   name: 'Stainless steel', eps: 0.015 },
    { key: 'gal',  name: 'Galvanised steel', eps: 0.15 },
    { key: 'pvc',  name: 'PVC / CPVC', eps: 0.0015 },
    { key: 'cu',   name: 'Copper / drawn tubing', eps: 0.0015 },
    { key: 'grp',  name: 'GRP / FRP', eps: 0.01 },
    { key: 'di',   name: 'Ductile iron, cement lined', eps: 0.12 },
    { key: 'ci',   name: 'Cast iron', eps: 0.26 },
    { key: 'conc', name: 'Concrete', eps: 0.3 }
  ];
  var MASS = [['kg', 1], ['g', 0.001], ['lb', 0.45359237], ['tonne', 1000]];
  var DENV = [['m³', 1], ['L', 0.001], ['cm³', 1e-6], ['ft³', 0.028316846592], ['US gal', 0.003785411784]];
  var PRES = [ // [label, factor to Pa, isHead(m per unit)]
    ['kPa', 1e3], ['Pa', 1], ['MPa', 1e6], ['bar', 1e5], ['psi', PSI],
    ['m head', 1, 'm'], ['ft head', 0.3048, 'ft']
  ];
  var BASIS = [['total', 0], ['per m', 1], ['per 100 m', 100], ['per km', 1000], ['per ft', 0.3048], ['per 100 ft', 30.48]];

  function fill(sel, rows, valFn, labFn) {
    sel.innerHTML = rows.map(function (r, i) { return '<option value="' + valFn(r, i) + '">' + labFn(r, i) + '</option>'; }).join('');
  }
  var volUnits = FV_VOLUME_UNITS, timeUnits = FV_TIME_UNITS;
  fill($('qNum'), volUnits, function (r) { return r.key; }, function (r) { return r.sym; });
  fill($('qDen'), timeUnits, function (r) { return r.key; }, function (r) { return r.sym; });
  $('qNum').value = 'm3'; $('qDen').value = 'day';
  fill($('rhoM'), MASS, function (r) { return r[1]; }, function (r) { return r[0]; });
  fill($('rhoV'), DENV, function (r) { return r[1]; }, function (r) { return r[0]; });
  fill($('outP'), PRES, function (r, i) { return i; }, function (r) { return r[0]; });
  fill($('outL'), BASIS, function (r, i) { return i; }, function (r) { return r[0]; });
  fill($('mat'), MATERIALS, function (r) { return r.key; }, function (r) { return r.name; });
  $('mat').value = 'hdpe';

  function find(tbl, key) { for (var i = 0; i < tbl.length; i++) if (tbl[i].key === key) return tbl[i]; return tbl[0]; }
  function num(id) { var v = parseFloat($(id).value); return isFinite(v) ? v : NaN; }
  function f4(x, sig) {
    sig = sig || 4;
    if (!isFinite(x)) return '-';
    if (x === 0) return '0';
    var a = Math.abs(x);
    if (a < 1e-3 || a >= 1e7) return x.toExponential(sig - 1).replace('e+', 'e');
    var s = Number(x.toPrecision(sig)).toString();
    return s;
  }

  /* ---- unit factors (to SI) ---- */
  var F = {
    dist: function () { return parseFloat($('distU').value); },
    q: function () { return find(volUnits, $('qNum').value).factor / find(timeUnits, $('qDen').value).factor; },
    id: function () { return parseFloat($('idU').value); },
    ruf: function () { return parseFloat($('rufU').value); },
    rho: function () { return parseFloat($('rhoM').value) / parseFloat($('rhoV').value); },
    nu: function () { return parseFloat($('nuU').value); },
    mu: function () { return parseFloat($('muU').value); }
  };
  var UNIT_SELECTS = {
    dist: ['distU'], q: ['qNum', 'qDen'], id: ['idU'], ruf: ['rufU'],
    rho: ['rhoM', 'rhoV'], nu: ['nuU'], mu: ['muU']
  };
  var lastF = {};
  Object.keys(F).forEach(function (k) { lastF[k] = F[k](); });
  // Changing a unit keeps the physical value: the number in the box is converted.
  Object.keys(UNIT_SELECTS).forEach(function (k) {
    UNIT_SELECTS[k].forEach(function (sid) {
      $(sid).addEventListener('change', function () {
        var nf = F[k](), v = num(k);
        if (isFinite(v)) $(k).value = f4(v * lastF[k] / nf);
        lastF[k] = nf;
        calc();
      });
    });
  });

  /* ---- pipe selection ---- */
  var idCustom = false, rufCustom = false, viscDriver = 'nu';

  function mat() { return find(MATERIALS, $('mat').value); }
  function sizeTable(m) { return m.table === 'hdpe' ? HDPE_SIZES : m.table === 'cs' ? CS_SIZES : null; }

  function buildSizes() {
    var m = mat(), t = sizeTable(m);
    $('sizeRow').hidden = !t;
    $('pipeInfo').hidden = !t;
    if (!t) return;
    var prev = $('nps').value;
    fill($('nps'), t, function (r) { return r.nps; }, function (r) { return 'NPS ' + r.nps; });
    $('nps').value = t.some(function (r) { return r.nps === prev; }) ? prev : '10';
    buildRatings();
  }
  function buildRatings() {
    var m = mat(), prev = $('rating').value;
    if (m.table === 'hdpe') {
      $('ratingHint').textContent = 'Dimension ratio (DR)';
      fill($('rating'), HDPE_DR, function (r) { return r; }, function (r) { return 'DR ' + r; });
      $('rating').value = HDPE_DR.map(String).indexOf(prev) >= 0 ? prev : '17';
    } else {
      $('ratingHint').textContent = 'Schedule (ASME B36.10M)';
      var s = CS_SIZES.filter(function (r) { return r.nps === $('nps').value; })[0];
      var keys = CS_SCHED_ORDER.filter(function (k) { return s.walls[k] !== undefined; });
      fill($('rating'), keys, function (r) { return r; }, function (r) { return /^\d/.test(r) ? 'Sch ' + r : r; });
      $('rating').value = keys.indexOf(prev) >= 0 ? prev : (keys.indexOf('40') >= 0 ? '40' : 'STD');
    }
  }
  function applyPipe() {
    var m = mat(), t = sizeTable(m);
    var odM, wallM;
    if (t) {
      var row = t.filter(function (r) { return r.nps === $('nps').value; })[0];
      odM = row.od_in * 0.0254;
      wallM = m.table === 'hdpe' ? odM / parseFloat($('rating').value) : row.walls[$('rating').value] * 0.0254;
      var idM = odM - 2 * wallM;
      $('id').value = f4(idM / F.id());
      $('pipeInfo').innerHTML = '<span>OD ' + f4(odM * 1000) + ' mm (' + f4(odM / 0.0254) + ' in)</span><span>Wall ' + f4(wallM * 1000) + ' mm (' + f4(wallM / 0.0254) + ' in)</span>';
      $('idHint').textContent = 'From ' + m.name + ' NPS ' + $('nps').value + ' ' + $('rating').options[$('rating').selectedIndex].text + '. Type to override.';
      idCustom = false;
    } else {
      $('idHint').textContent = 'No size table for this material. Enter the ID.';
      if (!isFinite(num('id'))) $('id').value = f4(0.1 / F.id());
      idCustom = true;
    }
  }
  function applyRoughness() {
    $('ruf').value = f4(mat().eps * 0.001 / F.ruf());
    rufCustom = false;
  }

  $('mat').addEventListener('change', function () { buildSizes(); applyPipe(); applyRoughness(); calc(); });
  $('nps').addEventListener('change', function () { if (mat().table === 'cs') buildRatings(); applyPipe(); calc(); });
  $('rating').addEventListener('change', function () { applyPipe(); calc(); });
  $('id').addEventListener('input', function () { idCustom = true; calc(); });
  $('ruf').addEventListener('input', function () { rufCustom = true; calc(); });
  $('nu').addEventListener('input', function () { viscDriver = 'nu'; calc(); });
  $('mu').addEventListener('input', function () { viscDriver = 'mu'; calc(); });
  ['dist', 'q', 'rho', 'mVal'].forEach(function (id) { $(id).addEventListener('input', calc); });
  ['outP', 'outL'].forEach(function (id) { $(id).addEventListener('change', calc); });
  $('mType').addEventListener('change', function () {
    $('mLab').textContent = $('mType').value === 'K' ? 'Sum of K' : 'Sum of Leq/D';
    calc();
  });

  function haaland(re, rr) {
    var inv = -1.8 * Math.log10(Math.pow(rr / 3.7, 1.11) + 6.9 / re);
    return 1 / (inv * inv);
  }
  function stepRow(label, html) { return '<div class="row"><span>' + label + '</span><div class="val">' + html + '</div></div>'; }
  function alt(s) { return '<span class="alt">' + s + '</span>'; }

  function calc() {
    var L = num('dist') * F.dist();
    var Q = num('q') * F.q();
    var D = num('id') * F.id();
    var eps = num('ruf') * F.ruf();
    var rho = num('rho') * F.rho();
    var mInput = num('mVal'); if (!(mInput >= 0)) mInput = 0;

    // Viscosity: whichever field was typed last drives, the other is calculated from density.
    var nu, mu;
    if (viscDriver === 'nu') {
      nu = num('nu') * F.nu(); mu = nu * rho;
      $('mu').value = isFinite(mu) ? f4(mu / F.mu()) : '';
    } else {
      mu = num('mu') * F.mu(); nu = mu / rho;
      $('nu').value = isFinite(nu) ? f4(nu / F.nu()) : '';
    }
    $('nu').classList.toggle('calc', viscDriver !== 'nu');
    $('mu').classList.toggle('calc', viscDriver !== 'mu');
    $('nuHint').textContent = viscDriver === 'nu' ? 'Entered' : 'Calculated from μ ÷ ρ';
    $('muHint').textContent = viscDriver === 'mu' ? 'Entered' : 'Calculated from ν × ρ';
    $('id').classList.toggle('calc', !idCustom);
    $('ruf').classList.toggle('calc', !rufCustom);
    var m = mat();
    $('rufHint').textContent = rufCustom ? 'Custom value' : 'Looked up for ' + m.name + '. Type to override.';
    $('dist').classList.toggle('bad', !(L > 0));
    $('q').classList.toggle('bad', !(Q > 0));
    $('id').classList.toggle('bad', !(D > 0));
    $('rho').classList.toggle('bad', !(rho > 0));

    // Output selectors
    var pu = PRES[$('outP').value], bs = BASIS[$('outL').value];
    $('outL').options[0].textContent = 'over ' + f4(num('dist')) + ' ' + $('distU').options[$('distU').selectedIndex].text;

    if (!(L > 0 && Q > 0 && D > 0 && eps >= 0 && rho > 0 && nu > 0)) {
      $('heroV').textContent = '-'; $('brk').innerHTML = ''; $('notes').innerHTML = '';
      $('steps').innerHTML = '<p class="method">Enter positive values for distance, flow, diameter, density and viscosity.</p>';
      return;
    }

    var A = Math.PI * D * D / 4, v = Q / A, re = v * D / nu, rr = eps / D;
    var f, regime, cls, notes = [];
    if (re < 2300) { f = 64 / re; regime = 'Laminar'; cls = 'warn'; notes.push('Laminar flow (Re below 2300). Using f = 64/Re. Roughness has no effect.'); }
    else {
      f = haaland(re, rr);
      if (re < 4000) { regime = 'Transitional'; cls = 'warn'; notes.push('Transitional flow (Re 2300 to 4000). The friction factor is uncertain here.'); }
      else { regime = 'Turbulent'; cls = 'ok'; }
    }
    if (rr > 0.05) notes.push('Relative roughness is above 0.05, outside the range Haaland is fitted to.');
    if (re > 1e8) notes.push('Reynolds number is above 1e8, outside the range Haaland is fitted to.');
    if (v > 6) notes.push('Velocity is above 6 m/s. Check erosion and surge limits.');

    var K = $('mType').value === 'K' ? mInput : f * mInput;
    var vh = v * v / (2 * G);
    var hMaj = f * (L / D) * vh, hMin = K * vh, hTot = hMaj + hMin;

    // Convert a head in metres to the selected unit and length basis.
    function out(h) {
      var x = pu[2] ? h / pu[1] : h * rho * G / pu[1];
      if (bs[1] > 0) x = x / L * bs[1];
      return x;
    }
    var unitTxt = pu[0] + ' ' + (bs[1] === 0 ? 'over ' + f4(num('dist')) + ' ' + $('distU').options[$('distU').selectedIndex].text : bs[0]);
    $('heroCap').textContent = bs[1] === 0 ? 'Total loss at ' + f4(num('dist')) + ' ' + $('distU').options[$('distU').selectedIndex].text : 'Total loss gradient';
    $('heroV').innerHTML = f4(out(hTot)) + '<small>' + unitTxt + '</small>';
    $('brk').innerHTML =
      '<tr><td>Major (pipe friction)</td><td>' + f4(out(hMaj)) + '</td></tr>' +
      '<tr><td>Minor (fittings)</td><td>' + f4(out(hMin)) + '</td></tr>' +
      '<tr><td>Total</td><td><strong>' + f4(out(hTot)) + '</strong></td></tr>';

    $('steps').innerHTML =
      stepRow('Flow rate', f4(Q) + ' ' + alt('m³/s')) +
      stepRow('Pipe ID', f4(D) + ' ' + alt('m') + ' ' + alt(f4(D / 0.0254) + ' in')) +
      stepRow('Fluid area (A)', f4(A) + ' ' + alt('m²')) +
      stepRow('Fluid velocity (v)', f4(v) + ' ' + alt('m/s') + ' ' + alt(f4(v / 0.3048) + ' ft/s')) +
      stepRow('Absolute roughness (ε)', f4(eps) + ' ' + alt('m')) +
      stepRow('Relative roughness (ε/D)', f4(rr)) +
      stepRow('Kinematic viscosity (ν)', f4(nu) + ' ' + alt('m²/s')) +
      stepRow('Dynamic viscosity (μ)', f4(mu) + ' ' + alt('Pa·s')) +
      stepRow('Reynolds number (Re)', f4(re) + ' <span class="badge ' + cls + '">' + regime + '</span>') +
      stepRow(re < 2300 ? 'Friction factor (64/Re)' : 'Friction factor (Haaland)', f4(f)) +
      stepRow('Velocity head (v²/2g)', f4(vh) + ' ' + alt('m')) +
      (K > 0 ? stepRow('Minor loss K', f4(K)) : '') +
      stepRow('Total head loss', f4(hTot) + ' ' + alt('m') + ' ' + alt(f4(hTot * rho * G / 1e3) + ' kPa'));
    $('notes').innerHTML = notes.map(function (n) { return '<div class="note">' + n + '</div>'; }).join('');
  }

  buildSizes(); applyPipe(); applyRoughness(); calc();
})();
