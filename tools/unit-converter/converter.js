/* ============================================================
   Egg Tools — Unit Converter
   Linear categories store each unit's factor to a common base
   unit (value_in_base = value * factor). Temperature is handled
   separately since C/F/K/R need an offset, not just a factor.

   Compound categories (e.g. Flow Rate = volume per time) do not
   list every combination. Instead they reference two dimensions
   (a numerator and a denominator) and show one small dropdown for
   each, so you can build any pairing — US gal/min, m3/h, bbl/day —
   from two short lists instead of one long one.
   ============================================================ */

/* Reusable dimension unit tables, shared by simple categories and
   by the numerator/denominator of compound categories. */
const UC_VOLUME_UNITS = [
  { key: 'cm3',   label: 'cm³ (mL)',              sym: 'cm³',    factor: 1e-6 },
  { key: 'L',     label: 'Liter (L)',             sym: 'L',      factor: 0.001 },
  { key: 'm3',    label: 'm³',                    sym: 'm³',     factor: 1 },
  { key: 'in3',   label: 'in³',                   sym: 'in³',    factor: 1.6387064e-5 },
  { key: 'ft3',   label: 'ft³',                   sym: 'ft³',    factor: 0.028316846592 },
  { key: 'usgal', label: 'US gallon',             sym: 'US gal', factor: 0.003785411784 },
  { key: 'ukgal', label: 'UK (imperial) gallon',  sym: 'UK gal', factor: 0.00454609 },
  { key: 'bbl',   label: 'Oil barrel (bbl)',      sym: 'bbl',    factor: 0.158987294928 }
];

const UC_TIME_UNITS = [
  { key: 's',   label: 'Second (s)',  sym: 's',   factor: 1 },
  { key: 'min', label: 'Minute (min)', sym: 'min', factor: 60 },
  { key: 'h',   label: 'Hour (h)',    sym: 'h',   factor: 3600 },
  { key: 'day', label: 'Day',         sym: 'day', factor: 86400 }
];

/* dimension key -> unit table, used to look up a compound side */
const UC_DIM_UNITS = {
  volume: UC_VOLUME_UNITS,
  time: UC_TIME_UNITS
};

