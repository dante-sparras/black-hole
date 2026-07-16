# Disk visual realism pass (2026-07)

Goal: accretion disk looks closer to GRMHD / NASA / reference stills while
staying **physics-first** (no silk boost, no painted photon ring).

## What changed

| Layer | Change |
|-------|--------|
| **Spiral arms** | Higher arm contrast, tighter pitch, stronger dens wave |
| **Filaments** | m=2 + m=4 + m=8 flow-aligned streams (emission + dens) |
| **MRI dens** | Higher log-normal σ (~0.68) for clumpy gas |
| **Outer rim** | Ragged multi-mode edge (m=3 + noise) — not a hard circle |
| **Warp** | Mild m=2 midplane warp (~0.1 H) from LT/MRI channels |
| **Zones** | Hotter inner plasma, cooler/darker outer dust |
| **Motion** | Slightly faster shearGain (32) for visible Keplerian wind |

## What did *not* change

- \(I\propto g^3\), Page–Thorne \(F\), pure-black voids
- `photonRingBoost = 0`
- Base-params-only UI
- No film palette as primary color

## How to view

1. Hard-refresh · Quality **High**
2. a★ ≈ 0.9–0.95 · incl ≈ 65–75° · ṁ ≈ 0.1–0.3
3. Watch: L/R Doppler, ragged outer edge, flowing filaments, far-side bridge

## Still not “real GRMHD”

Analytic dens + noise ≠ HARM cubes. Next realism step for structure is a true 3D density texture from GRMHD.
