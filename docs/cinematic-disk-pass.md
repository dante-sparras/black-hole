# Cinematic disk pass (P0–P2)

Inspired by [MisterPrada/singularity](https://github.com/MisterPrada/singularity)
while keeping Kerr geodesics + Page–Thorne + \(I\propto g^3\).

## P0 — Surface + noise dens

| Change | Detail |
|--------|--------|
| **Thin H/R** | default `scaleHeight` **0.055** (photosphere, not fog slab) |
| **densZ²** | thinner vertical column |
| **Harder Beer / κ** | surface saturates; less deep stack |
| **`noise_deep.png`** | spiral UV dens layer + dual-sample edges |
| **Stronger cube dual sample** | filament edges from dens gradients |

Asset: `public/noise_deep.png` (from singularity static textures).

## P1 — Film grade + mid-contrast tonemap

| Change | Detail |
|--------|--------|
| **filmGrade ≈ 0.52** | mix physical blackbody with warm gold/brown ramp |
| **Doppler preserved** | mild chroma5 blend via beam |
| **Tonemap** | mid-lift + high compress + sat restore |

## P2 — Env + bloom + edges

| Change | Detail |
|--------|--------|
| **Bloom** | strength 0.3, thresh 0.36 |
| **Sky** | denser/brighter stars, less muddy nebula |
| **Dual dens edges** | higher boost |

## Honesty

- Film grade is **display** (hybrid), not SI bolometric.
- Noise dens is **structure**, not HARM data.
- Geodesics remain physical; we do **not** use fake \(1/r^2\) bend.
