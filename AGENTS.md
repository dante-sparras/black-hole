# black-hole

## Tech Stack

- [Vite](https://vitejs.dev/) - Frontend Build Tool & Dev Server.
- [Bun](https://bun.sh/) - JavaScript All-in-One Toolkit.
- [Three.js](https://threejs.org/) - 3D Graphics Library (WebGPU).

## Status

No-hair parameter core is in place (mass \(M\), spin \(a_\star\), charge \(Q\)) with analytic derived geometry, unit tests, and HUD sliders. Geodesic ray tracing not yet implemented — blank WebGPU scene with live physics readout.

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
- Geometric units: `G = c = 1`. Schwarzschild horizon \(r_s = 2M\), photon sphere \(r_{ph} = 3M\), \(b_c = 3\sqrt{3}\,M\).
- Prefer real physics root-causes over visual workarounds once GR starts.
- Pure-black voids for captured rays (no fake fill).

## No-hair parameters (core)

Stationary Einstein–Maxwell black holes are characterized by three classical parameters only:

| Param | Code | Range (UI) | Notes |
| ----- | ---- | ---------- | ----- |
| Mass \(M\) | `mass` | \(0.1\)–\(10\) (default \(1\)) | Primary scale |
| Dimensionless spin \(a_\star = J/M^2\) | `spinStar` | \(0\)–\(0.998\) | Kerr length \(a = a_\star M\) |
| Charge \(Q\) | `charge` | \(0\)–… (default \(0\), Advanced) | Astrophysically usually ~0 |

**Extremality:** enforce \(M^2 \ge a^2 + Q^2\). `normalizeParams` clamps \(|a_\star| \le 0.998\) and reduces \(|Q|\) first so spin stays the visual lever.

**Not hair (scene/observer — later):** inclination, camera distance, disk temperature, jets, resolution.

**Camera convention (planned):** distance in units of \(M\) so changing mass does not reframe the hole.

## Physics layout

```
src/physics/     pure TS (no Three.js) — unit-tested
  constants.ts   G=c=1, MAX_SPIN_STAR, defaults
  types.ts       BlackHoleParams, DerivedGeometry, MetricFamily
  validate.ts    normalizeParams, isExtremalOk
  schwarzschild.ts / kerr.ts / kn.ts / derive.ts
src/state/params.ts   reactive store
src/ui/controls.ts    sliders
src/render/uniforms.ts  CPU snapshot for future GPU geodesics
```

Metric family routing: Schwarzschild → Kerr → Reissner–Nordström / Kerr–Newman from \((a_\star, Q)\).

## Code hygiene

- **Delete, don’t deprecate** — remove dead code; no `@deprecated` stubs or legacy re-export barrels.
- **No `any`** — use `unknown` or proper types instead.
- **No `console.log`** — use `debug()` or `logger.info()` instead.
