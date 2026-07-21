/* ============================================================
   Egg Tools — tool registry
   Single source of truth for every tool on the site. The home
   page's tool grid and every page's header nav dropdown are
   both generated from this list.

   To add a new tool:
     1. Build it in tools/<id>/index.html (+ its own .js file)
     2. Add one entry below
   Nothing else needs to change — the home page and nav update
   automatically.
   ============================================================ */

const EGG_TOOLS = [
  {
    id: 'unit-converter',
    name: 'Unit Converter',
    icon: '⇄',
    desc: 'Convert between metric and imperial units for length, pressure, temperature, flow, velocity, frequency, mass, force, torque, area, volume, and density.',
    tags: ['Length', 'Pressure', 'Flow', 'Mass'],
    url: 'tools/unit-converter/',
    status: 'live'
  },
  {
    id: 'tmin-calculator',
    name: 'Pipe Wall Thickness (tmin)',
    icon: '⭕',
    desc: 'Minimum required wall thickness for straight pipe under internal pressure — ASME B31.3 and B31.4.',
    tags: ['B31.3', 'B31.4', 'Wall Thickness'],
    url: 'tools/tmin-calculator/',
    status: 'live'
  },
  {
    id: 'thermal-growth',
    name: 'Pipe Thermal Growth',
    icon: '🌡️',
    desc: 'Unrestrained thermal growth of a pipe run from length, installation and operating temperature, and coefficient of thermal expansion, with unit dropdowns on every input and the output.',
    tags: ['Thermal', 'Expansion', 'Flexibility'],
    url: 'tools/thermal-growth/',
    status: 'live'
  },
  {
    id: 'photo-kmz',
    name: 'Photo → KMZ',
    icon: '📍',
    desc: 'Turn geotagged photos into a KMZ for Google Earth — one pin per photo, click to see the image. Reads GPS from each photo, or set coordinates by hand. Runs entirely in your browser.',
    tags: ['KMZ', 'Google Earth', 'GPS', 'Photos'],
    url: 'tools/photo-kmz/',
    status: 'live'
  }
];
