# No-Hair Core Parameters Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Establish mass \(M\), dimensionless spin \(a_\star = Jc/(GM^2)\), and charge \(Q\) as the only classical black-hole “hair” that drive the simulation’s spacetime, with pure physics code, unit tests, UI sliders, and a phased path from Schwarzschild → Kerr → optional Kerr–Newman.

**Architecture:** Separate a pure TypeScript physics domain (geometric units \(G=c=1\)) from WebGPU rendering. Parameters live in one immutable/normalized `BlackHoleParams` object; every derived quantity (horizons, ergosphere, photon orbits, critical impact parameters) is computed from \(M,a,Q\) only. Rendering starts as Schwarzschild null geodesic ray marching, then upgrades the metric/geodesics to Kerr, with Kerr–Newman behind a feature flag (default \(Q=0\)).

**Tech Stack:** Vite, Bun, TypeScript, Three.js WebGPU + TSL, `bun test` for pure physics unit tests.

**Physics references (no-hair):** Stationary Einstein–Maxwell black holes are characterized by mass, angular momentum, and electric charge (Kerr–Newman family); special cases are Kerr (\(Q=0\)), Reissner–Nordström (\(J=0\)), Schwarzschild (\(J=Q=0\)).

---

## Current context / assumptions

- Project: `C:\Users\dante\Projects\black-hole` (standalone — **not** sparras.dev).
- Stack from `AGENTS.md`: Vite + Bun + Three.js WebGPU; blank scene only (`src/main.ts`, `src/style.css`).
- Geometric units: \(G = c = 1\). Schwarzschild horizon \(r_s = 2M\), photon sphere \(r_{ph} = 3M\), critical impact parameter \(b_c = 3\sqrt{3}\,M\).
- Preferences: TDD (`bun test`), pure-black voids for captured rays, prefer real physics over visual workarounds, no `any`, no `console.log`.
- No existing physics modules or tests under `tests/` yet.
- Scope of **this plan:** core no-hair parameters + derived geometry + UI + scaffolding for geodesic pipeline. Full photoreal disk/jets are later phases but designed for here.

### Parameter conventions (locked for the project)

| Symbol | Meaning | Geometric units | UI range (initial) |
|--------|---------|-----------------|--------------------|
| \(M\) | Mass | sets all length/time scales | \(0.1\) – \(10\) (default \(1\)) |
| \(a_\star\) | Dimensionless spin \(a_\star = J/M^2\) (with \(G=c=1\)) | \(0 \le \|a_\star\| \le 1\) | \(0\) – \(0.998\) (default \(0\)); sign later for retrograde |
| \(a\) | Kerr spin length \(a = a_\star M\) | \(|a| \le M\) | derived |
| \(Q\) | Charge | \(|Q| \le M\) for horizon (KN); with spin \(M^2 \ge a^2 + Q^2\) | \(0\) – \(0.5M\) optional, default \(0\) |

**Extremality / cosmic censorship clamp:** reject or clamp so \(M^2 \ge a^2 + Q^2\) (with \(a = a_\star M\)). Prefer soft clamp + HUD warning over silent NaNs.

**What is *not* black-hole hair (secondary UI later):** observer inclination \(i\), camera distance, disk temperature profile, accretion rate, magnetic field for jets, resolution/quality. Those are scene/observer parameters, not spacetime hair.

---

## Proposed approach

### Layered design

```
src/
  physics/           # pure TS, no Three.js — fully unit-tested
    types.ts         # BlackHoleParams, DerivedGeometry
    validate.ts      # clamp + extremality
    schwarzschild.ts # horizons, photon sphere, b_c
    kerr.ts          # r±, ergosphere, photon orbits (approx formulas)
    kn.ts            # Kerr–Newman extensions (optional phase)
    constants.ts     # geometric-unit helpers
  state/
    params.ts        # reactive store / getters for M, a★, Q
  ui/
    controls.ts      # sliders + labels for M, a★, Q
  render/            # WebGPU later phases
    geodesic/        # null geodesic integrators
    disk/            # accretion disk sampling
  main.ts            # boot, wire params → uniforms → loop
tests/
  physics/
    validate.test.ts
    schwarzschild.test.ts
    kerr.test.ts
    kn.test.ts
```

