# Face-on rings + large-scale swirl (items 1–2)

## Problem
Face-on disk looked like **radar / moiré concentric lace**, not gas.

## Root causes
1. **`rotP = ρ × 4.27`** on noise UV — pure radial phase → concentric interference  
2. **`sin(k · ln r)`** dust/ripple — φ-independent **radar rings**  
3. **m=8 streamlines** + high-freq noise — lace when viewed face-on  
4. **noiseEdgeBoost ~20** — amplifies sampling moiré  

## Fixes
| Fix | Detail |
|-----|--------|
| Noise UV | Material `(cx,sx)` + mild `ln r` pitch / shear — **no ρ×k** |
| Structure | Soft **m=2** arms only; drop m=8 lace |
| Turbulence | Low spatial frequency (×0.95–2.6), curl-ish swirl |
| Dust | Azimuthal m=2, not pure radial sin |
| Edge boost | 6.5 (was 19.5) |

## Still todo (item 3 later)
Hot inner annulus emphasis if still needed after face-on check.
