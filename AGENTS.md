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

- **Realism first** — default to physical behavior over film look. Soft display hacks are optional toggles, not defaults (e.g. ideal \(I\propto g^3\) ON; soft \(g^2\) is opt-out). Prefer GR root-causes over bloom/fill/fake rings.
- **Base parameters only in UI** — free: no-hair \((M,a_★,Q)\), disk \((\dot m, \rho_0, \beta_0, r_\mathrm{out},\) tilt, jet boost\()\), observer. Disk always co-rotates with spin (L ‖ J); **a★ sign** sets direction. **Derived (HUD only):** \(r_\mathrm{in}=\mathrm{ISCO}\), \(H/r\), \(\Gamma=5/3\), \(\ell\), SANE/MAD from \(\beta_0\), jet_eff. No orbit toggle, structure/bloom/look knobs.
- Write Test-Driven Code — add unit tests for new features and bug fixes. Use `bun test` to run them.
- Geometric units: \(G = c = 1\). Schwarzschild: \(r_s = 2M\), \(r_{ph} = 3M\), \(b_c = 3\sqrt{3}\,M\). Kerr: \(r_+=M+\sqrt{M^2-a^2}\); prograde ISCO/photon sphere shrink with \(a_\star\).
- Pure-black voids for captured rays (no fake fill). Blackbody disk color (not film palette as primary).
- Subtle bloom so the shadow stays readable.
- TSL geodesic materials may need `// @ts-nocheck` (TS 7 + three/tsl type graphs can non-terminate).

## No-hair parameters (core)

| Param | Code | Range (UI) | Notes |
| ----- | ---- | ---------- | ----- |
| Mass \(M\) | `mass` | \(0.1\)–\(10\) (default \(1\)) | Scale; angular image invariant if scale-free ON |
| Dimensionless spin \(a_\star = J/M^2\) | `spinStar` | **−0.998…+0.998** (default **+0.9**) | Kerr length \(a = a_\star M\) — **affects rays** (signed) |
| Charge \(Q\) | `charge` | default 0 | Affects rays (RN/KN) |

**Extremality:** \(M^2 \ge a^2 + Q^2\). Prefer reducing \(Q\) so spin stays the visual lever.

### Disk (not hair) — separate store `state/disk.ts`

| Param | Code | Range | Notes |
| ----- | ---- | ----- | ----- |
| Eddington ratio \(\dot{m}\) | `mdot` | \(10^{-3}\)–\(3\) | \(F\propto\dot{m}\), \(T\propto\dot{m}^{1/4}\) |
| Outer radius | `outerM` | \(8\)–\(80\,M\) | Luminous cutoff; **inner edge = family ISCO** (derived) |
| Orbit sense | `prograde` | pro / ret | Co-rotating (default) vs counter-rotating ISCO + Doppler |
| Structure | `structure` | \(0\)–\(1\) | Master mix: 0 = smooth NT, 1 = full texture |
| Gas arms | `arms` | \(0\)–\(1\) | Spiral filament contrast (× structure) |
| Plasma clumps | `clumps` | \(0\)–\(1\) | Turbulence contrast |
| Dust lanes | `dust` | \(0\)–\(1\) | Outer dust contrast + cooler outer T |
| H/R | `scaleHeight` | \(0.02\)–\(0.18\) | Path-length thickness (edge-on); **derived from ṁ+Γ in bridge** |
| Shear speed | `shearRate` | \(0\)–\(1.2\) | Keplerian pattern wind |
| Animate | `animate` | on/off | Differential rotation animation |
| Tilt | `tiltRad` | \(0\)–\(~40°\) | Midplane vs BH spin (+Y) |
| Tilt node | `tiltNodeRad` | \(0\)–\(2\pi\) | Line of nodes |
| Jet power | `jetPower` | \(0\)–\(1\) | Optional bipolar funnel (0 = off) |
| \(\Gamma\) | `gamma` | \(4/3\) or \(5/3\) | Expert EOS → derived H/R |
| Plasma \(\beta\) | `plasmaBeta` | \(0.1\)–\(100\) | Expert MRI dens variance |

**Not free (realism):** inner edge (locked to ISCO), film palette as primary color.

## Physics layout

```
src/physics/     # pure TS — metricFamily, observer, disk, criticalCurve, geodesic/{rtConstants,cpuRef,kerrNull}
src/state/       # params, camera, look, presets, scene facade
src/app/         # sceneBridge (scene → GPU)
src/render/      # geodesicTracer (WebGPU/TSL) + bloom
src/ui/          # controls, hud, format, orbit
src/main.ts      # WebGPU boot only
```

**Camera:** spin ‖ +Y; disk in XZ (\(y=0\)). Defaults: `OBSERVER_DEFAULTS`.

**Scale-free distance (global, not hair / not presets):**
- **ON (default):** \(D = d\cdot M\) with slider = \(d\) (units of \(M\)) — mass **does not** change angular lensing (scale-invariant).
- **OFF:** slider = absolute geometric \(D\) — raising mass **grows** the hole and strengthens angular lensing.
- Resolve with `resolveCameraDistance(mass, distanceM, scaleFree)` (GPU + CPU + probe). Toggle converts \(d \leftrightarrow D\) so the image does not jump.

**Emission:** `DISK_EMISSION` in `physics/disk.ts` — shared with GPU tracer (optical display curves, not SI bolometric).

**Integration:** `RT` + **RK2** (`rk2StepKn`) lockstep GPU TSL ↔ CPU `cpuRef` / `traceKnNull` (default). Step floor ≥0.2M.

**BL (CPU + GPU Phase 4):**
- Phase 1–3: `kerrBl` / `blCamera` / disk hits + `cpuRef({ integrator: 'bl' })`
- Phase 4: live GPU BL via **Geodesics → Integrator** (global, not presets); stats `schw-BL` / `kerr-BL` / …
- Default remains **RT** (Cartesian); BL is opt-in for science silhouette
- Tags with `~` mean approx (e.g. `kerr-RT~`, `rn-BL~` when Q≠0 on Kerr Δ)
- BL escape sky uses exit dir from \((r,\theta,\varphi)\) (lensed)

**Analytic HUD:** `familyCriticalImpacts` / `shadowDiagnostics` — closed-form \(b_c^\pm\); image silhouette is from the real-time integrator.

**CPU ref:** `bun run test:ref` multi-case topology + soft golden checksums · `bun run test:ref:write` regenerates `tests/fixtures/cpu-ref-goldens.json`.

**Debug (runtime):** HUD panel — view modes (fate/steps/g/T/flux/b/sky), live CPU health strip, click-to-probe rays (`src/debug/*`). Not hair / not presets.

## Code hygiene

- **Delete, don’t deprecate** — remove dead code; no legacy re-export barrels.
- **No `any`** — use `unknown` or proper types.
- **No `console.log`** — use structured logging if needed.
