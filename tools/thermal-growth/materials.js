/* ============================================================
   Egg Tools — Thermal Growth material list (data only)

   Each entry is a quick-fill for the coefficient of thermal
   expansion, α, given as a mean value near room temperature in
   µm/(m·°C)  — i.e. the number you'd write as value × 10⁻⁶ /°C.

   These are approximate; α is temperature-dependent, so for real
   design use the mean coefficient between installation and design
   temperature from the applicable code table.

   To add a material, just add a { label, a } row below — no code
   changes needed. Keep "Custom / manual entry" (a: null) first.
   ============================================================ */

const TG_MATERIALS = [
  { label: 'Custom / manual entry', a: null },
  { label: 'Carbon steel', a: 11.7 },
  { label: 'Low-alloy / Cr-Mo steel', a: 12.5 },
  { label: 'Austenitic stainless (304 / 316)', a: 16.0 },
  { label: 'Duplex stainless (2205)', a: 13.0 },
  { label: 'Nickel alloy (Alloy 625)', a: 12.8 },
  { label: 'Copper', a: 16.6 },
  { label: 'Aluminum', a: 23.0 },
  { label: 'Cast iron (gray)', a: 10.5 },
  { label: 'HDPE (PE4710)', a: 144 }
];
