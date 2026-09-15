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

   status:
     'live'         — shown normally, linked
     'coming-soon'  — shown grayed-out, not linked (teases an upcoming tool)
     'hidden'       — not shown anywhere (nav or home grid); the tool's
                      files stay in the repo and reachable by direct URL,
                      it's just not advertised while still in development
   ============================================================ */

const EGG_TOOLS = [
  {
    id: 'unit-converter',
    name: 'Unit Converter',
    icon: '⇄',
    desc: 'Convert between metric and imperial units for length, pressure, temperature, flow, velocity, frequency, mass, force, torque, power, area, volume, and density.',
    tags: ['Length', 'Pressure', 'Flow', 'Mass'],
    url: 'tools/unit-converter/',
    status: 'live'
  },
  {
    id: 'flow-velocity',
    name: 'Pipe Flow & Velocity',
    icon: '💧',
    desc: 'Flow rate and velocity in a pipe — pick HDPE or carbon steel, NPS size and schedule/DR to autofill OD, wall and ID, enter a flow rate with compound units, and download a live-formula Excel sheet.',
    tags: ['Flow', 'Velocity', 'HDPE', 'Carbon Steel'],
    url: 'tools/flow-velocity/',
    status: 'live'
  },
  {
    id: 'tmin-calculator',
    name: 'Pipe Wall Thickness (tmin)',
    icon: '⭕',
    desc: 'Minimum required wall thickness for straight pipe under internal pressure — ASME B31.3 and B31.4, with HDPE/carbon-steel NPS and schedule/DR quick-fill (ASME B36.10) checked against the result.',
    tags: ['B31.3', 'B31.4', 'Wall Thickness', 'HDPE', 'Carbon Steel'],
    url: 'tools/tmin-calculator/',
    status: 'hidden'
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
  },
  {
    id: 'kml-to-excel',
    name: 'KML → Excel',
    icon: '🗺️',
    desc: 'Convert a KML route into an Excel spreadsheet — one row per vertex with longitude, latitude and elevation, plus segment length and a running cumulative length (chainage) along the path. Runs entirely in your browser.',
    tags: ['KML', 'Excel', 'Chainage', 'Survey'],
    url: 'tools/kml-to-excel/',
    status: 'live'
  },
  {
    id: 'plot-log',
    name: 'Plot Log',
    icon: '📈',
    desc: 'Digitize a pump performance curve from an image — calibrate the axes (head, power, efficiency, NPSHr all on their own scales), trace or place points, and export the data. Runs entirely in your browser.',
    tags: ['Pump Curves', 'Digitizer', 'Head', 'Efficiency'],
    url: 'tools/plot-log/',
    status: 'live'
  }
];
