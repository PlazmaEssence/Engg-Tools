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
    desc: 'Convert between metric and imperial units for length, pressure, temperature, flow, velocity, mass, force, torque, area, volume, and density.',
    tags: ['Length', 'Pressure', 'Flow', 'Mass'],
    url: 'tools/unit-converter/',
    status: 'live'
  }
  // Next up, e.g.:
  // {
  //   id: 'wall-thickness',
  //   name: 'Pipe Wall Thickness',
  //   icon: '⭕',
  //   desc: 'B31.3 / B31.4 pressure design thickness calculator.',
  //   tags: ['B31.3', 'B31.4'],
  //   url: 'tools/wall-thickness/',
  //   status: 'coming-soon'
  // },
];