### Phased physics

1. **Domain + Schwarzschild analytics** — parameters, validation, derived radii, tests.
2. **UI** — three sliders (Q optional/collapsible), live derived readout in HUD.
3. **Schwarzschild ray marcher** — WebGPU null geodesics; pure-black capture; simple disk.
4. **Kerr upgrade** — replace metric + geodesic equations; spin slider becomes visually primary.
5. **Optional \(Q\)** — Kerr–Newman or RN; default off; exotic cases only.

### Rendering strategy (for later tasks, design now)

- Backward ray tracing from camera (standard GRRT approach).
- Integrate null geodesics numerically (adaptive RK or fixed-step with capture checks).
- Uniforms: `M`, `aStar`, `Q` (and camera pose). Derived constants recomputed on CPU when params change and uploaded.
- Capture: ray hits horizon / fails escape → pure black (no fake fill).
- Photon ring emerges from multi-orbit geodesics, not painted sprites.

### UI design (initial)

- Panel: Mass, Spin (\(a_\star\)), Charge (default collapsed / advanced).
- Live derived text: \(r_+\), \(r_-\), \(r_{\rm ergo}(\theta=\pi/2)\), \(r_{\rm ph}\) (pro/retro when Kerr), extremality ratio.
- Stats line: FPS · metric family · \(M,a_\star,Q\).

---

## Step-by-step plan

### Task 1: Physics types and constants

**Objective:** Define the no-hair parameter type and geometric-unit helpers.

**Files:**
- Create: `src/physics/constants.ts`
- Create: `src/physics/types.ts`

**Step 1: Write `constants.ts`**

```ts
/** Geometric units: G = c = 1 throughout the physics layer. */
export const G = 1 as const
export const C = 1 as const

/** Soft max spin for numerical stability (near-extremal Kerr). */
export const MAX_SPIN_STAR = 0.998

/** Default no-hair parameters (Schwarzschild of unit mass). */
export const DEFAULT_MASS = 1
export const DEFAULT_SPIN_STAR = 0
export const DEFAULT_CHARGE = 0
```

**Step 2: Write `types.ts`**

```ts
/**
 * Classical no-hair parameters for a stationary Einstein–Maxwell black hole.
 * In geometric units G = c = 1:
 *   - mass M
 *   - dimensionless spin a★ = J / M²  (Kerr parameter a = a★ * M)
 *   - charge Q
 */
export type BlackHoleParams = {
  readonly mass: number
  /** Dimensionless spin a★ ∈ [-MAX_SPIN_STAR, MAX_SPIN_STAR] after validation. */
  readonly spinStar: number
  readonly charge: number
}

export type MetricFamily = 'schwarzschild' | 'kerr' | 'kerr-newman' | 'reissner-nordstrom'

export type DerivedGeometry = {
  readonly mass: number
  readonly spinStar: number
  readonly spinLength: number // a = a★ M
  readonly charge: number
  readonly family: MetricFamily
  /** Outer / event horizon r₊ */
  readonly rPlus: number
  /** Inner / Cauchy horizon r₋ (0 when non-rotating uncharged) */
  readonly rMinus: number
  /** Equatorial ergosphere outer radius (Kerr/KN); equals r₊ when a=0 */
  readonly rErgoEquator: number
  /** Schwarzschild photon sphere 3M; Kerr uses separate pro/retro later */
  readonly rPhotonSphere: number
  /** Critical impact parameter (Schwarzschild: 3√3 M) */
  readonly criticalImpact: number
  /** true if M² ≥ a² + Q² */
  readonly hasHorizon: boolean
  /** M² - a² - Q² */
  readonly extremalityDelta: number
}

export function spinLength(params: Pick<BlackHoleParams, 'mass' | 'spinStar'>): number {
  return params.spinStar * params.mass
}
```

