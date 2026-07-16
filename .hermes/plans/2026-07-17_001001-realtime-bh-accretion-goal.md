# Real-time Black Hole + Accretion Disk Goal — Implementation Plan

> **For Hermes:** Use this plan task-by-task. Prefer vertical slices + TDD (`bun test`). Do **not** rewrite the working stack from scratch.

**Goal:** Deliver a real-time, interactive Kerr/RN/KN black-hole + accretion-disk visualization (Three.js WebGPU) where GUI controls feel like real astrophysical base properties, with EHT/cinematic visual quality, and clean revert via a safety branch.

**Architecture:** Keep the existing layered stack — pure `src/physics/` (no Three) → `src/state/` → `src/app/sceneBridge.ts` → WebGPU TSL ray tracer (`src/render/geodesicTracer.ts` + emission modules). Extend **disk matter parameters** and optional jets/tilt as separate stores; never dilute no-hair to more than \((M, a_★, Q)\). Prefer physical mappings of the goal’s “ρ₀ / Γ / β / H/r” language onto quantities that already drive emission and dens, rather than free art knobs.

**Tech Stack:** Bun · Vite · Three.js WebGPU + TSL · custom HUD controls (not lil-gui) · `bun test` physics + CPU ref · geometric units \(G=c=1\).

**Safety branch (created 2026-07-17):**
- `safety/pre-goal-plan-eae1eef` @ `eae1eef` — *look: singularity thin-band disk as primary emission path*
- Working branch at plan time: `refactor/dead-api-and-bridge` (same commit)
- Revert: `git checkout safety/pre-goal-plan-eae1eef` or `git reset --hard safety/pre-goal-plan-eae1eef` on a feature branch
- Implement new work on a **fresh feature branch** from this commit, e.g. `feat/goal-physics-controls`

---

## Locked product decisions (2026-07-17, Dante)

| Decision | Choice | Notes |
|----------|--------|-------|
| Spin control | **Full signed \(a_★ \in [-0.998, +0.998]\)** | More physical/educational; retrograde changes ISCO, lensing, jet strength; users expect full Spin range |
| Default spin | **\(a_★ = +0.9\)** (high prograde) | Nice default visuals; still full range available |
| Disk orbit sense UI | **Deprecate pro/ret as primary spin direction** | Orbital sense follows \(\mathrm{sign}(a_★)\) for co-rotating disk default; keep optional disk counter-rotate only if still needed for L ∦ J science cases (secondary) |
| \(\Gamma\) / \(\beta\) placement | **Expert panel first** | Not main free knobs; subtler visual impact |
| Post–Phase A priority | **1. Tilt → 2. Jets → 3. \(\Gamma\)/\(\beta\) (expert)** | Tilt = max wow / cost; jets next; deep EOS/mag last |
| densNorm free slider | **Skip** unless later proven needed | \(\dot m\) remains density/power lever |

**Revised phase order (execute in this order):**
0. Safety + plan ✅  
**A.** Goal-parity polish + **signed spin** (main free param) + docs/QA  
**B.** Disk **tilt** (was Phase C)  
**C.** Optional **jets** (was Phase D)  
**D.** Expert **\(\Gamma\) / \(\beta\)** (was Phase B)  
**E.** Limitations + README final  
**F.** Stretch  

---

## 0. Honest baseline (what already satisfies the goal)

This is **not** a greenfield project. Most core requirements already land on HEAD.

