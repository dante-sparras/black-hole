# Scale-free camera toggle Implementation Plan

> **For Hermes:** Implement task-by-task (TDD). Do **not** change no-hair physics; only observer distance resolution.

**Goal:** Add a global checkbox so the user can switch between **scale-free** viewing (current: camera at \(D = d\,M\), mass does not change angular lensing) and **fixed geometric distance** (\(D\) independent of \(M\), raising mass enlarges the hole and strengthens angular lensing).

**Architecture:** Keep geometric units \(G=c=1\). Introduce a pure resolver `resolveCameraDistance(mass, camera, scaleFree)` used by GPU tracer, CPU ref, BL camera, and probe. Store `scaleFree` as a **global** flag (like sky / geodesic integrator — not hair, not presets). On toggle, convert the stored distance so the image does not jump. Default remains scale-free.

**Tech Stack:** Bun, Vite, Three.js WebGPU/TSL, existing state stores + sceneBridge.

---

## Physics (do not re-litigate)

| Mode | Camera distance \(D\) | Mass slider effect on image |
|------|----------------------|-----------------------------|
| **Scale-free (default)** | \(D = d \cdot M\) with \(d =\) `camera.distanceM` | None (angular size fixed). Correct GR scale invariance. |
| **Fixed \(D\)** | \(D = d\) with same store field, meaning absolute geometric length | Higher \(M\) → larger \(r_+\), \(b_c\), disk in fixed frame → **stronger angular lensing** |

Disk radii stay \(\propto M\) (ISCO, \(r_{\rm out}/M\)) in **both** modes — that is physical for a disk bound to the hole. Only the **observer distance** formula changes.

At \(M = 1\) both modes are identical when \(d\) is the same number.

---

## UX copy (Camera section)

```
☐ Scale-free distance   (on by default)

Hint when ON:
  D = d·M · Mass cancels angular size · use Distance / FOV to zoom

Hint when OFF:
  D fixed in geometric units · Mass grows the hole & lensing on screen
```

- Slider label ON: `Distance / M` · readout `60.0 M` (meaning \(d\))
- Slider label OFF: `Distance` · readout `60.0` (geometric length; same unit system as \(M\))
- Stats tag: `D/M` vs `D-fix` (or `scale-free` / `fixed-D`)

Presets **must not** change `scaleFree` (global, like sky).

---

## Approach

### Core pure function (single source of truth)

```ts
// src/physics/observer.ts (or src/physics/cameraDistance.ts)

/**
 * Geometric camera distance from BH center (G=c=1 length).
 * scaleFree: D = distanceM * mass  (distanceM is in units of M)
 * !scaleFree: D = distanceM          (distanceM is absolute geometric length)
 */
export function resolveCameraDistance(
  mass: number,
  distanceM: number,
  scaleFree: boolean,
): number {
  const m = Math.max(mass, 1e-12)
  const d = Math.max(distanceM, 1e-12)
  return scaleFree ? d * m : d
}

/** Keep on-screen distance continuous when flipping the mode. */
export function convertDistanceOnScaleFreeToggle(
  distanceM: number,
  mass: number,
  nextScaleFree: boolean,
): number {
  const m = Math.max(mass, 1e-12)
  // nextScaleFree true: store was absolute D → want d = D/M
  // nextScaleFree false: store was d = D/M → want D = d*M
  return nextScaleFree ? distanceM / m : distanceM * m
}
```

### Store

```ts
// src/state/scaleFree.ts  (mirror geodesic.ts / sky.ts)
export type ScaleFreeState = { scaleFree: boolean }
export const SCALE_FREE_DEFAULTS = { scaleFree: true }
// getScaleFree / setScaleFree / subscribeScaleFree
// use emitStore('scaleFree', ...) for batching
```

Wire into `SceneSnapshot` / `ScenePatch` **optionally** (like geodesic), but **presets must not set it**.

### GPU

Today:

```ts
const camD = uCamDistM.mul(M)
```

Add uniform `uScaleFree` (0|1):

```ts
// TSL: camD = scaleFree ? distanceM * M : distanceM
const camD = uScaleFree.greaterThan(0.5).select(uCamDistM.mul(M), uCamDistM)
```

`setCamera` can stay as-is; add `setScaleFree(boolean)` on tracer or fold into camera upload from bridge.

### CPU lockstep (mandatory)

Replace every `cam.distanceM * mass` with `resolveCameraDistance(mass, cam.distanceM, scaleFree)` in:

- `src/physics/geodesic/cpuRef.ts` (`camBasis`)
- `src/physics/geodesic/blCamera.ts` (`cameraBasis` / camera ray)
- `src/debug/probe.ts`

Pass `scaleFree` via options defaulting to `true` so existing tests stay green.

### Bridge