const UC_GROUPS = [
  {
    label: 'Core',
    categories: [
      {
        key: 'length', label: 'Length', base: 'm',
        units: [
          { key: 'mm', label: 'Millimeter (mm)', factor: 0.001 },
          { key: 'cm', label: 'Centimeter (cm)', factor: 0.01 },
          { key: 'm', label: 'Meter (m)', factor: 1 },
          { key: 'km', label: 'Kilometer (km)', factor: 1000 },
          { key: 'in', label: 'Inch (in)', factor: 0.0254 },
          { key: 'ft', label: 'Foot (ft)', factor: 0.3048 },
          { key: 'yd', label: 'Yard (yd)', factor: 0.9144 },
          { key: 'mi', label: 'Mile (mi)', factor: 1609.344 }
        ]
      },
      {
        key: 'pressure', label: 'Pressure', base: 'Pa',
        units: [
          { key: 'Pa', label: 'Pascal (Pa)', factor: 1 },
          { key: 'kPa', label: 'Kilopascal (kPa)', factor: 1e3 },
          { key: 'MPa', label: 'Megapascal (MPa)', factor: 1e6 },
          { key: 'bar', label: 'Bar', factor: 1e5 },
          { key: 'mbar', label: 'Millibar', factor: 100 },
          { key: 'psi', label: 'psi (lbf/in²)', factor: 6894.757293168 },
          { key: 'ksi', label: 'ksi (kip/in²)', factor: 6894757.293168 },
          { key: 'atm', label: 'Atmosphere (atm)', factor: 101325 },
          { key: 'torr', label: 'Torr (mmHg)', factor: 133.322368 }
        ]
      },
      {
        key: 'temperature', label: 'Temperature', special: 'temperature',
        units: [
          { key: 'C', label: 'Celsius (°C)' },
          { key: 'F', label: 'Fahrenheit (°F)' },
          { key: 'K', label: 'Kelvin (K)' },
          { key: 'R', label: 'Rankine (°R)' }
        ]
      }
    ]
  },
  {
    label: 'Flow & Velocity',
    categories: [
      {
        key: 'flow', label: 'Flow Rate',
        compound: { num: 'volume', den: 'time' },
        defaults: { fromNum: 'm3', fromDen: 's', toNum: 'usgal', toDen: 'min' }
      },
      {
        key: 'velocity', label: 'Velocity', base: 'm/s',
        units: [
          { key: 'mps', label: 'm/s', factor: 1 },
          { key: 'fps', label: 'ft/s', factor: 0.3048 },
          { key: 'fpm', label: 'ft/min', factor: 0.00508 },
          { key: 'kph', label: 'km/h', factor: 1 / 3.6 },
          { key: 'mph', label: 'mph', factor: 0.44704 },
          { key: 'kn', label: 'knot', factor: 0.514444 }
        ]
      }
    ]
  },
  {
    label: 'Mass, Force & Torque',
    categories: [
      {
        key: 'mass', label: 'Mass', base: 'kg',
        units: [
          { key: 'g', label: 'Gram (g)', factor: 0.001 },
          { key: 'kg', label: 'Kilogram (kg)', factor: 1 },
          { key: 't', label: 'Metric ton (t)', factor: 1000 },
          { key: 'lb', label: 'Pound (lb)', factor: 0.45359237 },
          { key: 'oz', label: 'Ounce (oz)', factor: 0.0283495231 },
          { key: 'ston', label: 'US ton (short)', factor: 907.18474 },
          { key: 'lton', label: 'Long ton', factor: 1016.0469088 }
        ]
      },
      {
        key: 'force', label: 'Force', base: 'N',
        units: [
          { key: 'N', label: 'Newton (N)', factor: 1 },
          { key: 'kN', label: 'Kilonewton (kN)', factor: 1000 },
          { key: 'lbf', label: 'Pound-force (lbf)', factor: 4.4482216153 },
          { key: 'kgf', label: 'Kilogram-force (kgf)', factor: 9.80665 },
          { key: 'dyn', label: 'Dyne', factor: 1e-5 }
        ]
      },
      {
        key: 'torque', label: 'Torque', base: 'N·m',
        units: [
          { key: 'Nm', label: 'Newton-meter (N·m)', factor: 1 },
          { key: 'kNm', label: 'Kilonewton-meter (kN·m)', factor: 1000 },
          { key: 'lbfft', label: 'Pound-foot (lbf·ft)', factor: 1.3558179483 },
          { key: 'lbfin', label: 'Pound-inch (lbf·in)', factor: 0.1129848290 },
          { key: 'kgfm', label: 'Kilogram-force-meter (kgf·m)', factor: 9.80665 }
        ]
      }
    ]
  },
  {
    label: 'Area, Volume & Density',
    categories: [
      {
        key: 'area', label: 'Area', base: 'm²',
        units: [
          { key: 'mm2', label: 'mm²', factor: 1e-6 },
          { key: 'cm2', label: 'cm²', factor: 1e-4 },
          { key: 'm2', label: 'm²', factor: 1 },
          { key: 'km2', label: 'km²', factor: 1e6 },
          { key: 'in2', label: 'in²', factor: 0.00064516 },
          { key: 'ft2', label: 'ft²', factor: 0.09290304 },
          { key: 'yd2', label: 'yd²', factor: 0.83612736 },
          { key: 'acre', label: 'Acre', factor: 4046.8564224 }
        ]
      },
      {
        key: 'volume', label: 'Volume', base: 'm³',
        units: UC_VOLUME_UNITS
      },
      {
        key: 'density', label: 'Density', base: 'kg/m³',
        units: [
          { key: 'kgm3', label: 'kg/m³', factor: 1 },
          { key: 'gcm3', label: 'g/cm³', factor: 1000 },
          { key: 'kgL', label: 'kg/L', factor: 1000 },
          { key: 'lbft3', label: 'lb/ft³', factor: 16.01846337 },
          { key: 'lbin3', label: 'lb/in³', factor: 27679.90471 },
          { key: 'lbgal', label: 'lb/US gal', factor: 119.826427 }
        ]
      }
    ]
  }
];

