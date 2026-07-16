/**
 * Accretion-disk surface structure (not black-hole hair).
 * Flattened gas/plasma/dust: log spirals + flow-aligned filaments +
 * multi-scale turbulence. Keplerian shear must be *visibly* rotating.
 *
 * Continuity: never sample noise/ripples with raw φ (atan2 branch cut ±π
 * creates a visible radial seam). Use (cos φ, sin φ) or Cartesian (x,z).
 */

/** Hash → [0, 1) */
export function hash2(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return n - Math.floor(n)
}

/** Value-noise in 2D with bilinear interp. */
export function valueNoise2(x: number, y: number, scale = 1): number {
  const xs = x * scale
  const ys = y * scale
  const x0 = Math.floor(xs)
  const y0 = Math.floor(ys)
  const fx = xs - x0
  const fy = ys - y0
  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)
  const a = hash2(x0, y0)
  const b = hash2(x0 + 1, y0)
  const c = hash2(x0, y0 + 1)
  const d = hash2(x0 + 1, y0 + 1)
  const ab = a * (1 - ux) + b * ux
  const cd = c * (1 - ux) + d * ux
  return ab * (1 - uy) + cd * uy
}

/** 3D hash for seamless polar embedding. */
export function hash3(x: number, y: number, z: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453
  return n - Math.floor(n)
}

/** Value noise in 3D (for seamless (cx,sz,lnR) domain). */
export function valueNoise3(x: number, y: number, z: number, scale = 1): number {
  const xs = x * scale
  const ys = y * scale
  const zs = z * scale
  const x0 = Math.floor(xs)
  const y0 = Math.floor(ys)
  const z0 = Math.floor(zs)
  const fx = xs - x0
  const fy = ys - y0
  const fz = zs - z0
  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)
  const uz = fz * fz * (3 - 2 * fz)

  let sum = 0
  for (let i = 0; i <= 1; i++) {
    for (let j = 0; j <= 1; j++) {
      for (let k = 0; k <= 1; k++) {
        const h = hash3(x0 + i, y0 + j, z0 + k)
        const wx = i === 0 ? 1 - ux : ux
        const wy = j === 0 ? 1 - uy : uy
        const wz = k === 0 ? 1 - uz : uz
        sum += h * wx * wy * wz
      }
    }
  }
  return sum
}

/** fBm in seamless polar embedding. */
export function turbulenceSeamless(
  cx: number,
  sz: number,
  lnR: number,
  octaves = 4,
): number {
  let amp = 0.5
  let sum = 0
  let norm = 0
  let s = 1
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise3(cx, sz, lnR * 0.35, s)
    norm += amp
    amp *= 0.5
    s *= 2.1
  }
  return sum / Math.max(norm, 1e-8)
}

/** Legacy 2D turbulence (Cartesian only — already seamless). */
export function turbulence2(x: number, y: number): number {
  let amp = 0.5
  let sum = 0
  let norm = 0
  let s = 1
  for (let i = 0; i < 3; i++) {
    sum += amp * valueNoise2(x, y, s)
    norm += amp
    amp *= 0.5
    s *= 2.1
  }
  return sum / Math.max(norm, 1e-8)
}

/**
 * Shared defaults — GPU should stay visually close.
 *
 * shearRate is a *UI* knob; actual phase uses shearRate × shearGain × Ω_K × t
 * so motion is visible on human timescales (Ω_K alone is ~0.03 at 10M).
 */
export const DISK_TEXTURE = {
  arms: 2,
  /** Log-spiral pitch (tighter = more wound) */
  pitch: 0.72,
  /** Arm vs inter-arm contrast (gas filaments) */
  armContrast: 0.82,
  /** Multi-scale plasma / eddy contrast */
  turbContrast: 0.72,
  /** Outer dusty lanes */
  dustContrast: 0.48,
  phase0: 0.35,
  /**
   * UI shear multiplier (default ~1). Combined with shearGain for visible wind.
   * At r≈10M, Ω≈0.032; gain×rate×Ω ≈ 0.5 rad/s → noticeable in ~1s.
   */
  shearRate: 1.0,
  /**
   * Visual gain so Keplerian advection is visible (physics Ω is tiny in UI seconds).
   * Not a free “film” knob — keeps real Ω∝r^{-3/2} differential, just time-scaled.
   */
  shearGain: 14,
  texMin: 0.18,
  texMax: 2.35,
  /** Mild T jitter from clumping */
  tempJitterAmp: 0.18,
  /** H/R scale-height used for path-length thickness (edge-on look) */
  scaleHeight: 0.07,
  /** Fine flow-aligned filament strength (reference streamlines) */
  streamContrast: 0.55,
  /** Secondary m=8 streamline harmonic weight */
  streamHarmonic: 0.45,
} as const

