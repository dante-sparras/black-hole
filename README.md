# Black Hole Simulation

Best-effort general-relativistic black hole visualization in the browser
(WebGPU + Three.js / TSL).

## No-hair core

Controllable classical parameters only:

1. **Mass \(M\)** — scale setter (horizon, photon sphere, lensing strength)
2. **Spin \(a_\star\)** — dimensionless Kerr spin (\(0\) … \(0.998\))
3. **Charge \(Q\)** — default \(0\); RN / Kerr–Newman when non-zero

**Not hair:** camera, Eddington ratio \(\dot{m}\), disk texture, bloom/look, presets.

Geometric units: \(G = c = 1\).

## Setup

```bash
bun install
bun run dev      # http://127.0.0.1:5173/
bun test
bun run build
```

## Architecture

```
src/
  physics/          # pure TS math (bun test) — no Three.js
    metricFamily.ts # schw/kerr/rn/kn routing + RT mode tags
    disk.ts         # ISCO, NT, DISK_EMISSION (CPU↔GPU lockstep)
    geodesic/       # CPU null integrators
  state/            # params, camera, look, presets (stores)
  app/
    sceneBridge.ts  # stores → tracer/bloom wiring + stats
  render/           # WebGPU/TSL geodesicTracer + bloom
  ui/               # controls, hud, format, orbit
  main.ts           # WebGPU boot only
```

**Data flow:** UI/orbit → state stores → `sceneBridge` → GPU uniforms → TSL ray marcher → bloom → canvas.

Disk emission constants (`DISK_EMISSION`) live in `physics/disk.ts` and are
imported by the GPU tracer so color/brightness cannot drift.

## Status

| Feature | State |
|---------|--------|
| Schwarzschild / Kerr / RN / KN on rays | ✅ |
| Orbit camera (D/θ/φ/FOV) | ✅ |
| Family ISCO + Novikov–Thorne disk | ✅ |
| Eddington \(\dot{m}\) (log slider) | ✅ |
| Orbiting redshift + Doppler beam | ✅ |
| Blackbody multi-color disk (Planck \(B_λ\)) | ✅ |
| Seamless disk texture | ✅ |
| Unreal bloom + ACES (subtle) | ✅ |
| Scene presets (shared camera) | ✅ |
| Full Boyer–Lindquist geodesics | ⏳ later |

## License

Private project.