const UC_ALL_CATEGORIES = UC_GROUPS.flatMap(g => g.categories);

function ucToBase(value, temp) {
  if (temp === 'C') return value + 273.15;
  if (temp === 'K') return value;
  if (temp === 'F') return (value - 32) * 5 / 9 + 273.15;
  if (temp === 'R') return value * 5 / 9;
}

function ucFromBase(kelvin, temp) {
  if (temp === 'C') return kelvin - 273.15;
  if (temp === 'K') return kelvin;
  if (temp === 'F') return (kelvin - 273.15) * 9 / 5 + 32;
  if (temp === 'R') return kelvin * 9 / 5;
}

/* A "side" is whatever unit selection the from/to panel holds:
   - temperature/linear categories: a single unit object
   - compound categories: { num: unitObj, den: unitObj }
   ucConvert takes those side objects directly. */
function ucConvert(value, fromSide, toSide, category) {
  if (isNaN(value)) return NaN;
  if (category.special === 'temperature') {
    return ucFromBase(ucToBase(value, fromSide.key), toSide.key);
  }
  if (category.compound) {
    const fromBase = fromSide.num.factor / fromSide.den.factor;
    const toBase = toSide.num.factor / toSide.den.factor;
    return value * fromBase / toBase;
  }
  return (value * fromSide.factor) / toSide.factor;
}

