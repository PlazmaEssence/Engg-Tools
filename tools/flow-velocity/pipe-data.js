/* ============================================================
   Egg Tools — Pipe Flow & Velocity: pipe & unit data (data only)

   Loaded before flow-velocity.js. No logic here — just tables the
   tool reads. To add a size, schedule, DR or unit, edit the data
   below; nothing in flow-velocity.js hard-codes a size.

   Dimensions
   ----------
   CS_SIZES  : carbon-steel pipe per ASME B36.10M. Outer diameter
               (od_in) is fixed per NPS; wall thickness varies by
               schedule. OD and walls are stored in INCHES (the
               table's native units) and converted at runtime.
               Only the schedules actually listed by the standard
               for a given size are included.
   HDPE_SIZES: HDPE on the IPS (Iron Pipe Size) OD basis, so the OD
               equals the carbon-steel OD for the same NPS. Wall is
               NOT tabulated — for HDPE, wall = OD / DR.
   HDPE_DR   : standard dimension ratios (DR = OD / wall).

   These tables are an engineering aid. Always verify against the
   current standard and your project spec before use.

   Units
   -----
   Flow rate is a compound unit (volume / time); the two dropdowns
   mirror the Unit Converter. Velocity and the pipe-dimension field
   unit each have their own list. All factors convert TO the SI base
   (m³, s, m/s, m) so the physics is done once in SI.
   ============================================================ */

/* Canonical schedule display order; the dropdown lists whichever of
   these a given size actually defines. STD/XS/XXS first (named),
   then numeric schedules ascending. */
const CS_SCHED_ORDER = ['STD', 'XS', 'XXS', '10', '20', '30', '40', '60', '80', '100', '120', '140', '160'];

