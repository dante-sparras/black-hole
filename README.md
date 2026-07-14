# Black Hole Simulation

Best-effort general-relativistic black hole visualization in the browser (WebGPU + Three.js).

## No-hair core

Controllable classical parameters only:

1. **Mass \(M\)** — scale setter (horizon, photon sphere, lensing strength)
2. **Spin \(a_\star\)** — dimensionless Kerr spin (\(0\) … \(0.998\))
3. **Charge \(Q\)** — default \(0\) (Advanced); RN / Kerr–Newman when non-zero

Everything else (disk, camera, jets) is scene/observer, not black-hole “hair.”

Geometric units: \(G = c = 1\).

## Setup

```bash
bun install
bun run dev
```

```bash
bun test
bun run build
```

## Current milestone

- [x] Parameter domain + validation + derived geometry (Schwarzschild / Kerr / KN)
- [x] HUD sliders + live \(r_\pm\), family, extremality
- [ ] Null geodesic ray tracer (Schwarzschild first)
- [ ] Thin accretion disk + photon ring from multi-orbit light
- [ ] Kerr geodesic upgrade (asymmetric shadow / frame-dragging)
