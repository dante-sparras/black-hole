# Black Hole Simulation

Best-effort general-relativistic black hole visualization in the browser
(WebGPU + Three.js / TSL).

## No-hair core

1. **Mass \(M\)** — scale  
2. **Spin \(a_\star\)** — \(0\) … \(0.998\)  
3. **Charge \(Q\)** — default \(0\)

**Not hair:** camera, \(\dot{m}\), texture, bloom, presets.

Geometric units: \(G = c = 1\).

## Setup

```bash
bun install
bun run dev       # http://127.0.0.1:5173/
bun test          # unit tests (incl. CPU ref topology)
bun run test:ref  # write tmp/cpu-ref.ppm + print counts
bun run build
```

## Architecture

```
src/
  physics/                 # pure TS (no Three) — bun test
    observer.ts            # camera defaults (shared)
    metricFamily.ts        # schw/kerr/rn/kn routing
    disk.ts                # ISCO, NT, DISK_EMISSION
    geodesic/
      rtConstants.ts       # step floor, steps, escape (GPU↔CPU)
      cpuRef.ts            # topology reference rasterizer
      kerrNull.ts          # knNullAccel + RK4
  state/                   # params, camera, look, presets, scene facade
  app/sceneBridge.ts       # scene → GPU uniforms
  render/                  # TSL geodesicTracer + bloom
  ui/                      # controls, hud, format, orbit
  main.ts                  # WebGPU boot only
```

**Data flow:** UI → state (`getScene`) → sceneBridge → GPU → bloom → canvas  

**Lockstep:** `RT` + `DISK_EMISSION` + `OBSERVER_DEFAULTS` shared by CPU ref and GPU.

## Status

| Feature | State |
|---------|--------|
| Four families on rays | ✅ |
| NT disk + ṁ + blackbody | ✅ |
| Bloom + presets | ✅ |
| CPU ref topology tests | ✅ |
| CPU BL Kerr nulls (Phase 1) | ✅ critical-curve validated |
| Full BL on GPU / live image | ⏳ later |
