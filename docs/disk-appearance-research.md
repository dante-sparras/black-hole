# How a real accretion disk looks (research notes)

For Projects/black-hole — realism-first. Not a perfect flat painted circle.

## What high-end visualizations show

Sources: NASA GSFC SVS 13326 (Goddard), GRMHD+GRRT literature, Interstellar/Roussel-style stills.

| Feature | Why it appears | Physics |
|--------|----------------|---------|
| **Bright approaching side** | Doppler + beaming \(I\propto g^{3}\) | Orbiting fluid |
| **Photon ring** | Light wraps 1+ times; nested rings | Strong lensing near \(b_c\) |
| **See underside / far side** | Light bent over the hole | Null geodesics |
| **Volume / thickness** | Finite \(H/R\); path length at *crossings* | Thin-disk scale height |
| **Flow filaments** | MRI / turbulence streaks along \(\varphi\) | GRMHD structure |
| **Irregular outer edge** | Truncation + clumpy outer disk | Not a hard circle |

## Pitfall — midplane slash (fixed)

**Symptom:** white thin line / solid band through the black hole at high inclination.

**Cause:**
1. Per-step soft-volume samples along \(|y|<H\) — edge-on rays stack emission all the way into the shadow.
2. Uncapped path factor \(H/|n_y|\) → infinite bright sheet.

**Fix:** plane crossings only + micro-crossing guard + hard-capped pathFac + crossing-angle weight.

## Real-time approach (this project)

| Layer | Status |
|-------|--------|
| Plane midplane hit + multi-bounce | yes |
| Capped path-length thickness at crossings | yes |
| Dimensionless Keplerian texture advection | yes |
| Irregular outer rim | yes |
| Per-step volumetric slab | **removed** (slash bug) |
| True GRMHD density cube | not yet |