**Step 3: Commit**

```bash
git add src/physics/constants.ts src/physics/types.ts
git commit -m "feat(physics): add no-hair parameter types and geometric constants"
```

---

### Task 2: Validation and extremality clamp

**Objective:** Ensure parameters always describe a black hole with a horizon (or clearly flag naked singularity).

**Files:**
- Create: `src/physics/validate.ts`
- Create: `tests/physics/validate.test.ts`

**Step 1: Write failing tests**

```ts
import { describe, expect, test } from 'bun:test'
import { normalizeParams, isExtremalOk } from '../../src/physics/validate'
import { MAX_SPIN_STAR } from '../../src/physics/constants'

describe('normalizeParams', () => {
  test('defaults to Schwarzschild unit mass', () => {
    const p = normalizeParams({})
    expect(p.mass).toBe(1)
    expect(p.spinStar).toBe(0)
    expect(p.charge).toBe(0)
  })

  test('clamps spinStar to MAX_SPIN_STAR', () => {
    const p = normalizeParams({ mass: 1, spinStar: 2, charge: 0 })
    expect(p.spinStar).toBe(MAX_SPIN_STAR)
  })

  test('clamps charge so M² ≥ a² + Q²', () => {
    const p = normalizeParams({ mass: 1, spinStar: 0.9, charge: 0.8 })
    const a = p.spinStar * p.mass
    expect(p.mass * p.mass).toBeGreaterThanOrEqual(a * a + p.charge * p.charge - 1e-12)
  })

  test('rejects non-positive mass by clamping to epsilon', () => {
    const p = normalizeParams({ mass: 0, spinStar: 0, charge: 0 })
    expect(p.mass).toBeGreaterThan(0)
  })
})

describe('isExtremalOk', () => {
  test('Schwarzschild ok', () => {
    expect(isExtremalOk({ mass: 1, spinStar: 0, charge: 0 })).toBe(true)
  })
  test('naked singularity not ok', () => {
    expect(isExtremalOk({ mass: 1, spinStar: 1.1, charge: 0 })).toBe(false)
  })
})
```

**Step 2: Run tests — expect FAIL**

```bash
bun test tests/physics/validate.test.ts
```

**Step 3: Implement `validate.ts`**

```ts
import { DEFAULT_CHARGE, DEFAULT_MASS, DEFAULT_SPIN_STAR, MAX_SPIN_STAR } from './constants'
import type { BlackHoleParams } from './types'

const MASS_MIN = 1e-6

export type ParamsInput = Partial<BlackHoleParams>

export function isExtremalOk(p: BlackHoleParams): boolean {
  const a = p.spinStar * p.mass
  return p.mass * p.mass >= a * a + p.charge * p.charge
}

/**
 * Normalize user input into a safe BlackHoleParams.
 * - mass > 0
 * - |spinStar| ≤ MAX_SPIN_STAR
 * - charge reduced if needed so M² ≥ a² + Q²
 */
export function normalizeParams(input: ParamsInput): BlackHoleParams {
  let mass = Number.isFinite(input.mass) ? (input.mass as number) : DEFAULT_MASS
  mass = Math.max(MASS_MIN, mass)

  let spinStar = Number.isFinite(input.spinStar) ? (input.spinStar as number) : DEFAULT_SPIN_STAR
  spinStar = Math.min(MAX_SPIN_STAR, Math.max(-MAX_SPIN_STAR, spinStar))

  let charge = Number.isFinite(input.charge) ? (input.charge as number) : DEFAULT_CHARGE
  // Prefer reducing |Q| to preserve chosen spin (more visually important).
  const a = spinStar * mass
  const maxQ2 = Math.max(0, mass * mass - a * a)
  const maxQ = Math.sqrt(maxQ2)
  if (Math.abs(charge) > maxQ) {
    charge = Math.sign(charge || 1) * maxQ
  }

  return { mass, spinStar, charge }
}
```