| Goal requirement | Status on HEAD | Where |
|------------------|----------------|-------|
| Real-time WebGPU BH + disk | ✅ | `src/render/geodesicTracer.ts`, TSL emission |
| Mouse orbit camera | ✅ | `src/ui/orbit.ts` + observer state |
| GUI physics controls | ✅ base set | `src/ui/controls.ts`, `controlsMarkup.ts` |
| Mass, spin, charge on rays | ✅ four families | `state/params`, `knNullAccel`, BL path |
| Gravitational lensing / photon ring | ✅ geodesics | RT force + optional BL integrator |
| Doppler + redshift | ✅ orbiting \(g\), \(I\propto g^3\) | `doppler.ts`, disk emission TSL |
| Turbulent disk motion | ✅ Kepler shear + GRMHD dens | material frame, `.bhcm` cube |
| Temperature coloring | ✅ NT / Page–Thorne + blackbody | `disk.ts`, `blackbody.ts` |
| 60 FPS target path | ✅ quality tiers | `state/quality.ts` (L/M/H) |
| Modular / tested physics | ✅ | `src/physics/*`, `tests/` |
| Optional jets | ❌ not shipped | open |
| Disk tilt | ❌ not shipped | open |
| Free H/r, Γ, β, ρ₀ as sliders | ❌ / deliberate lock | see mapping below |
| Signed spin \(a_★ \in [-1,+1]\) | ⚠️ partial → **A deliverable** | UI spin 0…0.998 + disk pro/ret today; target ±0.998, default +0.9 |
| lil-gui / dat.GUI | ❌ | custom HTML HUD (preferred for base-params policy) |
| True full GRMHD live | ❌ | synthetic/demo `.bhcm`; analytic/PT emission |

**Product policy already locked in AGENTS.md + skill (do not regress):**
- UI exposes **free base parameters** only.
- **Derived, not free:** \(r_+\), \(r_\mathrm{ph}\), ISCO / \(r_\mathrm{in}\), \(\eta_\mathrm{NT}\), \(T(r)\), H/R (thin-disk formula).
- **Locked laws:** scale-free ON, \(I\propto g^3\) ON, pure-black voids, blackbody primary, no fake photon-ring silk.
- Structure / bloom / film grade are **not** main free physics sliders.

---

## 1. Goal language → physical mapping (critical)

The written goal lists several “base properties.” Map them so controls stay meaningful and real-time.

| Goal wording | Physical role in *this* real-time model | Recommended treatment |
|--------------|----------------------------------------|------------------------|
| Mass \(M\) | Scale; horizons / ISCO / steps in units of \(M\) | **Keep free** (`mass`) |
| Spin \(a\) (−1…+1) | Kerr length \(a=a_★M\); frame-drag; ISCO; Doppler; jets | **Phase A — locked:** signed \(a_★\in[-0.998,+0.998]\), **default +0.9**. Wire UI + normalize; co-rotating disk follows sign(a★) |
| Charge \(Q\) | RN/KN \(\Delta\), horizon, Binet term | **Keep free** (`charge`) |
| Density norm \(\rho_0\) / \(\rho_{max}\) | Scales optical depth & emission weight | **Map to \(\dot m\)** only (skip free densNorm unless later needed) |
| Disk aspect ratio \(H/r\) | Volume thickness, edge-on path | **Default derived** via `thinDiskScaleHeight`. Expert override only if ever needed |
| Adiabatic index \(\Gamma\) | EOS → sound speed / scale height | **Phase D (Expert panel):** drives derived H/R; not main panel |
| Magnetic \(\beta\) | MRI turbulence amplitude, dens contrast | **Phase D (Expert panel):** β-proxy → dens variance / clump strength |
| Inner radius / specific \(l\) | Disk inner edge + rotation profile | **Keep ISCO-derived** (co-rotating ISCO uses |a★| helpers as today) |
| Disk tilt | Misaligned disk vs spin axis | **Phase B (highest visual priority after signed spin):** `tiltRad` + optional line of nodes |
| Jets | Optional polar outflows | **Phase C:** analytic funnel / bipolar cones; weaker for retrograde / low |a★|; gated by spin + \(\dot m\) |

**Control philosophy for “feel real”:**
1. One free parameter → multiple derived observables (HUD).
2. Slider change updates uniforms **same frame** via existing store → `sceneBridge` → tracer setters.
3. Labels use astrophysics language: \(M\), \(a_★\), \(Q\), \(\dot m/\dot m_\mathrm{Edd}\), \(r_\mathrm{out}/M\), orbit, (later) tilt / jet power.

---

## 2. Real-time parameter pipeline (how changes hit the image)