/* Carbon steel — ASME B36.10M. od_in and every wall value in inches. */
const CS_SIZES = [
  { nps: '1/2',   od_in: 0.840,  walls: { '10': 0.083, '40': 0.109, STD: 0.109, '80': 0.147, XS: 0.147, '160': 0.188, XXS: 0.294 } },
  { nps: '3/4',   od_in: 1.050,  walls: { '10': 0.083, '40': 0.113, STD: 0.113, '80': 0.154, XS: 0.154, '160': 0.219, XXS: 0.308 } },
  { nps: '1',     od_in: 1.315,  walls: { '10': 0.109, '40': 0.133, STD: 0.133, '80': 0.179, XS: 0.179, '160': 0.250, XXS: 0.358 } },
  { nps: '1-1/4', od_in: 1.660,  walls: { '10': 0.109, '40': 0.140, STD: 0.140, '80': 0.191, XS: 0.191, '160': 0.250, XXS: 0.382 } },
  { nps: '1-1/2', od_in: 1.900,  walls: { '10': 0.109, '40': 0.145, STD: 0.145, '80': 0.200, XS: 0.200, '160': 0.281, XXS: 0.400 } },
  { nps: '2',     od_in: 2.375,  walls: { '10': 0.109, '40': 0.154, STD: 0.154, '80': 0.218, XS: 0.218, '160': 0.344, XXS: 0.436 } },
  { nps: '2-1/2', od_in: 2.875,  walls: { '10': 0.120, '40': 0.203, STD: 0.203, '80': 0.276, XS: 0.276, '160': 0.375, XXS: 0.552 } },
  { nps: '3',     od_in: 3.500,  walls: { '10': 0.120, '40': 0.216, STD: 0.216, '80': 0.300, XS: 0.300, '160': 0.438, XXS: 0.600 } },
  { nps: '3-1/2', od_in: 4.000,  walls: { '10': 0.120, '40': 0.226, STD: 0.226, '80': 0.318, XS: 0.318, XXS: 0.636 } },
  { nps: '4',     od_in: 4.500,  walls: { '10': 0.120, '40': 0.237, STD: 0.237, '60': 0.281, '80': 0.337, XS: 0.337, '120': 0.438, '160': 0.531, XXS: 0.674 } },
  { nps: '5',     od_in: 5.563,  walls: { '10': 0.134, '40': 0.258, STD: 0.258, '80': 0.375, XS: 0.375, '120': 0.500, '160': 0.625, XXS: 0.750 } },
  { nps: '6',     od_in: 6.625,  walls: { '10': 0.134, '40': 0.280, STD: 0.280, '80': 0.432, XS: 0.432, '120': 0.562, '160': 0.719, XXS: 0.864 } },
  { nps: '8',     od_in: 8.625,  walls: { '10': 0.148, '20': 0.250, '30': 0.277, '40': 0.322, STD: 0.322, '60': 0.406, '80': 0.500, XS: 0.500, '100': 0.594, '120': 0.719, '140': 0.812, XXS: 0.875, '160': 0.906 } },
  { nps: '10',    od_in: 10.750, walls: { '10': 0.165, '20': 0.250, '30': 0.307, '40': 0.365, STD: 0.365, '60': 0.500, XS: 0.500, '80': 0.594, '100': 0.719, '120': 0.844, '140': 1.000, '160': 1.125 } },
  { nps: '12',    od_in: 12.750, walls: { '10': 0.180, '20': 0.250, '30': 0.330, STD: 0.375, '40': 0.406, XS: 0.500, '60': 0.562, '80': 0.688, '100': 0.844, '120': 1.000, '140': 1.125, '160': 1.312 } },
  { nps: '14',    od_in: 14.000, walls: { '10': 0.250, '20': 0.312, '30': 0.375, STD: 0.375, '40': 0.438, XS: 0.500, '60': 0.594, '80': 0.750, '100': 0.938, '120': 1.094, '140': 1.250, '160': 1.406 } },
  { nps: '16',    od_in: 16.000, walls: { '10': 0.250, '20': 0.312, '30': 0.375, STD: 0.375, '40': 0.500, XS: 0.500, '60': 0.656, '80': 0.844, '100': 1.031, '120': 1.219, '140': 1.438, '160': 1.594 } },
  { nps: '18',    od_in: 18.000, walls: { '10': 0.250, '20': 0.312, STD: 0.375, '30': 0.438, XS: 0.500, '40': 0.562, '60': 0.750, '80': 0.938, '100': 1.156, '120': 1.375, '140': 1.562, '160': 1.781 } },
  { nps: '20',    od_in: 20.000, walls: { '10': 0.250, '20': 0.375, STD: 0.375, '30': 0.500, XS: 0.500, '40': 0.594, '60': 0.812, '80': 1.031, '100': 1.281, '120': 1.500, '140': 1.750, '160': 1.969 } },
  { nps: '22',    od_in: 22.000, walls: { '10': 0.250, '20': 0.375, STD: 0.375, '30': 0.500, XS: 0.500, '60': 0.875, '80': 1.125, '100': 1.375, '120': 1.625, '140': 1.875, '160': 2.125 } },
  { nps: '24',    od_in: 24.000, walls: { '10': 0.250, '20': 0.375, STD: 0.375, XS: 0.500, '30': 0.562, '40': 0.688, '60': 0.969, '80': 1.219, '100': 1.531, '120': 1.812, '140': 2.062, '160': 2.344 } },
  { nps: '26',    od_in: 26.000, walls: { '10': 0.312, STD: 0.375, '20': 0.500, XS: 0.500 } },
  { nps: '28',    od_in: 28.000, walls: { '10': 0.312, STD: 0.375, '20': 0.500, XS: 0.500, '30': 0.625 } },
  { nps: '30',    od_in: 30.000, walls: { '10': 0.312, STD: 0.375, '20': 0.500, XS: 0.500, '30': 0.625 } },
  { nps: '32',    od_in: 32.000, walls: { '10': 0.312, STD: 0.375, '20': 0.500, XS: 0.500, '30': 0.625, '40': 0.688 } },
  { nps: '34',    od_in: 34.000, walls: { '10': 0.312, STD: 0.375, '20': 0.500, XS: 0.500, '30': 0.625, '40': 0.688 } },
  { nps: '36',    od_in: 36.000, walls: { '10': 0.312, STD: 0.375, '20': 0.500, XS: 0.500, '30': 0.625, '40': 0.750 } },
  { nps: '42',    od_in: 42.000, walls: { STD: 0.375, XS: 0.500, '20': 0.625, '30': 0.750 } },
  { nps: '48',    od_in: 48.000, walls: { STD: 0.375, XS: 0.500, '20': 0.625, '30': 0.750 } },
  { nps: '54',    od_in: 54.000, walls: { STD: 0.375, XS: 0.500, '20': 0.625 } },
  { nps: '60',    od_in: 60.000, walls: { STD: 0.375, XS: 0.500, '20': 0.625 } }
];