**Step 4: Run tests — expect PASS**

```bash
bun test tests/physics/validate.test.ts
```

**Step 5: Commit**

```bash
git add src/physics/validate.ts tests/physics/validate.test.ts
git commit -m "feat(physics): validate and clamp no-hair parameters"
```

---

### Task 3: Schwarzschild derived geometry

**Objective:** Analytic radii and \(b_c\) for non-spinning uncharged case; base for all families.

**Files:**
- Create: `src/physics/schwarzschild.ts`
- Create: `tests/physics/schwarzschild.test.ts`

**Formulas (\(G=c=1\)):**
- Horizon: \(r_s = 2M\)
- Photon sphere: \(r_{ph} = 3M\)
- Critical impact: \(b_c = 3\sqrt{3}\, M\)

**Step 1: Failing tests**

```ts
import { describe, expect, test } from 'bun:test'
import { schwarzschildGeometry } from '../../src/physics/schwarzschild'

describe('schwarzschildGeometry', () => {
  test('unit mass', () => {
    const g = schwarzschildGeometry(1)
    expect(g.rPlus).toBeCloseTo(2, 12)
    expect(g.rMinus).toBe(0)
    expect(g.rPhotonSphere).toBeCloseTo(3, 12)
    expect(g.criticalImpact).toBeCloseTo(3 * Math.sqrt(3), 12)
    expect(g.family).toBe('schwarzschild')
  })

  test('scales with M', () => {
    const g = schwarzschildGeometry(2)
    expect(g.rPlus).toBeCloseTo(4, 12)
    expect(g.rPhotonSphere).toBeCloseTo(6, 12)
    expect(g.criticalImpact).toBeCloseTo(6 * Math.sqrt(3), 12)
  })
})
```

**Step 2: Implementation**

```ts
import type { DerivedGeometry } from './types'

export function schwarzschildGeometry(mass: number): DerivedGeometry {
  const M = mass
  return {
    mass: M,
    spinStar: 0,
    spinLength: 0,
    charge: 0,
    family: 'schwarzschild',
    rPlus: 2 * M,
    rMinus: 0,
    rErgoEquator: 2 * M,
    rPhotonSphere: 3 * M,
    criticalImpact: 3 * Math.sqrt(3) * M,
    hasHorizon: true,
    extremalityDelta: M * M,
  }
}
```

**Step 3: `bun test tests/physics/schwarzschild.test.ts` → PASS, then commit.**

---

### Task 4: Kerr derived geometry

**Objective:** Horizons, equatorial ergosphere, and basic photon-orbit radii for \(Q=0\).

**Files:**
- Create: `src/physics/kerr.ts`
- Create: `tests/physics/kerr.test.ts`

**Formulas (\(G=c=1\), \(a = a_\star M\)):**
- \(\Delta = r^2 - 2Mr + a^2\)
- Horizons: \(r_\pm = M \pm \sqrt{M^2 - a^2}\)
- Ergosphere (static limit): \(r_{\rm ergo}(\theta) = M + \sqrt{M^2 - a^2\cos^2\theta}\); equator \(\theta=\pi/2\): \(r_{\rm ergo} = M + \sqrt{M^2} = 2M\) wait — actually at equator \(\cos\theta=0\): \(r_{\rm ergo} = M + M = 2M\). (Outer ergo at equator is \(2M\); poles collapse to \(r_+\).)
- Equatorial circular photon orbits (Bardeen et al.):  
  \(r_{\rm ph}^{\pm} = 2M \left\{1 + \cos\left[\tfrac{2}{3}\arccos(\mp a_\star)\right]\right\}\)  
  (prograde −, retrograde + in the common convention).