```
UI (controlsMarkup + controls)
  → setParams / setDisk / setCamera / setQuality
  → subscribe* → sceneBridge.apply*
  → geodesicTracer uniforms + dens path
  → WebGPU full-screen ray march (RT or BL)
  → bloom (soft) → canvas
```

**Rules when adding a parameter:**
1. Pure function + clamp in `src/physics/*` (tests first).
2. Store in the correct place (`params` = hair only; `disk` = matter; never mix).
3. `normalize*` + `toUniforms` / bridge must push **every** new field.
4. GPU TSL: flat `Fn` bodies; import every used node; no nested helpers that break codegen.
5. CPU ref / probe / health must understand new fields if they affect topology or dens.
6. Presets: snapshot full no-hair **+ disk**; never sky/debug.

**Perf budget (do not break):**
- Quality Med default ~540 steps, DPR 1, volume stride policy, `adaptFloor ≥ 0.2M`
- Target ≥45–60 FPS interactive; Low quality is FPS rescue
- Cost ≈ pixels × steps × (force + volume sample) — denser dens ≠ free

---

## 3. Architecture (keep; extend only)

```
src/physics/           # pure TS — bun test owns math
  types.ts             # BlackHoleParams = {mass, spinStar, charge}
  diskParams.ts        # DiskParams = mdot, outerM, prograde, … (+ future tilt, gamma, betaProxy)
  disk.ts              # ISCO, Page–Thorne, DISK_EMISSION, H/R helpers
  geodesic/*           # RT / BL / cpuRef / knNull
src/state/             # params, disk, camera, quality, grmhd, presets, scene
src/app/sceneBridge.ts # single apply path → GPU
src/render/            # geodesicTracer + tsl/* emission + GRMHD texture
src/ui/                # base-parameter HUD only
docs/                  # limitations + user-facing notes (Phase E)
```

**Do not:**
- Add lil-gui unless user explicitly abandons custom HUD.
- Put \(\dot m\), H/R, tilt on `BlackHoleParams`.
- Expose structure/bloom/film as “physics” in the main panel.
- Claim demo `.bhcm` is published GRMHD.

---

## 4. Gap plan (phased deliverables) — locked order

### Phase 0 — Safety + documentation alignment
- [x] Branch `safety/pre-goal-plan-eae1eef` @ `eae1eef`
- [x] Product decisions locked (signed spin, Expert Γ/β, priority Tilt→Jets→Γ/β)
- [ ] Feature branch: `feat/goal-physics-controls` from safety tip
- Deliverable: this plan document

### Phase A — Goal-parity polish + **signed spin** (ship first)
**Objective:** Base interactive physics GUI is complete and educational; full \(a_★\) range drives rays + disk co-rotation.

| Task | Work |
|------|------|
| A1 | **Signed spin:** `normalizeParams` clamp \(a_★\in[-0.998,+0.998]\); UI slider min/max; default **+0.9** |
| A2 | Co-rotating disk / Doppler / ISCO use signed \(a_★\) consistently (co-rot helpers with \(\|a_★\|\) + sense from sign) |
| A3 | Presets updated for default high prograde; at least one retrograde preset |
| A4 | HUD copy audit + derived readouts complete (\(r_+\), \(r_\mathrm{ph}\), ISCO, \(\eta\), H/R, \(T_\mathrm{peak}\), mode tag) |
| A5 | Live QA: \(a_★=+0.9\) vs \(-0.9\) vs \(0\) — ISCO, L/R beam, frame-drag sense, stats tags |
| A6 | README running + short limitations draft |
| A7 | Orbit pro/ret: demote from primary “spin direction”; keep only if L ∦ J science toggle is still valuable (optional secondary) |

**Acceptance:** Spin slider −0.998…+0.998; default +0.9; negative spin clearly changes image + derived geometry; tests green.

### Phase B — Disk **tilt** (highest visual priority after A)
**Objective:** Optional tilt of disk midplane vs BH spin (+Y).