/* HDPE — IPS OD basis (OD matches carbon steel for the same NPS).
   Wall is computed as OD / DR, so only the OD is tabulated here. */
const HDPE_SIZES = [
  { nps: '3/4',   od_in: 1.050 },
  { nps: '1',     od_in: 1.315 },
  { nps: '1-1/4', od_in: 1.660 },
  { nps: '1-1/2', od_in: 1.900 },
  { nps: '2',     od_in: 2.375 },
  { nps: '3',     od_in: 3.500 },
  { nps: '4',     od_in: 4.500 },
  { nps: '5',     od_in: 5.563 },
  { nps: '6',     od_in: 6.625 },
  { nps: '8',     od_in: 8.625 },
  { nps: '10',    od_in: 10.750 },
  { nps: '12',    od_in: 12.750 },
  { nps: '14',    od_in: 14.000 },
  { nps: '16',    od_in: 16.000 },
  { nps: '18',    od_in: 18.000 },
  { nps: '20',    od_in: 20.000 },
  { nps: '22',    od_in: 22.000 },
  { nps: '24',    od_in: 24.000 },
  { nps: '26',    od_in: 26.000 },
  { nps: '28',    od_in: 28.000 },
  { nps: '30',    od_in: 30.000 },
  { nps: '32',    od_in: 32.000 },
  { nps: '34',    od_in: 34.000 },
  { nps: '36',    od_in: 36.000 },
  { nps: '42',    od_in: 42.000 },
  { nps: '48',    od_in: 48.000 },
  { nps: '54',    od_in: 54.000 },
  { nps: '60',    od_in: 60.000 }
];

/* Standard HDPE dimension ratios (DR = OD / wall). */
const HDPE_DR = [7, 7.3, 9, 9.3, 11, 13.5, 17, 21, 26, 32.5, 41];

/* ---- unit tables (factors convert TO the SI base) ------------- */

/* Pipe-dimension display units -> metres. */
const FV_DIM_UNITS = [
  { key: 'mm', label: 'mm', sym: 'mm', factor: 0.001 },
  { key: 'cm', label: 'cm', sym: 'cm', factor: 0.01 },
  { key: 'in', label: 'in', sym: 'in', factor: 0.0254 }
];

/* Volume -> m³ (same keys/factors as the Unit Converter). */
const FV_VOLUME_UNITS = [
  { key: 'cm3',   label: 'cm³ (mL)', sym: 'cm³',    factor: 1e-6 },
  { key: 'L',     label: 'Liter',    sym: 'L',      factor: 0.001 },
  { key: 'm3',    label: 'm³',       sym: 'm³',     factor: 1 },
  { key: 'in3',   label: 'in³',      sym: 'in³',    factor: 1.6387064e-5 },
  { key: 'ft3',   label: 'ft³',      sym: 'ft³',    factor: 0.028316846592 },
  { key: 'usgal', label: 'US gallon', sym: 'US gal', factor: 0.003785411784 },
  { key: 'ukgal', label: 'UK gallon', sym: 'UK gal', factor: 0.00454609 },
  { key: 'bbl',   label: 'Oil barrel', sym: 'bbl',  factor: 0.158987294928 }
];

/* Time -> seconds (same keys/factors as the Unit Converter). */
const FV_TIME_UNITS = [
  { key: 's',   label: 'second', sym: 's',   factor: 1 },
  { key: 'min', label: 'minute', sym: 'min', factor: 60 },
  { key: 'h',   label: 'hour',   sym: 'h',   factor: 3600 },
  { key: 'day', label: 'day',    sym: 'day', factor: 86400 }
];

/* Velocity -> m/s (same keys/factors as the Unit Converter). */
const FV_VELOCITY_UNITS = [
  { key: 'mps', label: 'm/s',    sym: 'm/s',    factor: 1 },
  { key: 'fps', label: 'ft/s',   sym: 'ft/s',   factor: 0.3048 },
  { key: 'fpm', label: 'ft/min', sym: 'ft/min', factor: 0.00508 },
  { key: 'kph', label: 'km/h',   sym: 'km/h',   factor: 1 / 3.6 },
  { key: 'mph', label: 'mph',    sym: 'mph',    factor: 0.44704 },
  { key: 'kn',  label: 'knot',   sym: 'kn',     factor: 0.514444 }
];
