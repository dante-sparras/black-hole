# Realism ladder (real-time)

What we can do **interactively** vs what needs offline GRMHD.

## Shipped (this project)

| Rung | What | Physics basis |
|------|------|----------------|
| **1. Photon-ring silk** | Multi-wrap intensity boost near \(r\sim r_\mathrm{ph}\) | Lensed disk images stack on critical orbits |
| **2. Kerr frame-drag** | Spiral phase \(\delta\varphi \propto a_\star (M/r)\) | Lense–Thirring / orbital frame drag wind |
| **3. Log-normal MRI** | \(f=\exp(\sigma\xi-\sigma^2/2)\) dens factor | Compressible turbulence dens PDF |
| **4. GRMHD-like proxy** | Multi-scale advected dens + vertical channels | Stands in for true GRMHD cubes at 60fps |

## Explicitly not real-time (yet)

- **True GRMHD density cubes** (HARM / BHAC / Athena++) — load a 3D snapshot as a 3D texture; offline pipeline.
- **Polarized GRRT** (ipoole / BHOSS) — science products, not interactive.
- **Full frequency-dependent transfer** — multi-frequency integrate.

## Knobs

- Spin \(a_\star\) → more frame-drag twist of arms  
- Structure / Clumps → MRI log-normal contrast  
- Multi-hit paths + soft Beer → photon ring + far-side bridge  

## Formulae (display-locked with CPU tests)

```
logNormalUnitMean(n, σ) = exp(σ·(2n−1) − σ²/2)   // n∈[0,1]
frameDragPhase(a★, r/M) = gain · a★ · (M/r)
photonRingSilk(hits, r/M) = 1 + f(hits) + prox(r≈3M)·boost
```