1. `DiskParams.tiltRad` (0…~30–45°) + optional line-of-nodes `tiltNodeRad`
2. Pure `tiltFrame` helper (CPU tests: tilt=0 identity)
3. GPU dens + singularity thin-band + Doppler basis use same frame
4. UI main-panel slider under Accretion disk
5. Face-on + edge-on browser vision QA

### Phase C — Optional **jets**
**Objective:** Bipolar jets that react to spin + \(\dot m\) (weaker for retrograde / low \(\|a_★\|\)).

1. `jetPower` 0…1 (default 0) or soft spin·ṁ gate + user boost
2. Analytic funnel / volumetric cones along ±spin axis
3. No glow inside capture silhouette; early reject for perf
4. Main panel “Jets (optional)” section

### Phase D — Expert **Γ / β** (subtle physics depth)
**Objective:** Deep controls behind Expert disclosure — not main panel.

| Param | Sketch |
|-------|--------|
| \(\Gamma\) | 4/3 or 5/3 → feeds derived H/R |
| \(\beta\) proxy | plasma β → MRI dens variance / clumps (not emission multiply) |
| Free H/r | still derived by default; no free densNorm |

### Phase E — Docs / limitations deliverable
`README.md`, `docs/limitations.md`, `docs/controls-physics-map.md`

### Phase F — Stretch
True GRMHD dumps, full RN/KN BL Δ, compute prepass, polarized GRRT offline

---

## 5. Bite-sized implementation tasks (execute after user says go)

### Task 0: Feature branch
```bash
cd /c/Users/dante/Projects/black-hole
git checkout safety/pre-goal-plan-eae1eef
git checkout -b feat/goal-physics-controls
```
Verify: `git status -sb` clean on new branch.

### Task 1: Signed spin domain + UI (Phase A core)

**Objective:** \(a_★\in[-0.998,+0.998]\), default +0.9, image + HUD respond to sign.

**Files:**
- Modify: `src/physics/constants.ts` (document signed range; keep MAX_SPIN_STAR = 0.998)
- Modify: `src/physics/validate.ts` / normalize path for signed clamp
- Modify: `src/state/params.ts` defaults → spinStar: 0.9
- Modify: `src/ui/controlsMarkup.ts` slider min=-MAX max=+MAX
- Modify: `src/ui/controls.ts` bind/sync
- Modify: `src/state/presets.ts` (high prograde default scenes; add retrograde pack)
- Test: existing Kerr tests + new cases for a★=-0.9 ISCO / family / no NaN

**Steps (TDD):**
1. Failing tests for negative spin normalize + co-rotating ISCO at a★=-0.9
2. Implement clamp + default
3. Wire UI range
4. `bun test` green; manual: negative spin flips Doppler sense / ISCO grows for co-rotating disk policy
5. Commit: `feat(spin): signed a★ range with default +0.9`

### Task 2: Document goal mapping in-repo

**Files:**
- Create: `docs/controls-physics-map.md`
- Modify: `README.md` (link + short limitations table)

**Content minimum:** table from §1 + “approximations vs full GRMHD” bullets.

**Verify:** file exists; no code change required for green build.

### Task 2: Derived HUD completeness audit
**Files:** `src/ui/hud.ts`, `src/ui/format.ts`, `src/physics/diagnostics.ts` (read-only first)

**Steps:**
1. List currently shown derived quantities.
2. Ensure: \(r_+\), \(r_-\) (if relevant), \(r_\mathrm{ph}\), \(r_\mathrm{ISCO}\), \(b_c^\pm\), \(\eta_\mathrm{NT}\), H/R, \(T_\mathrm{peak}\) proxy, family + honesty tag (`kerr-RT~` etc.).
3. Fill only missing **readouts** (not free sliders).

**Verify:** `bun test` green; manual HUD check.

### Task 3: Live browser vision QA checklist (no code unless bug)
Run `bun run dev`, then for each:
- Spin 0 → +0.9: ring asymmetry / frame-drag / stats `kerr-RT~`
- Spin +0.9 vs −0.9: co-rotating ISCO / Doppler sense / lensing asymmetry differ
- Q 0 → 0.5, a=0: `rn-RT`, horizon moves
- ṁ low → high: cool/dim → hot/bright without pure white fog
- Face-on (incl ~5–10°): no radar rings; singularity thin-band look intact
- Edge-on: volume thickness sensible; pure black shadow

