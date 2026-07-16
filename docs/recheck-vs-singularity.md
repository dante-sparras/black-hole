# Recheck: our disk vs MisterPrada/singularity (post film-grade push)

## Verdict

**Film grade + more emission is the wrong lever.**  
It made us **more painted**, not more natural. His look wins on **structure + alpha compositing**, not on “oranger / brighter.”

His “natural” is still VFX — but the *right kind*: soft edges, noise-driven opacity, no HDR mush.

---

## Side-by-side (what actually differs)

| | **singularity** | **ours (after film push)** | Who wins “natural”? |
|--|-----------------|----------------------------|---------------------|
| **Compositing** | Front-to-back **alpha** `mix(color, shaded, weight)` | HDR **add** emission × transm → tonemap | **Him** — alpha looks like a surface |
| **What noise does** | Drives **color ramp + alpha** (same field) | Multiplies **dens only**; color is separate BB/film | **Him** — one coherent material |
| **Vertical shape** | Tiny Z-band + `smoothRange` alpha | densZ³ + Beer + pathKill (still volume-ish) | **Him** — reads as a sheet |
| **Radial edge** | `smoothRange(xyLen, 1→0)` soft falloff | ISCO/outer power edges + volume | **Him** — cleaner rim |
| **Gradient structure** | `(noise − noise@1.002) × 19.75` into **ramp** | Edge into dens, then washed by τ | **Him** — filaments in color |
| **Color** | One ramp, one emission | BB + g³ + film 0.88 + ×2 emission | **Neither “true”**; ours now **too painted** |
| **Gravity / lensing** | Fake \(1/r^2\) | Real Kerr null geodesics | **Us** (physics) |
| **HDR / grade** | Alpha-capped + soft bloom | Soft-knee + Reinhard + ACES + film | **Him** — less crush/foam |

---

## Why his still looks more real

### 1. Alpha surface, not glowing fog
Every sample has **local alpha** shaped by band + noise. Accumulation is  
`color = mix(color, sample, (1−α)·α_local)`.  
That is how real volume *surfaces* look.

We **add energy** along the ray. Even with Beer, it reads as **lamp fog**, then we crush it with tonemap → plastic / milky / banded.

### 2. Noise is the *material*, not a multiplier
His ramp input:

```text
xyLen + (noise−0.78)×1.5 + (noise−noiseOffset)×19.75
```

Color **is** the noise field. Filaments are bright/dark by construction.

We sample noise → dens → weight → then invent color from \(T(r)\) or film.  
Structure and color **fight** each other.

### 3. Thin band with soft alpha, not thick dens hacks
`width = 0.03` + quadratic Z falloff + noise-modulated alpha.  
We thinned H/R and densZ³, but still volume-RT through a slab with multi-source dens (analytic + cube + noise + pathKill). **Too many cooks → mush.**

### 4. Film grade made it worse
Pushing `filmGrade → 0.88` and `emission × 2` copied his **palette**, not his **pipeline**.  
Result: gold-brown plastic on a foggy GR disk — less natural than either pure physics or pure VFX done well.

---

## What is *not* the gap

- Not “need more bloom”
- Not “need more emission”
- Not “need warmer ramp”
- Not “his gravity is better” (it isn’t)

---

## Right path (priority)

| Pri | Do this | Why |
|-----|---------|-----|
| **1** | **Dial back film grade / emission** (≤0.2 / 1.0) | Stop looking painted |
| **2** | **Alpha-style photosphere** — noise shapes **opacity and I** together; fewer HDR samples | Surface, not fog |
| **3** | **Noise-driven structure into intensity** (like rampInput), keep blackbody as soft tint | Coherent material |
| **4** | **One dens field** (noise-led or cube-led), drop multi-layer mush | Cleaner |
| **5** | Soft radial α falloff at outer rim | His rim |
| **6** | Keep geodesics / g³ / PT | Our real strength |

---

## Honest bottom line

| Goal | Who’s closer |
|------|----------------|
| **“Looks natural / organic disk”** | singularity (structure + α) |
| **“Correct GR + thin-disk physics”** | us |
| **“Film grade copy of his colors”** | us after push — and **wrong** |

His looks more real because the **eye sees continuous soft structure**, not because the spectrum is physical.  
We will look more real when the **disk is a thin, noise-coherent surface under geodesic light**, not when we paint it gold.

*Film grade / emission push should be reversed; next work is alpha + noise-as-material.*
