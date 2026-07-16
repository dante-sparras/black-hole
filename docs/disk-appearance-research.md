# How a real accretion disk looks (research notes)

For Projects/black-hole — realism-first. Not a perfect flat painted circle.

## What high-end visualizations show

Sources: NASA GSFC SVS 13326 (Goddard), GRMHD+GRRT literature, Interstellar/Roussel-style stills.

| Feature | Why it appears | Physics |
|--------|----------------|---------|
| **Bright approaching side** | Doppler + beaming \(I\propto g^{3}\) | Orbiting fluid |
| **Photon ring** | Light wraps 1+ times; nested rings | Strong lensing near \(b_c\) |
| **See underside / far side** | Light bent over the hole | Null geodesics |
| **Volume / thickness** | Finite \(H/R\); path length; not \(y=0\) only | Thin-disk scale height |
| **Flow filaments** | MRI / turbulence streaks along \(\varphi\) | GRMHD structure |
| **Irregular outer edge** | Truncation + clumpy outer disk | Not a hard circle |
| **Warm blackbody palette** | \(T(r)\) NT-like + redshift | Planck, not film LUT as primary |

## Thin vs thick

- **Thin disk (NT):** \(H/R \sim 0.01\)–\(0.1\) — still *looks* deep because of lensing + path through Gaussian density.
- **Thick / truncated (hard state):** geometrically thick flow near hole — needs different model.
- Full **volume GRRT + GRMHD cubes** = offline film quality; real-time uses approximations.

## What this project does

| Layer | Status |
|-------|--------|
| Plane midplane hit + multi-bounce | yes |
| Soft Gaussian slab \(\propto e^{-(y/H)^2}\) | yes (RT) |
| Dimensionless Keplerian texture advection | yes |
| Irregular outer rim (azim. wobble) | yes |
| Full multi-orbit photon-ring stack | partial (hit count) |
| True GRMHD density cube | not yet |

## Controls that matter for the “volume” look

- **H/R thickness** — scale height for slab + path factor  
- **Structure / arms / clumps / dust** — filament detail  
- **Shear / animate** — flow motion  
- Edge-on **inclination** — path length through slab