**If regression:** fix root cause in dens/emission; do not add film hacks.

### Task 7 (Phase D): \(\Gamma\) → derived H/R (Expert)
**Files:**
- Modify: `src/physics/diskParams.ts`, `src/physics/disk.ts` (`thinDiskScaleHeight`)
- Modify: `src/state/disk.ts`, `src/app/sceneBridge.ts`
- Modify: `src/ui/controlsMarkup.ts`, `src/ui/controls.ts`
- Test: `tests/` disk / scale-height tests (create if missing)

**TDD:**
1. Write test: \(\Gamma=5/3\) vs \(4/3\) changes H/R at fixed ṁ in expected direction.
2. Implement clamp + formula hook.
3. Wire UI select “EOS Γ” with values 4/3 and 5/3 only (YAGNI).
4. Bridge applies derived `scaleHeight` unless manual mode (manual later).
5. Commit: `feat(disk): adiabatic index drives H/R`

### Task 8 (Phase D): plasma-β proxy → dens variance (Expert)
**Files:** dens sampling TSL (`diskHitEmission.ts` / volume dens path), `diskParams`, bridge, UI

**Rules:**
- Affects dens contrast / MRI log-normal scale, **not** NT \(T(r)\) peak directly
- ṁ remains temperature/power lever
- Tests: β high → higher dens variance metric on CPU helper if extractable; else document visual QA

### Task 5 (Phase B): disk tilt
**Files:** `diskParams`, geometry helper `tiltFrame.ts` (new, pure), CPU dens path if any, GPU dens + emission, Doppler basis, UI, tests

**TDD:**
1. Pure rotation matrix / midplane signed height with tilt.
2. tilt=0 golden ≡ previous heights within ε.
3. GPU: wire `uTilt`, flat TSL.
4. UI slider 0–30°.

### Task 6 (Phase C): optional jets
**Files:** new `src/physics/jets.ts` + TSL accumulate along polar cones; diskParams `jetPower`; UI; tests for power=0 identity

### Task 9: Limitations + README final pass (Phase E)
**Files:** `README.md`, `docs/limitations.md`

**Must state:**
- Real-time Kerr force / optional BL — not full numerical GRMHD
- Demo dens cube is synthetic unless user loads a converted dump
- Thin-disk NT/Page–Thorne emission; β/Γ are effective
- Extremality clamps; a★ max 0.998
- Capture pure black by design

### Task 10: Full verification gate
```bash
bun test
bun run test:ref
bun run build
bun run dev   # browser vision checklist Task 3
```
All green before calling the goal “done” for the phase being shipped.

---

## 6. GUI design (stay custom HUD)

Keep **custom HTML controls** (already matches base-params policy, no new dependency).

**Main panel sections (target end state):**

1. **Presets** — base-parameter packs (include high prograde + retrograde)
2. **Black hole (no-hair)** — \(M\), **signed \(a_★\)** (−0.998…+0.998), \(Q\)
3. **Accretion disk** — \(\dot m\), \(r_\mathrm{out}/M\), **tilt** (Phase B); optional secondary counter-rotate if kept
4. **Jets (optional)** — power 0…1 (Phase C)
5. **Observer** — distance/M, incl, azim, FOV
6. **Numerics** — Quality, Density source — not physics law
7. **Expert disk** (collapsed) — \(\Gamma\), \(\beta\) proxy (Phase D)
8. **Derived HUD** — horizons, photon sphere, ISCO, \(b_c\), \(\eta\), H/R, \(T\) scale, mode tag

**Defaults (locked):**
- \(M=1\), **\(a_★=+0.9\)**, \(Q=0\), \(\dot m\sim0.1\), \(r_\mathrm{out}\sim24M\), tilt=0, jetPower=0
- scale-free ON, quality med, GRMHD dens when cube present