export type DiskTextureOptions = {
  arms?: number
  pitch?: number
  armContrast?: number
  turbContrast?: number
  dustContrast?: number
  phase?: number
  /** Seconds; differential rotation phase Ω(r)·t */
  time?: number
  /** true = co-rotating pattern sense */
  prograde?: boolean
  mass?: number
  /** Shear animation rate multiplier */
  shearRate?: number
  streamContrast?: number
}

/**
 * Surface brightness modulation. Seamless in azimuth.
 *
 * Spiral uses cos(m·φ − …) with integer m → continuous at φ=±π.
 * Material is advected by rotating (cos φ, sin φ) with Keplerian phase.
 * Fine streamlines (m=8) give flow-aligned filaments like GRRT reference stills.
 */
export function diskTextureFactor(
  hx: number,
  hz: number,
  mass: number,
  opts: DiskTextureOptions = {},
): number {
  const T = DISK_TEXTURE
  const arms = Math.max(1, Math.round(opts.arms ?? T.arms))
  const pitch = opts.pitch ?? T.pitch
  const armContrast = opts.armContrast ?? T.armContrast
  const turbContrast = opts.turbContrast ?? T.turbContrast
  const dustContrast = opts.dustContrast ?? T.dustContrast
  const phase0 = opts.phase ?? T.phase0
  const time = opts.time ?? 0
  const prograde = opts.prograde ?? true
  const shearRate = opts.shearRate ?? T.shearRate
  const streamContrast = opts.streamContrast ?? T.streamContrast

  const M = Math.max(mass, 1e-8)
  const rho = Math.hypot(hx, hz)
  if (rho < 1e-8) return 1

  const invR = 1 / rho
  const cphi = hx * invR
  const sphi = hz * invR
  const lnR = Math.log(Math.max(rho / M, 1e-4))

  // Visible Keplerian shear: gain × rate × Ω_K × t  (Ω ∝ r^{-3/2})
  const OmegaK = Math.sqrt(M) / Math.pow(Math.max(rho, 1e-6), 1.5)
  const sense = prograde ? 1 : -1
  const shear = sense * shearRate * T.shearGain * OmegaK * time

  // Advect material frame: rotate (c,s) by shear (differential with r)
  const csh = Math.cos(shear)
  const ssh = Math.sin(shear)
  const cx = cphi * csh - sphi * ssh
  const sx = cphi * ssh + sphi * csh

  // cos(m·φ_adv) via (cx+i sx)^m
  let cm = cx
  let sm = sx
  for (let k = 1; k < arms; k++) {
    const nc = cm * cx - sm * sx
    const ns = cm * sx + sm * cx
    cm = nc
    sm = ns
  }
  const alpha = -arms * pitch * lnR + phase0
  const ca = Math.cos(alpha)
  const sa = Math.sin(alpha)
  const armWave = 0.5 + 0.5 * (cm * ca + sm * sa)
  const armsBright = Math.pow(Math.max(armWave, 1e-4), 1.55)

  // m=2 / m=4 / m=8 streamlines (flow-aligned filaments)
  const c2 = cx * cx - sx * sx
  const s2 = 2 * cx * sx
  const c4 = c2 * c2 - s2 * s2
  const s4 = 2 * c2 * s2
  const c8 = c4 * c4 - s4 * s4
  const s8 = 2 * c4 * s4
  const a2 = -2 * 0.22 * lnR + phase0 * 0.7
  const a8 = -8 * 0.12 * lnR + phase0 * 1.3
  const stream2 = 0.5 + 0.5 * (c2 * Math.cos(a2) + s2 * Math.sin(a2))
  const stream8 = 0.5 + 0.5 * (c8 * Math.cos(a8) + s8 * Math.sin(a8))
  const streams =
    stream2 * (1 - T.streamHarmonic) +
    Math.pow(Math.max(stream8, 1e-4), 1.8) * T.streamHarmonic

  // Multi-scale turbulence in *advected* frame (moves with gas)
  const turb = turbulenceSeamless(cx * 1.65, sx * 1.65, lnR + 0.05 * shear, 4)
  const clump = turbulenceSeamless(cx * 3.1, sx * 3.1, lnR * 1.15, 3)
  const fine = turbulenceSeamless(cx * 6.2, sx * 6.2, lnR * 1.4, 2)

  // Radial dust lanes / rings (φ-independent → seamless)
  const dustWave = 0.5 + 0.5 * Math.sin(lnR * 5.4 + 0.4 + 0.15 * shear)
  const dustOuter = Math.min(1, Math.max(0, (lnR - 0.65) / 2.0))
  const dust = 1 - dustContrast * dustOuter * (0.5 + 0.5 * dustWave)

  // Fine radial ripple (settling rings)
  const ripple = 0.5 + 0.5 * Math.sin(lnR * 4.8 + 0.3 * shear)

  // Soft radial edges
  const softIn = Math.min(1, Math.max(0, (rho / M - 5.5) / 2.5))
  const softOut = Math.min(1, Math.max(0, (3.4 - lnR) / 1.6))
  const edgeIn = softIn * softIn * (3 - 2 * softIn)
  const edgeOut = softOut * softOut * (3 - 2 * softOut)

  let f = 1
  f *= 1 - armContrast + armContrast * (0.16 + 1.1 * armsBright)
  f *= 1 - streamContrast + streamContrast * (0.25 + 0.95 * streams)
  f *=
    1 -
    turbContrast +
    turbContrast * (0.22 + 0.55 * turb + 0.28 * clump + 0.2 * fine)
  f *= dust
  f *= 0.86 + 0.28 * ripple
  f *= 0.82 + 0.18 * edgeIn * edgeOut

  return Math.min(T.texMax, Math.max(T.texMin, f))
}

