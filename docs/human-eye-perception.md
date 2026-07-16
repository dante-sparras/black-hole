# Human-eye perception model (high ṁ / bright disks)

## Goal

If you stood near a Kerr BH looking at a thin disk, the eye would **adapt** to
the bright surface: the hole stays black, the ring stays structured, and color
(blue-white inner / redder outer / Doppler sides) remains — not a pure white fog.

## Physical vs display

| Quantity | Physical | Display (this sim) |
|----------|----------|-------------------|
| \(F(r)\) | Page–Thorne ∝ ṁ | Same shape; relative \(F/F_\max\) |
| \(T(r)\) | \(T\propto\dot m^{1/4}\) | Blackbody chroma from \(T_\mathrm{obs}=g\,T\) |
| \(I\propto g^3\) | Ideal bolometric | Locked ON |
| Scene brightness | \(L\sim\eta\dot m\) | **Compressive** ṁ curve + auto exposure + Reinhard |

## Pipeline

1. **Per-sample** intensity soft-knee (`sampleKnee`) on \(I\), then × unit chroma  
2. **ṁ weight compress** + **κ boost** → photosphere saturates (less stack)  
3. **Auto exposure** \(e \propto 1/\sqrt{1+c\,\eta\dot m}\)  
4. **Final eye tonemap** Reinhard on luminance, preserve chromaticity  

## Expected look

- \(\dot m\sim 0.1\): colored, detailed  
- \(\dot m\sim 1{-}3\): much brighter, hotter (bluer), still **not** featureless white  
- Midplane slash reduced vs uncapped stack  

## High-ṁ photosphere (max slider)

For \(\dot m \gtrsim 1\):

1. **Midplane dens suppress** — dens × (1 − k densZ) kills edge-on glowing bar  
2. **Faster τ / harder Beer** — only the surface contributes  
3. **Edge-on path kill** — long midplane chords weighted down  
4. **Structure boost** — filaments survive tonemap  
5. **Outer dust cool** — redder outer limb under hot accretion  
6. **Softer final tonemap + mild saturation** — Doppler / color return  

Still approximate: real super-Eddington disks have winds/thickness beyond thin-disk + sech².