- Subscribe `scaleFree` store → tracer uniform + no full spacetime re-upload required
- `formatStats`: append ` · D/M` or ` · D-fix`

### UI

- Checkbox in Camera section (`controlsMarkup.ts` + `controls.ts`)
- On change: `setScaleFree` + `setCamera({ distanceM: convertDistanceOnScaleFreeToggle(...) })` inside `withBatch`
- Dynamic label/hint/readout for distance slider

---

## Step-by-step tasks

### Task 1: Pure distance resolver + tests

**Objective:** Lock the math and toggle conversion.

**Files:**
- Create/Modify: `src/physics/observer.ts` (or `src/physics/cameraDistance.ts` + re-export from observer/index)
- Create: `tests/physics/cameraDistance.test.ts`

**Step 1: Failing tests**

```ts
import { describe, expect, test } from 'bun:test'
import {
  resolveCameraDistance,
  convertDistanceOnScaleFreeToggle,
} from '../../src/physics/observer' // or cameraDistance

describe('resolveCameraDistance', () => {
  test('scale-free: D = d * M', () => {
    expect(resolveCameraDistance(2, 60, true)).toBeCloseTo(120, 10)
    expect(resolveCameraDistance(0.5, 60, true)).toBeCloseTo(30, 10)
  })

  test('fixed-D: D = d independent of M', () => {
    expect(resolveCameraDistance(2, 60, false)).toBeCloseTo(60, 10)
    expect(resolveCameraDistance(0.5, 60, false)).toBeCloseTo(60, 10)
  })

  test('M=1 both modes equal', () => {
    expect(resolveCameraDistance(1, 60, true)).toBeCloseTo(
      resolveCameraDistance(1, 60, false),
      10,
    )
  })
})

describe('convertDistanceOnScaleFreeToggle', () => {
  test('round-trip preserves D', () => {
    const M = 2
    const dScale = 60 // D/M
    const D = convertDistanceOnScaleFreeToggle(dScale, M, false) // → 120
    expect(D).toBeCloseTo(120, 10)
    const back = convertDistanceOnScaleFreeToggle(D, M, true) // → 60
    expect(back).toBeCloseTo(60, 10)
  })
})
```

**Step 2:** `bun test tests/physics/cameraDistance.test.ts` → FAIL  
**Step 3:** Implement functions  
**Step 4:** Tests PASS  
**Step 5:** Commit `test(physics): camera distance scale-free resolver`

---

### Task 2: Global `scaleFree` store

**Objective:** Global flag default `true`, batched notifies.

**Files:**
- Create: `src/state/scaleFree.ts`
- Modify: `src/state/scene.ts` — include in snapshot; optional patch; **presets untouched**
- Create: `tests/physics/scaleFree.test.ts` — default true; set false; presets do not change it

**Commit:** `feat(state): global scaleFree store`

---

### Task 3: CPU ref + BL + probe lockstep

**Objective:** All CPU paths use resolver.

**Files:**
- Modify: `src/physics/geodesic/cpuRef.ts` — `CpuRefOptions.scaleFree?: boolean` default true; `camBasis(..., scaleFree)`
- Modify: `src/physics/geodesic/blCamera.ts`
- Modify: `src/debug/probe.ts`
- Test: extend `tests/physics/cpuRef.test.ts` or cameraDistance integration:

```ts
// With fixed D, larger M captures more of the field / center still capture but
// escape counts change at fixed FOV — optional soft check:
// scaleFree false, same d, M=1 vs M=2 → different fate map (not identical counts)
```

Minimal solid test: unit-test that `camBasis` distance equals resolver (export or test via known escape radius). Prefer calling pure resolver only if basis is not exported; otherwise add:

```ts
test('cpuRef camD respects scaleFree', () => {
  // if you export camD from a thin helper used by cpuRef
})
```

**Commit:** `fix(physics): resolve camD for scale-free toggle`

---

### Task 4: GPU tracer + bridge

**Objective:** Live image matches CPU.

**Files:**
- Modify: `src/render/geodesicTracerTypes.ts` — `setScaleFree(on: boolean)` or pass via camera params
- Modify: `src/render/geodesicTracer.ts` — `uScaleFree`, `camD` select
- Modify: `src/app/sceneBridge.ts` — subscribe + apply + stats tag
- Modify: `src/main.ts` only if connect path needs an apply call (prefer store sub)

**camD TSL:**

```ts
const camD = uScaleFree
  .greaterThan(0.5)
  .select(uCamDistM.mul(M), uCamDistM)
```

**Commit:** `feat(render): GPU scale-free distance uniform`

---

### Task 5: Controls UI

**Objective:** Checkbox + continuous toggle + labels.