**Step 1: Tests**

```ts
import { describe, expect, test } from 'bun:test'
import { kerrGeometry, photonSphereRadii } from '../../src/physics/kerr'
import { normalizeParams } from '../../src/physics/validate'

describe('kerrGeometry', () => {
  test('a★=0 reduces to Schwarzschild', () => {
    const p = normalizeParams({ mass: 1, spinStar: 0, charge: 0 })
    const g = kerrGeometry(p)
    expect(g.rPlus).toBeCloseTo(2, 10)
    expect(g.rMinus).toBeCloseTo(0, 10)
    expect(g.family).toBe('schwarzschild') // or 'kerr' with a=0 — pick one and stick to it
  })

  test('near-extremal a★=0.998 has r+ ≈ M', () => {
    const p = normalizeParams({ mass: 1, spinStar: 0.998, charge: 0 })
    const g = kerrGeometry(p)
    expect(g.rPlus).toBeGreaterThan(1)
    expect(g.rPlus).toBeLessThan(1.1)
    expect(g.rMinus).toBeLessThan(g.rPlus)
    expect(g.hasHorizon).toBe(true)
  })

  test('prograde photon orbit decreases with spin', () => {
    const slow = photonSphereRadii(1, 0)
    const fast = photonSphereRadii(1, 0.9)
    expect(fast.prograde).toBeLessThan(slow.prograde)
    expect(fast.retrograde).toBeGreaterThan(slow.retrograde)
  })
})
```

**Step 2: Implementation sketch**

```ts
import type { BlackHoleParams, DerivedGeometry, MetricFamily } from './types'
import { spinLength } from './types'

export function photonSphereRadii(mass: number, spinStar: number): { prograde: number; retrograde: number } {
  // r_ph^± / M = 2 ( 1 + cos( (2/3) arccos(∓ a★) ) )
  const M = mass
  const aStar = Math.min(1, Math.max(-1, spinStar))
  const prograde = 2 * M * (1 + Math.cos((2 / 3) * Math.acos(-aStar)))
  const retrograde = 2 * M * (1 + Math.cos((2 / 3) * Math.acos(+aStar)))
  return { prograde, retrograde }
}

export function kerrGeometry(params: BlackHoleParams): DerivedGeometry {
  const M = params.mass
  const a = spinLength(params)
  const a2 = a * a
  const disc = M * M - a2
  const hasHorizon = disc >= 0
  const sqrtDisc = hasHorizon ? Math.sqrt(Math.max(0, disc)) : 0
  const rPlus = hasHorizon ? M + sqrtDisc : NaN
  const rMinus = hasHorizon ? M - sqrtDisc : NaN
  const { prograde } = photonSphereRadii(M, params.spinStar)

  let family: MetricFamily = 'kerr'
  if (Math.abs(params.spinStar) < 1e-12 && Math.abs(params.charge) < 1e-12) {
    family = 'schwarzschild'
  }

  // Equatorial outer ergosphere: M + sqrt(M² - a² cos²θ) at θ=π/2 → 2M
  const rErgoEquator = 2 * M

  return {
    mass: M,
    spinStar: params.spinStar,
    spinLength: a,
    charge: 0,
    family,
    rPlus: rPlus,
    rMinus: rMinus,
    rErgoEquator,
    rPhotonSphere: prograde, // primary display; expose both in UI later
    criticalImpact: 3 * Math.sqrt(3) * M, // Schwarzschild placeholder until Kerr b_c implemented
    hasHorizon,
    extremalityDelta: disc,
  }
}
```

**Note for implementer:** Kerr critical impact parameters \(b_{c\pm}\) differ for pro/retro; leave accurate \(b_c\) as Task 4b or Kerr ray-tracer task. Do not fake \(b_c\) for spin.