/**
 * Mild rest-frame T multiplier from local clumping (plasma hotspots / cooler dust).
 */
export function diskTemperatureJitter(
  hx: number,
  hz: number,
  mass: number,
  opts: { turbContrast?: number; time?: number; prograde?: boolean; shearRate?: number } = {},
): number {
  const T = DISK_TEXTURE
  const rho = Math.hypot(hx, hz)
  if (rho < 1e-8) return 1
  const M = Math.max(mass, 1e-8)
  const invR = 1 / rho
  const lnR = Math.log(Math.max(rho / M, 1e-4))
  const sense = (opts.prograde ?? true) ? 1 : -1
  const OmegaK = Math.sqrt(M) / Math.pow(Math.max(rho, 1e-6), 1.5)
  const shearRate = opts.shearRate ?? T.shearRate
  const shear = sense * shearRate * T.shearGain * OmegaK * (opts.time ?? 0)
  const cphi = hx * invR
  const sphi = hz * invR
  const csh = Math.cos(shear)
  const ssh = Math.sin(shear)
  const cx = cphi * csh - sphi * ssh
  const sx = cphi * ssh + sphi * csh
  const turb = turbulenceSeamless(cx * 1.6, sx * 1.6, lnR, 3)
  const amp = opts.turbContrast ?? T.tempJitterAmp
  const j = 1 + amp * (2 * turb - 1)
  return Math.min(1.22, Math.max(0.82, j))
}

/**
 * Max |Δf| across the negative-x axis (atan2 branch), at fixed ρ.
 */
export function azimuthSeamDelta(
  rho: number,
  mass: number,
  opts: DiskTextureOptions = {},
): number {
  const eps = 1e-6
  const a = diskTextureFactor(-rho, eps, mass, opts)
  const b = diskTextureFactor(-rho, -eps, mass, opts)
  return Math.abs(a - b)
}
