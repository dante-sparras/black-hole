# Full Boyer–Lindquist Kerr Null Geodesics

> **For Hermes:** Implement task-by-task with TDD. Keep real-time Cartesian path as default until BL is validated.

**Goal:** Add a pure-physics Kerr (then KN) null geodesic integrator in Boyer–Lindquist coordinates with conserved \(E, L_z\), Carter \(Q\), validated against analytic critical curves — without breaking the existing real-time GPU path.

**Architecture:** New `src/physics/geodesic/kerrBl.ts` (+ optional `blInit.ts` for camera tetrad). CPU-first; GPU BL is a later phase. Real-time `knNullAccel` remains default for live render until BL matches topology + critical curve.

**Tech stack:** Bun · pure TS · `bun test` · geometric units \(G=c=1\)

---

## Phases

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **1** | Equatorial + 3D BL null tracer (Mino time), Schw/Kerr critical-curve tests | ✅ |
| **2** | Observer tetrad → \((E,L_z,Q)\) from camera ray (matches OBSERVER_DEFAULTS) | ✅ |
| **3** | Disk plane hits + orbiting \(g\) on BL path; optional `cpuRef` mode `bl` | ✅ |
| **4** | GPU BL or hybrid; stats tag `kerr-BL`; keep RT as fallback | next |
| Side | Exact KN photon/ISCO where closed form exists; film grade; pro/retro disk UI | parallel polish |

---

## Phase 1 — Implementation plan

### Conventions

- Kerr length \(a = a_\\star M\), spin axis +Y in Cartesian; BL polar \(\theta=0\) along **+Y** (same as camera).
- Null: \(\mu=0\). Normalize \(E=1\) for rays from infinity.
- Capture: \(r \le 1.02\, r_+\). Escape: \(r \ge r_{\rm esc}\) outbound.
- **Do not** wire GPU yet.

### Task 1: Metric scalars + effective potentials

**Files:** Create `src/physics/geodesic/kerrBl.ts`, `tests/physics/kerrBl.test.ts`

```ts
// Δ = r² − 2Mr + a²
// Σ = r² + a² cos²θ
// R(r), Θ(θ) for null geodesics (E=1)
```

Tests: Schw \(a=0\): \(\Delta=(r-2M)r\); \(R(b)\) zeros near critical impact.

### Task 2: Conserved quantities from asymptotic impact parameters

For a ray at large \(r\) with impact \(b = L_z/E\) and Carter \(q = Q/E^2\):

Equatorial critical: \(Q=0\), \(b = b_c^\pm\).

```ts
export function impactToConserved(b: number, q: number, E = 1): { E, Lz, Q }
```

### Task 3: Mino-time RK4 step + `traceKerrBlNull`

Integrate \(r(\lambda), \theta(\lambda), \phi(\lambda)\) with sign flips at turning points.

Options: mass, spinLength, originBl or impact params, maxSteps, …

Fate: `captured` | `escaped` | `max_steps`.

### Task 4: Critical-curve validation (blocking quality bar)

- Schw: transition within **5%** of \(3\sqrt{3}M\) (BL exact → tighter than RT 20%).
- Kerr \(a_\\star=0.9\): prograde capture boundary near `criticalImpacts().prograde`.
- Head-on / high-\(b\) sanity.

### Task 5: Export + docs

- Export from `physics/index.ts`
- Note in `AGENTS.md` / skill: BL CPU available; image still RT until Phase 4
- Commit

### Verification

```bash
bun test tests/physics/kerrBl.test.ts
bun test tests
bun run build
```

### Risks

| Risk | Mitigation |
|------|------------|
| Turning-point sign errors | Explicit root check; Schw tests first |
| \(\theta\) singularity on axis | Floor \(\sin\theta\); avoid exact pole |
| Near-horizon stiffness | Adaptive \(d\lambda\); capture margin |
| Claiming “full Kerr” in UI | Keep stats `kerr-RT` until GPU BL ships |

---

## Out of scope for Phase 1

- GPU TSL BL
- Charge (KN BL) — stub hooks OK
- Replacing live tracer
- Film grade / disk orbit direction UI