**Step 3: Pass tests, commit.**

---

### Task 5: Unified `deriveGeometry` + optional Kerr–Newman

**Objective:** Single entry point: choose family from \(a_\star,Q\); implement RN/KN horizons when \(Q \neq 0\).

**Files:**
- Create: `src/physics/kn.ts`
- Create: `src/physics/derive.ts`
- Create: `tests/physics/kn.test.ts`
- Create: `tests/physics/derive.test.ts`

**KN horizons:** \(r_\pm = M \pm \sqrt{M^2 - a^2 - Q^2}\)

**RN (\(a=0\)):** \(r_\pm = M \pm \sqrt{M^2 - Q^2}\)

**Step 1: Tests for RN and routing**

```ts
// kn: unit mass Q=0.5 → r+ = 1 + sqrt(0.75)
// derive: spin=0,Q=0 → schwarzschild; spin≠0,Q=0 → kerr; Q≠0 → kn/rn
```

**Step 2: Implement `deriveGeometry(params: BlackHoleParams): DerivedGeometry`**

```ts
export function deriveGeometry(params: BlackHoleParams): DerivedGeometry {
  const a = Math.abs(params.spinStar)
  const q = Math.abs(params.charge)
  if (q < 1e-12 && a < 1e-12) return schwarzschildGeometry(params.mass)
  if (q < 1e-12) return kerrGeometry(params)
  return knGeometry(params)
}
```

**Step 3: Pass + commit** `feat(physics): unified deriveGeometry with Kerr–Newman horizons`

---

### Task 6: Barrel export + state store

**Objective:** Single import surface for physics; simple mutable params state for UI/render.

**Files:**
- Create: `src/physics/index.ts`
- Create: `src/state/params.ts`
- Create: `tests/physics/index-smoke.test.ts` (optional)

```ts
// src/physics/index.ts
export * from './constants'
export * from './types'
export * from './validate'
export * from './schwarzschild'
export * from './kerr'
export * from './kn'
export * from './derive'
```

```ts
// src/state/params.ts
import { normalizeParams, type ParamsInput } from '../physics/validate'
import { deriveGeometry } from '../physics/derive'
import type { BlackHoleParams, DerivedGeometry } from '../physics/types'

type Listener = (params: BlackHoleParams, derived: DerivedGeometry) => void

let params: BlackHoleParams = normalizeParams({})
let derived: DerivedGeometry = deriveGeometry(params)
const listeners = new Set<Listener>()

export function getParams(): BlackHoleParams {
  return params
}

export function getDerived(): DerivedGeometry {
  return derived
}

export function setParams(input: ParamsInput): BlackHoleParams {
  params = normalizeParams({ ...params, ...input })
  derived = deriveGeometry(params)
  for (const l of listeners) l(params, derived)
  return params
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  listener(params, derived)
  return () => listeners.delete(listener)
}
```

**Commit:** `feat(state): params store driven by no-hair normalize + derive`

---

### Task 7: UI sliders for M, a★, Q

**Objective:** Controllable core parameters in the HUD with live derived readout.

**Files:**
- Modify: `index.html` (add `#controls` container)
- Modify: `src/style.css` (control styles; enable pointer-events on controls)
- Create: `src/ui/controls.ts`
- Modify: `src/main.ts` (mount controls, update stats)

**HTML addition inside `#hud`:**

```html
<div id="controls" class="controls"></div>
<dl id="derived" class="derived"></dl>
```

**`controls.ts` sketch:**

```ts
import { getParams, setParams, subscribe } from '../state/params'
import { MAX_SPIN_STAR } from '../physics/constants'

export function mountControls(root: HTMLElement): void {
  root.innerHTML = `
    <label>Mass M <input type="range" id="p-mass" min="0.1" max="10" step="0.01" /><span data-val="mass"></span></label>
    <label>Spin a★ <input type="range" id="p-spin" min="0" max="${MAX_SPIN_STAR}" step="0.001" /><span data-val="spin"></span></label>
    <label class="advanced">Charge Q <input type="range" id="p-charge" min="0" max="0.9" step="0.01" /><span data-val="charge"></span></label>
  `
  // wire input → setParams; subscribe → update labels + derived dl
  // pointer-events: auto on .controls (parent #hud is none)
}
```