**Ranges:**
- Mass 0.1–10 · **spin −0.998…+0.998** · Q 0–0.95 with extremality clamp
- ṁ log \(10^{-3}\)–3 · outer 8–80 M · tilt 0–30° · jet 0–1

Do **not** switch to lil-gui unless product decision changes.

---

## 7. Shader / dens strategy (keep winning path)

1. **Primary emission look:** singularity thin-band α composite + noise dens + gold→brown→black ramp on physical flux gate (`singularityDisk.ts` path) — do not reintroduce filmGrade as main lever.  
2. **Geodesics:** default RT Cartesian null force (honest `~` tags); BL optional for science silhouette.  
3. **Volume dens:** sech² photosphere gate + GRMHD R8 `texture3D` sample (Kepler-advected) + residual filaments.  
4. **Beer / capture:** `beerSoft~0.72`, capture ~1.02 \(r_+\), step floor ≥0.2M, photon-sphere refine.  
5. **Face-on QA mandatory** after dens/look changes (incl ~5–10°) — radar rings are a known failure mode (shearGain~6, no ρ×k lace).

**WebGPU compute:** not required for Phase A–D. Fragment full-screen RT already is the interactive engine. Revisit compute only for time-evolving dens fields.

---

## 8. Risks & tradeoffs

| Risk | Mitigation |
|------|------------|
| Goal doc invites free art knobs (ρ₀, H/r free, raw T) | Map to physical proxies; keep AGENTS policy |
| Adding Γ/β/tilt breaks dens → black canvas | TSL import discipline; restore dens path first; `git checkout safety/…` if needed |
| Free \(r_\mathrm{in}\) fights ISCO physics | Expert mode only + warning |
| Jets look fake | Gate by spin·ṁ; dim Schw; no unattenuated glow in shadow |
| Perf drop from tilt/jets | Early reject; quality strides; profile before shipping High defaults |
| Scope creep to full GRMHD | Document offline; keep procedural + cube dens |
| Working on wrong branch / lose eae1eef look | Always branch from `safety/pre-goal-plan-eae1eef` |

---

## 9. Decisions log (resolved 2026-07-17)

| # | Question | Decision |
|---|----------|----------|
| 1 | Signed spin vs pro/ret only? | **Full signed \(a_★\in[-0.998,+0.998]\)**; default **+0.9** |
| 2 | Γ / β main or Expert? | **Expert panel first** |
| 3 | Jets default? | Default **off** (0); strength scales with spin·ṁ when enabled (open to soft-on high-spin presets later) |
| 4 | densNorm free slider? | **Skip** |
| 5 | Priority after Phase A? | **Tilt → Jets → Γ/β (expert)** |

Remaining soft choice (non-blocking): keep a secondary “disk counter-rotate” toggle for L ∦ J, or drop it once signed spin ships.

---

## 10. Definition of done (full goal)

- [ ] Safety branch retained and documented in README
- [ ] Feature work on non-`main` branch with conventional commits
- [ ] Signed spin free param; default +0.9; retrograde visibly different
- [ ] Tilt + optional jets shipped per phases B–C
- [ ] Expert Γ/β available without cluttering main panel
- [ ] GUI base properties feel astrophysical; derived HUD complete
- [ ] Real-time updates for all free params
- [ ] Visual: lensing, photon ring, Doppler/redshift, turbulent motion, temperature color; jets when enabled
- [ ] `bun test` + `bun run test:ref` + `bun run build` green
- [ ] Browser vision face-on + edge-on QA
- [ ] README + `docs/limitations.md` state approximations honestly
- [ ] Clean modular code; no `any`, no `console.log`, physics free of Three

---

## 11. Immediate next action

Plan + decisions locked. **Implement when Dante says go.**

```bash
git checkout safety/pre-goal-plan-eae1eef
git checkout -b feat/goal-physics-controls
# Phase A: signed spin + defaults + HUD/docs QA
# Phase B: tilt
# Phase C: jets
# Phase D: expert Γ/β
# Phase E: limitations docs
```

**Suggested first code commit after go:** `feat(spin): signed a★ range with default +0.9`