(function initConverter() {
  let currentCategory = UC_ALL_CATEGORIES[0];

  const catGroupsEl = document.getElementById('cat-groups');
  const fromValEl = document.getElementById('val-from');
  const toValEl = document.getElementById('val-to');
  const unitsFromEl = document.getElementById('units-from');
  const unitsToEl = document.getElementById('units-to');
  const factorNoteEl = document.getElementById('factor-note');
  const swapBtn = document.getElementById('swap-btn');

  function renderCategoryPills() {
    catGroupsEl.innerHTML = UC_GROUPS.map(group => `
      <div class="cat-group">
        <div class="cat-group-label">${group.label}</div>
        <div class="cat-row">
          ${group.categories.map(c => `
            <button type="button" class="pill pill-gold${c.key === currentCategory.key ? ' active' : ''}" data-cat="${c.key}">
              ${c.label}
            </button>`).join('')}
        </div>
      </div>`).join('');

    catGroupsEl.querySelectorAll('[data-cat]').forEach(btn => {
      btn.addEventListener('click', () => {
        currentCategory = UC_ALL_CATEGORIES.find(c => c.key === btn.dataset.cat);
        renderCategoryPills();
        populateUnitSelects();
        recompute('from');
      });
    });
  }

  function optionsHTML(units, compound) {
    return units.map(u => `<option value="${u.key}">${compound ? (u.sym || u.label) : u.label}</option>`).join('');
  }

  /* Build the dropdown(s) for one panel. Compound categories get a
     numerator select, a "/" separator, and a denominator select;
     everything else gets a single select. */
  function buildSideControls(container) {
    if (currentCategory.compound) {
      const numUnits = UC_DIM_UNITS[currentCategory.compound.num];
      const denUnits = UC_DIM_UNITS[currentCategory.compound.den];
      container.innerHTML =
        `<select class="unit-select" data-role="num">${optionsHTML(numUnits, true)}</select>` +
        `<span class="unit-sep">/</span>` +
        `<select class="unit-select" data-role="den">${optionsHTML(denUnits, true)}</select>`;
    } else {
      container.innerHTML =
        `<select class="unit-select" data-role="unit">${optionsHTML(currentCategory.units, false)}</select>`;
    }
    container.querySelectorAll('select').forEach(sel => {
      sel.addEventListener('change', () => recompute('from'));
    });
  }

  function setVal(container, role, val) {
    const sel = container.querySelector(`[data-role="${role}"]`);
    if (sel) sel.value = val;
  }

  function populateUnitSelects() {
    buildSideControls(unitsFromEl);
    buildSideControls(unitsToEl);

    if (currentCategory.compound) {
      const d = currentCategory.defaults || {};
      const numUnits = UC_DIM_UNITS[currentCategory.compound.num];
      const denUnits = UC_DIM_UNITS[currentCategory.compound.den];
      setVal(unitsFromEl, 'num', d.fromNum || numUnits[0].key);
      setVal(unitsFromEl, 'den', d.fromDen || denUnits[0].key);
      setVal(unitsToEl, 'num', d.toNum || numUnits[Math.min(1, numUnits.length - 1)].key);
      setVal(unitsToEl, 'den', d.toDen || denUnits[0].key);
    } else {
      const units = currentCategory.units;
      setVal(unitsFromEl, 'unit', units[0].key);
      setVal(unitsToEl, 'unit', (units[1] || units[0]).key);
    }
  }

  /* Read the current unit selection from a panel into a "side" object
     that ucConvert understands. */
  function readSide(container) {
    if (currentCategory.compound) {
      const numUnits = UC_DIM_UNITS[currentCategory.compound.num];
      const denUnits = UC_DIM_UNITS[currentCategory.compound.den];
      return {
        num: numUnits.find(u => u.key === container.querySelector('[data-role="num"]').value),
        den: denUnits.find(u => u.key === container.querySelector('[data-role="den"]').value)
      };
    }
    const key = container.querySelector('[data-role="unit"]').value;
    return currentCategory.units.find(u => u.key === key);
  }

  function sideLabel(side) {
    if (currentCategory.compound) {
      return `${side.num.sym || side.num.label}/${side.den.sym || side.den.label}`;
    }
    return side.label;
  }

  function updateFactorNote(fromSide, toSide) {
    if (currentCategory.special === 'temperature') {
      factorNoteEl.textContent = '';
      return;
    }
    const rate = ucConvert(1, fromSide, toSide, currentCategory);
    factorNoteEl.textContent = `1 ${sideLabel(fromSide)} = ${trim(rate)} ${sideLabel(toSide)}`;
  }

  function trim(n) {
    if (!isFinite(n)) return '—';
    if (Math.abs(n) >= 1e6 || (Math.abs(n) < 1e-4 && n !== 0)) return n.toExponential(4);
    return parseFloat(n.toPrecision(8)).toString();
  }

  function recompute(editedSide) {
    const fromSide = readSide(unitsFromEl);
    const toSide = readSide(unitsToEl);
    updateFactorNote(fromSide, toSide);
    if (editedSide === 'from') {
      const v = ucConvert(parseFloat(fromValEl.value), fromSide, toSide, currentCategory);
      toValEl.value = isNaN(v) ? '' : trim(v);
    } else {
      const v = ucConvert(parseFloat(toValEl.value), toSide, fromSide, currentCategory);
      fromValEl.value = isNaN(v) ? '' : trim(v);
    }
  }

  fromValEl.addEventListener('input', () => recompute('from'));
  toValEl.addEventListener('input', () => recompute('to'));

  swapBtn.addEventListener('click', () => {
    if (currentCategory.compound) {
      const fn = unitsFromEl.querySelector('[data-role="num"]');
      const fd = unitsFromEl.querySelector('[data-role="den"]');
      const tn = unitsToEl.querySelector('[data-role="num"]');
      const td = unitsToEl.querySelector('[data-role="den"]');
      [fn.value, tn.value] = [tn.value, fn.value];
      [fd.value, td.value] = [td.value, fd.value];
    } else {
      const f = unitsFromEl.querySelector('[data-role="unit"]');
      const t = unitsToEl.querySelector('[data-role="unit"]');
      [f.value, t.value] = [t.value, f.value];
    }
    recompute('from');
  });

  renderCategoryPills();
  populateUnitSelects();
  recompute('from');
})();
