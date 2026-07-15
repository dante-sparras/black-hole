# black-hole

## Tech Stack

- [Vite](https://vitejs.dev/) - Frontend Build Tool & Dev Server.
- [Bun](https://bun.sh/) - JavaScript All-in-One Toolkit.
- [Three.js](https://threejs.org/) - 3D Graphics Library (WebGPU).

## Status

No-hair parameter core fully wired into GRRT: **Schwarzschild**, **Kerr**, **Reissner–Nordström**, **Kerr–Newman** from \((M, a_\star, Q)\). Real-time Cartesian null geodesics (Binet RN term + Kerr frame-drag), Doppler beaming, NT disk + \(\dot{m}\), blackbody color, bloom, presets, orbit camera.

## Commands

| Command | What it does |
| ------- | ------------ |
| `bun install` | Install deps |
| `bun run dev` | Vite dev server (`http://localhost:5173/` or `http://127.0.0.1:5173/`) |
| `bun run build` | Typecheck (`bunx --bun tsc --noEmit`) + Vite production build |
| `bun run preview` | Preview production build |
| `bun test` / `bun run test` | Tests under `tests/` |

## Preferences

- Write Test-Driven Code — add unit tests for new features and bug fixes. Use `bun test` to run them.
- Geometric units: \(G = c = 1\). Schwarzschild: \(r_s = 2M\), \(r_{ph} = 3M\), \(b_c = 3\sqrt{3}\,M\). Kerr: \(r_+=M+\sqrt{M^2-a^2}\); prograde ISCO/photon sphere shrink with \(a_\star\).
- Prefer real physics root-causes over visual workarounds once GR starts.
- Pure-black voids for captured rays (no fake fill).
- TSL geodesic materials may need `// @ts-nocheck` (TS 7 + three/tsl type graphs can non-terminate).

## No-hair parameters (core)

| Param | Code | Range (UI) | Notes |
| ----- | ---- | ---------- | ----- |
| Mass \(M\) | `mass` | \(0.1\)–\(10\) (default \(1\)) | Primary scale |
| Dimensionless spin \(a_\star = J/M^2\) | `spinStar` | \(0\)–\(0.998\) | Kerr length \(a = a_\star M\) — **affects rays** |
| Charge \(Q\) | `charge` | default 0 | Affects rays (RN/KN) |

**Extremality:** \(M^2 \ge a^2 + Q^2\). Prefer reducing \(Q\) so spin stays the visual lever.

### Disk (not hair) — separate store `state/disk.ts`

| Param | Code | Range | Notes |
| ----- | ---- | ----- | ----- |
| Eddington ratio \(\dot{m}\) | `mdot` | \(10^{-3}\)–\(3\) | \(F\propto\dot{m}\), \(T\propto\dot{m}^{1/4}\) |
| Outer radius | `outerM` | \(8\)–\(80\,M\) | Luminous cutoff; **inner edge = family ISCO** (derived) |

**Not free (realism):** inner edge (locked to ISCO), film palette as primary color.

## Physics layout

```
src/physics/     # pure TS — metricFamily, observer, disk, geodesic/{rtConstants,cpuRef,kerrNull}
src/state/       # params, camera, look, presets, scene facade
src/app/         # sceneBridge (scene → GPU)
src/render/      # geodesicTracer (WebGPU/TSL) + bloom
src/ui/          # controls, hud, format, orbit
src/main.ts      # WebGPU boot only
```

**Camera:** distance in units of \(M\); spin ‖ +Y; disk in XZ (\(y=0\)). Defaults: `OBSERVER_DEFAULTS`.

**Emission:** `DISK_EMISSION` in `physics/disk.ts` — shared with GPU tracer.

**Integration:** `RT` in `physics/geodesic/rtConstants.ts` — step floor ≥0.2M, used by GPU + CPU ref.

**CPU ref:** `bun run test:ref` / `renderCpuRef()` — topology twin of the GPU path.

## Code hygiene

- **Delete, don’t deprecate** — remove dead code; no legacy re-export barrels.
- **No `any`** — use `unknown` or proper types.
- **No `console.log`** — use structured logging if needed.
