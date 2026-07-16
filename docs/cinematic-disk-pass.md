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

## Singularity push (defaults)

Defaults now lean hard into his look:

- `filmGrade` **0.88** + `filmEmission` **2.0** + his exact ramp colors  
- H/R **0.032**, densZ³, beer **0.95**  
- noise dens mix **0.92**, edge boost **19.5**  
- bloom str **0.24**, radius **0.02**, thresh **0.08**  

Geodesics still physical; color is largely cinematic display grade.

