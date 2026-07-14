/* ============================================================
   Egg Tools — Unit Converter
   Linear categories store each unit's factor to a common base
   unit (value_in_base = value * factor). Temperature is handled
   separately since C/F/K/R need an offset, not just a factor.
   ============================================================ */

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
        key: 'flow', label: 'Flow Rate', base: 'm³/s',
        units: [
          { key: 'm3s', label: 'm³/s', factor: 1 },
          { key: 'm3h', label: 'm³/h', factor: 1 / 3600 },
          { key: 'Lps', label: 'L/s', factor: 0.001 },
          { key: 'Lpm', label: 'L/min', factor: 0.001 / 60 },
          { key: 'gpm', label: 'US gpm', factor: 6.30901964e-5 },
          { key: 'cfm', label: 'ft³/min (cfm)', factor: 0.0004719474432 },
          { key: 'bblday', label: 'bbl/day (oil bbl)', factor: 0.158987294928 / 86400 }
        ]
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
        units: [
          { key: 'cm3', label: 'cm³ (mL)', factor: 1e-6 },
          { key: 'L', label: 'Liter (L)', factor: 0.001 },
          { key: 'm3', label: 'm³', factor: 1 },
          { key: 'in3', label: 'in³', factor: 1.6387064e-5 },
          { key: 'ft3', label: 'ft³', factor: 0.028316846592 },
          { key: 'usgal', label: 'US gallon', factor: 0.003785411784 },
          { key: 'ukgal', label: 'UK (imperial) gallon', factor: 0.00454609 },
          { key: 'bbl', label: 'Oil barrel (bbl)', factor: 0.158987294928 }
        ]
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

function ucConvert(value, fromKey, toKey, category) {
  if (isNaN(value)) return NaN;
  if (category.special === 'temperature') {
    return ucFromBase(ucToBase(value, fromKey), toKey);
  }
  const from = category.units.find(u => u.key === fromKey);
  const to = category.units.find(u => u.key === toKey);
  return (value * from.factor) / to.factor;
}

(function initConverter() {
  let currentCategory = UC_ALL_CATEGORIES[0];

  const catGroupsEl = document.getElementById('cat-groups');
  const fromValEl = document.getElementById('val-from');
  const toValEl = document.getElementById('val-to');
  const fromUnitEl = document.getElementById('unit-from');
  const toUnitEl = document.getElementById('unit-to');
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

  function populateUnitSelects() {
    const opts = currentCategory.units.map(u => `<option value="${u.key}">${u.label}</option>`).join('');
    fromUnitEl.innerHTML = opts;
    toUnitEl.innerHTML = opts;
    fromUnitEl.value = currentCategory.units[0].key;
    toUnitEl.value = currentCategory.units[1] ? currentCategory.units[1].key : currentCategory.units[0].key;
  }

  function updateFactorNote() {
    if (currentCategory.special === 'temperature') {
      factorNoteEl.textContent = '';
      return;
    }
    const from = currentCategory.units.find(u => u.key === fromUnitEl.value);
    const to = currentCategory.units.find(u => u.key === toUnitEl.value);
    const rate = from.factor / to.factor;
    factorNoteEl.textContent = `1 ${from.label} = ${trim(rate)} ${to.label}`;
  }

  function trim(n) {
    if (!isFinite(n)) return '—';
    if (Math.abs(n) >= 1e6 || (Math.abs(n) < 1e-4 && n !== 0)) return n.toExponential(4);
    return parseFloat(n.toPrecision(8)).toString();
  }

  function recompute(editedSide) {
    updateFactorNote();
    if (editedSide === 'from') {
      const v = ucConvert(parseFloat(fromValEl.value), fromUnitEl.value, toUnitEl.value, currentCategory);
      toValEl.value = isNaN(v) ? '' : trim(v);
    } else {
      const v = ucConvert(parseFloat(toValEl.value), toUnitEl.value, fromUnitEl.value, currentCategory);
      fromValEl.value = isNaN(v) ? '' : trim(v);
    }
  }

  fromValEl.addEventListener('input', () => recompute('from'));
  toValEl.addEventListener('input', () => recompute('to'));
  fromUnitEl.addEventListener('change', () => recompute('from'));
  toUnitEl.addEventListener('change', () => recompute('from'));

  swapBtn.addEventListener('click', () => {
    const uf = fromUnitEl.value, ut = toUnitEl.value;
    fromUnitEl.value = ut;
    toUnitEl.value = uf;
    recompute('from');
  });

  renderCategoryPills();
  populateUnitSelects();
  recompute('from');
})();
