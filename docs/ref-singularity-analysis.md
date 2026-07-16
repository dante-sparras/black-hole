# Reference: MisterPrada / singularity

Temporary clone: `/tmp/ref-singularity` (do not ship in product).  
Repo: https://github.com/MisterPrada/singularity

## What it is (and is not)

| | singularity | our black-hole |
|--|-------------|----------------|
| **Engine** | Three.js WebGPU + TSL | Same stack ✓ |
| **Rays** | Cheap **volume raymarch** in a unit sphere | **Null geodesics** (Kerr/RN/KN) |
| **Gravity** | Fake steer \(\propto 1/r^2\) toward center | Real metric integration |
| **Disk color** | **Art color ramp** (gold→brown→black) | **Blackbody + \(g\)** (physical) |
| **Disk shape** | Thin **Z-band** + 2D noise texture | Volume dens (analytic + GRMHD cube) |
| **Look** | Film / demo | Realism-first |

His disk looks great because it is a **highly tuned VFX volume**, not because it solves GR better.

## Why the disk looks “goddamn good”

Core path: `src/Experience/Worlds/MainWorld/BlackHole.js` (~lines 110–237).

### 1. Thin band + deep noise texture (structure)
- Disk is a **very thin slab** (`width ≈ 0.03` in unit-sphere space).
- Samples `noise_deep.png` (1024² RGB) on **rotating UVs**:
  - `rotPhase = xyLen * 4.27 − time * 0.1` → spiral wind.
- **Dual sample** at UV and UV×1.002 → pseudo-normal / edge energy:
  - `rampInput += (noiseAmp − noiseNormal) * 19.75`  
  → sharp filaments from noise **gradients**, not flat noise.

### 2. Hand-painted color ramp + emission
- `ColorRamp3_BSpline`: warm sand `(0.95,0.71,0.44)` → dark red-brown → black.
- `emissive = ramp * 2.0 + warm bias`.
- Not physical \(T(r)\), but **intentional film palette** with high contrast.

### 3. Front-to-back alpha compositing
- Accumulates color/alpha with `mix` weights (classic volume render).
- Core `r < originRadius` forced to **black**.
- Remaining transparency samples **4K EXR starmap**.

### 4. Ray start jitter
- `whiteNoise2D` offsets ray origin along dir → **kills banding** (onion rings).

### 5. Soft bloom (always on)
- Bloom strength **~0.22**, radius **0**, threshold **0** (State.js).
- Emissive MRT + additive bloom → glow without harsh HDR white walls (because alpha already capped).

### 6. High-quality environment
- `starmap_2020_4k.exr` equirect background.

## What we should **not** copy

- Fake \(1/r^2\) ray bend as gravity (we already do better).
- Art ramp as **primary** color (breaks realism / AGENTS.md).
- Ignoring Doppler / Page–Thorne / multi-image physics.

## What we **should** steal (adapted)

| Technique | Why it works | Our adaptation |
|-----------|--------------|----------------|
| **Step / origin jitter** | Removes volume banding | Hash(ndc) × base step on ray start |
| **Dual dens sample** | Structure from gradients | Offset cube/analytic dens → contrast |
| **Thin photosphere** | No milk-glass stack | Already improving high-ṁ path |
| **Soft bloom defaults** | Film glow, readable hole | ON: strength~0.22, thresh mid |
| **Spiral UV phase** | Readable arms | We have Kepler shear; boost contrast |
| **EQ starmap quality** | Believable backdrop | Optional later (asset + license) |

## Implementation note

Inspiration is **technique**, not art direction as truth. Keep blackbody + \(I\propto g^3\); use singularity-style **compositing polish**.