**CSS:** `#hud .controls { pointer-events: auto; }` and vertical slider layout.

**Acceptance:**
- Dragging Mass scales derived \(r_+\) linearly.
- Spin > 0 shows family `kerr`, \(r_+ < 2M\).
- Charge default 0; raising Q with high spin auto-clamps without NaN.

**Commit:** `feat(ui): mass, spin, charge sliders bound to no-hair state`

---

### Task 8: Wire HUD stats + metric family display

**Objective:** Replace “blank scene” stats with live physics summary.

**Files:**
- Modify: `src/main.ts`
- Modify: `index.html` (hint text)

Stats format example:  
`60 fps · kerr · M=1 a★=0.72 Q=0 · r₊=1.69`

**Commit:** `feat(ui): live metric family and horizon readout`

---

### Task 9: Document physics contract in AGENTS.md / README

**Objective:** Lock conventions for future agents and for you.

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md`

Add sections:
- No-hair parameters and ranges
- Geometric units
- File layout `src/physics/`
- Extremality policy (clamp Q first, then spin to MAX_SPIN_STAR)
- Secondary vs primary params

**Commit:** `docs: no-hair parameters and physics layout`

---

### Task 10: (Scaffold only) GPU uniform bridge

**Objective:** Prepare the path from params → shader without implementing full geodesics yet.

**Files:**
- Create: `src/render/uniforms.ts`

```ts
import type { BlackHoleParams, DerivedGeometry } from '../physics/types'

/** CPU-side snapshot uploaded each param change (or every frame if cheap). */
export type SpacetimeUniforms = {
  mass: number
  spinStar: number
  spinLength: number
  charge: number
  rPlus: number
  rMinus: number
}

