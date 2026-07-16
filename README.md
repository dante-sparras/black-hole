# Black Hole Simulation

Best-effort general-relativistic black hole visualization in the browser
(WebGPU + Three.js / TSL).

## No-hair core

1. **Mass \(M\)** — scale  
2. **Spin \(a_★\)** — **signed** \(-0.998\) … \(+0.998\) (default **\(+0.9\)**)  
3. **Charge \(Q\)** — default \(0\)

**Not hair:** camera, \(\dot{m}\), tilt, jets, texture, bloom, presets, **scale-free toggle**.

Geometric units: \(G = c = 1\).

**Camera modes:** scale-free **ON** (default): \(D = d\cdot M\), mass does not change angular size. Scale-free **OFF**: fixed geometric \(D\), mass grows the hole / lensing on screen.

## Setup

```bash
bun install
bun run dev       # http://127.0.0.1:5173/
bun test          # unit tests (incl. CPU ref topology)
bun run test:ref  # write tmp/cpu-ref.ppm + print counts
bun run build
```

## GUI (base physics)

| Section | Controls |
|---------|----------|
| Black hole | \(M\), signed \(a_★\), \(Q\) |
| **Accretion disk (free)** | mdot, rho0, beta0, r_out, tilt, jetBoost |
| Observer | distance/\(M\), incl, azim, FOV |
| Numerics | Quality, Density source |

Derived HUD: \(r_+\), ISCO, effective \(r_\mathrm{in}\), \(r_\mathrm{peak}(\ell)\), \(\eta\), free vs thin \(H/r\), …

See [docs/controls-physics-map.md](docs/controls-physics-map.md) and [docs/limitations.md](docs/limitations.md).

## Architecture

```
src/
  physics/                 # pure TS (no Three) — bun test
  state/                   # params, disk, camera, look, presets
  app/sceneBridge.ts       # scene → GPU uniforms
  render/                  # TSL geodesicTracer + bloom
  ui/                      # controls, hud, orbit
  main.ts                  # WebGPU boot only
```

**Data flow:** UI → state → sceneBridge → GPU → bloom → canvas  

**Lockstep:** `RT` + `DISK_EMISSION` + `OBSERVER_DEFAULTS` shared by CPU ref and GPU.

## Status

| Feature | State |
|---------|--------|
| Four families on rays | ✅ |
| Signed spin UI + default +0.9 | ✅ |
| NT disk + ṁ + blackbody | ✅ |
| Disk tilt | ✅ |
| Optional jets | ✅ |
| Expert Γ / β | ✅ |
| Bloom + presets (incl. retrograde) | ✅ |
| CPU ref topology tests | ✅ |
| Live GPU BL | ✅ |
| Scale-free camera | ✅ |

## Safety branch

`safety/pre-goal-plan-eae1eef` — snapshot before goal-control expansion.