**Files:**
- Modify: `src/ui/controlsMarkup.ts` — checkbox `#c-scale-free` under Camera
- Modify: `src/ui/controls.ts` — bind; convert distance on toggle; dynamic distance label/hint
- Optional: `src/style.css` only if needed

**Toggle handler (must batch):**

```ts
import { withBatch } from '../state/batch'
import { getScaleFree, setScaleFree } from '../state/scaleFree'
import { getParams } from '../state/params'
import { getCamera, setCamera } from '../state/camera'
import { convertDistanceOnScaleFreeToggle } from '../physics/observer'

// on checkbox change:
const next = checkbox.checked
withBatch(() => {
  const M = getParams().mass
  const d = getCamera().distanceM
  setCamera({ distanceM: convertDistanceOnScaleFreeToggle(d, M, next) })
  setScaleFree(next)
})
```

When mass changes under **fixed-D**, do **not** rewrite distance (hole grows).  
When mass changes under **scale-free**, do **not** rewrite distance (stays d/M).

**Commit:** `feat(ui): scale-free distance checkbox`

---

### Task 6: Docs + skill hygiene

**Objective:** Document modes so this is not re-reported as a bug.

**Files:**
- Modify: `AGENTS.md` — Camera section: two modes
- Modify: `README.md` — one short bullet
- Patch skill `gr-black-hole-simulation` pitfalls: replace “Mass never enlarges hole” with “only in scale-free mode”

**Commit:** `docs: scale-free vs fixed-D camera modes`

---

### Task 7: Verification

**Run:**

```bash
bun test
bun run test:ref
bun run build
bun run dev
```

**Manual / browser vision checklist:**

1. Default: scale-free ON, mass 0.5→3 → image **unchanged** (angular)
2. Toggle OFF at M=1 → **no jump**
3. Fixed-D: mass 1→3 → hole **grows**, photon ring larger, stronger disk warp
4. Toggle ON again → convert distance, no jump; mass again invariant
5. Preset click leaves scale-free flag alone
6. Orbit/zoom still work both modes
7. BL integrator both modes OK
8. Debug probe still returns finite summary

---

## Files likely to change (summary)

| Path | Change |
|------|--------|
| `src/physics/observer.ts` (+ maybe `cameraDistance.ts`) | resolver + convert |
| `src/state/scaleFree.ts` | **new** store |
| `src/state/scene.ts` | snapshot field |
| `src/physics/geodesic/cpuRef.ts` | camD |
| `src/physics/geodesic/blCamera.ts` | camD |
| `src/debug/probe.ts` | camD |
| `src/render/geodesicTracer.ts` | uScaleFree |
| `src/render/geodesicTracerTypes.ts` | setter |
| `src/app/sceneBridge.ts` | wire + stats |
| `src/ui/controlsMarkup.ts` / `controls.ts` | checkbox |
| `tests/physics/cameraDistance.test.ts` | **new** |
| `tests/physics/scaleFree.test.ts` | **new** |
| `AGENTS.md` / README | docs |

**Not changed:** no-hair params, disk ISCO physics, emission, presets’ physics snapshots (except they keep working).

---

## Risks & tradeoffs

| Risk | Mitigation |
|------|------------|
| Toggle jumps image | Always convert `distanceM` with `convertDistanceOnScaleFreeToggle` |
| Slider limits: fixed-D at high M may put camera **inside** disk/horizon | Keep existing min distance clamp; optional later: min D ≥ few × r₊ in fixed mode |
| Dual meaning of `distanceM` confuses future code | Comment on field + only access D via `resolveCameraDistance` |
| TSL `select` bugs | Flat top-level expression; visual Fate check |
| Goldens / cpu-ref | Default `scaleFree: true` → goldens unchanged |
| Users think fixed-D is “more physical SI” | Copy: still geometric units, not SI metres |

**YAGNI:** No SI mass in kg, no Mpc distance, no second distance field — one slider, one bool.

---

## Open questions (defaults chosen if implementing without re-ask)

1. **Default:** scale-free **ON** (current science behavior).  
2. **Field storage:** keep `camera.distanceM`; meaning depends on mode + conversion on toggle.  
3. **Presets:** never touch scale-free.  
4. **Min distance in fixed-D:** keep slider min 8 (geom); do not auto-push outside horizon yet.

---

## Out of scope

- Changing mass units to solar masses / SI  
- Making disk outer radius absolute (non-M)  
- Film look / bloom changes with mass  
- Auto-reframe camera when mass changes in fixed mode  

---

## Success criteria

- [ ] Scale-free ON: mass does not change angular lensing (regression)  
- [ ] Scale-free OFF: mass **does** change angular size / lensing  
- [ ] Toggle continuous (no pop)  
- [ ] CPU ref / probe / GPU share one resolver  
- [ ] `bun test` + `test:ref` + `build` green  
- [ ] Docs explain both modes  