export function toUniforms(p: BlackHoleParams, d: DerivedGeometry): SpacetimeUniforms {
  return {
    mass: p.mass,
    spinStar: p.spinStar,
    spinLength: d.spinLength,
    charge: p.charge,
    rPlus: d.rPlus,
    rMinus: d.rMinus,
  }
}
```

**Tests:** simple equality test.

**Commit:** `feat(render): spacetime uniform snapshot from no-hair params`

---

## Later phases (out of scope for first implementation pass — plan only)

Do **not** implement these in the first execution of this plan unless the user asks; keep interfaces ready.

### Phase B — Schwarzschild GR ray tracer
1. Null geodesic ODE in Schwarzschild (equatorial or 3D).
2. Adaptive/fixed step integrator in WebGPU compute or TSL raymarch.
3. Capture at \(r \le r_+\) → pure black.
4. Thin equatorial disk: emissivity \(\propto r^{-n}\), gravitational redshift.
5. Multi-orbit contribution for photon ring (real orbits, not painted rings).

### Phase C — Kerr
1. Boyer–Lindquist Kerr metric / conserved E, Lz, Carter Q.
2. Frame-dragging, asymmetric shadow, pro/retro photon rings.
3. Spin slider becomes the main visual lever (user request: biggest upgrade).
4. Optional: ergosphere tint in “science mode” only (never fake lighting).

### Phase D — Charge (optional exotic)
1. Enable Q slider prominently only when advanced mode on.
2. Kerr–Newman geodesics or RN first if spin=0.
3. Document that astrophysical \(Q \approx 0\).

### Phase E — Scene secondary controls
- Inclination \(i\), distance D, FOV
- Disk thickness, temperature, jets (not hair)

---

## Files likely to change (summary)

| Path | Action |
|------|--------|
| `src/physics/constants.ts` | Create |
| `src/physics/types.ts` | Create |
| `src/physics/validate.ts` | Create |
| `src/physics/schwarzschild.ts` | Create |
| `src/physics/kerr.ts` | Create |
| `src/physics/kn.ts` | Create |
| `src/physics/derive.ts` | Create |
| `src/physics/index.ts` | Create |
| `src/state/params.ts` | Create |
| `src/ui/controls.ts` | Create |
| `src/render/uniforms.ts` | Create |
| `src/main.ts` | Modify |
| `src/style.css` | Modify |
| `index.html` | Modify |
| `AGENTS.md` | Modify |
| `README.md` | Modify |
| `tests/physics/*.test.ts` | Create |

---

## Tests / validation

| Command | Purpose |
|---------|---------|
| `bun test tests/physics` | All pure physics unit tests |
| `bun run build` | Typecheck + production build |
| `bun run dev` | Manual: sliders update HUD, no NaN, family switches |

**Manual checklist:**
1. M slider: \(r_+ = 2M\) when \(a=Q=0\).
2. a★ from 0 → 0.998: \(r_+\) decreases toward \(M\); family becomes `kerr`.
3. Q with a★=0: RN horizons; family `reissner-nordstrom` or `kerr-newman`.
4. High a★ + high Q: clamp keeps \(M^2 \ge a^2+Q^2\).
5. No `console.log`; types clean under `tsc --noEmit`.

---

## Risks, tradeoffs, and open questions

| Risk / choice | Mitigation |
|---------------|------------|
| Near-extremal Kerr numerics blow up | Cap \(a_\star \le 0.998\); careful \(\Delta\) handling near horizon |
| Kerr \(b_c\) more complex than Schwarzschild | Defer accurate critical impact to Kerr ray-tracer phase; don’t fake |
| Sign of spin (prograde vs camera) | Start with \(a_\star \ge 0\); add retrograde later |
| Charge rarely physical | Default 0; UI under “Advanced” |
| Mass scale vs camera distance | Document that changing \(M\) rescales spacetime; either fix camera in units of \(M\) or scale camera with \(M\) — **recommend camera in units of \(M\)** so mass mainly affects absolute scale labels, not framing |
| WebGPU vs CPU for first geodesic | Prefer WebGPU for “best sim” goal; CPU reference integrator in tests for cross-check |
| Dual BH / binary later | Keep `BlackHoleParams` single-hole; array of holes is a future superpose |

### Open questions for user (do not block Tasks 1–9)

1. **Camera scaling:** Should the view distance be fixed in units of \(M\) (recommended) so the hole always fills similar FOV when \(M\) changes?
2. **Charge UI:** Hidden advanced toggle vs always-visible slider defaulting to 0?
3. **Spin sign:** Only prograde \(0..0.998\) first, or bidirectional from day one?
4. **First visual target:** Schwarzschild disk before Kerr, or jump to Kerr as soon as geodesics exist?

**Plan default if unanswered:** fixed camera in units of \(M\); Q advanced/collapsed; spin \(0..0.998\); Schwarzschild geodesic + disk before Kerr.

---

## Principles for implementers

- **TDD** for every pure physics function.
- **DRY:** one `normalizeParams` / one `deriveGeometry`.
- **YAGNI:** no jets, no binary, no magnetic hair until core M/a/Q path works.
- **Physics first:** photon ring and shadow from geodesics, not post-process fakes.
- **Pure black** for captured rays.
- **Delete dead code** — no deprecation stubs.
- Commit after each task.

---

## Execution handoff

After Tasks 1–10, the project has:
- Correct no-hair domain model
- Tested analytic geometry for Schwarzschild / Kerr / KN
- Live UI controls for M, a★, Q
- Uniform bridge ready for WebGPU geodesics

Next plan (separate): Schwarzschild null geodesic ray tracer + thin disk.
