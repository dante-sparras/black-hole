/**
 * Accretion-disk surface structure (not black-hole hair).
 * Flattened gas/plasma/dust look: log spirals + multi-scale turbulence +
 * radial dust lanes. Optional Keplerian shear phase for rotation.
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

/** Shared defaults — GPU should stay visually close. */
export const DISK_TEXTURE = {
  arms: 2,
  /** Log-spiral pitch (tighter = more wound) */
  pitch: 0.68,
  /** Arm vs inter-arm contrast (gas filaments) */
  armContrast: 0.78,
  /** Multi-scale plasma / eddy contrast */
  turbContrast: 0.62,
  /** Outer dusty lanes */
  dustContrast: 0.42,
  phase0: 0.35,
  /** Visual Keplerian rate so structure shears without hyper-spin */
  shearRate: 0.45,
  texMin: 0.22,
  texMax: 2.15,
  /** Mild T jitter from clumping */
  tempJitterAmp: 0.16,
  /** H/R scale-height used for path-length thickness (edge-on look) */
  scaleHeight: 0.065,
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
}

/**
 * Surface brightness modulation. Seamless in azimuth.
 *
 * Spiral uses cos(m·φ − …) with integer m → continuous at φ=±π.
 * Turbulence samples (cos φ, sin φ, ln ρ) — no raw φ coordinate.
 * Optional time shears pattern with Keplerian Ω ∝ r^{-3/2}.
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

  const M = Math.max(mass, 1e-8)
  const rho = Math.hypot(hx, hz)
  if (rho < 1e-8) return 1

  const invR = 1 / rho
  const cphi = hx * invR
  const sphi = hz * invR
  const lnR = Math.log(Math.max(rho / M, 1e-4))

  // Keplerian shear: faster inside → winding (visual rotation)
  const OmegaK = Math.sqrt(M) / Math.pow(Math.max(rho, 1e-6), 1.5)
  const sense = prograde ? 1 : -1
  const shear = sense * shearRate * OmegaK * time

  // cos(m·φ) via (c+is)^m
  let cm = cphi
  let sm = sphi
  for (let k = 1; k < arms; k++) {
    const nc = cm * cphi - sm * sphi
    const ns = cm * sphi + sm * cphi
    cm = nc
    sm = ns
  }
  // α = −m·pitch·lnR + phase0 + m·shear  (shear winds the spiral)
  const alpha = -arms * pitch * lnR + phase0 + arms * shear
  const ca = Math.cos(alpha)
  const sa = Math.sin(alpha)
  const armWave = 0.5 + 0.5 * (cm * ca + sm * sa)
  const armsBright = Math.pow(Math.max(armWave, 1e-4), 1.45)

  // Multi-scale seamless turbulence
  const turb = turbulenceSeamless(cphi * 1.45, sphi * 1.45, lnR + 0.15 * shear, 4)
  // Clumpy mid-scale (plasma)
  const clump = turbulenceSeamless(cphi * 2.8, sphi * 2.8, lnR * 1.1, 2)

  // Radial dust lanes / rings (φ-independent → seamless)
  const dustWave = 0.5 + 0.5 * Math.sin(lnR * 5.1 + 0.4)
  const dustOuter = Math.min(1, Math.max(0, (lnR - 0.8) / 2.2)) // stronger outward
  const dust = 1 - dustContrast * dustOuter * (0.55 + 0.45 * dustWave)

  // Fine radial ripple (settling rings)
  const ripple = 0.5 + 0.5 * Math.sin(lnR * 4.2)

  // Soft radial edges (match GPU spirit) — mild so mid-disk stays free
  const softIn = Math.min(1, Math.max(0, (rho / M - 5.5) / 2.5))
  const softOut = Math.min(1, Math.max(0, (3.4 - lnR) / 1.6))
  const edgeIn = softIn * softIn * (3 - 2 * softIn)
  const edgeOut = softOut * softOut * (3 - 2 * softOut)

  let f = 1
  f *= 1 - armContrast + armContrast * (0.22 + 1.05 * armsBright)
  f *= 1 - turbContrast + turbContrast * (0.28 + 0.75 * turb + 0.35 * clump)
  f *= dust
  f *= 0.88 + 0.24 * ripple
  // Soft edge envelope (never floors the mid-disk)
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
  opts: { turbContrast?: number; time?: number; prograde?: boolean } = {},
): number {
  const T = DISK_TEXTURE
  const rho = Math.hypot(hx, hz)
  if (rho < 1e-8) return 1
  const M = Math.max(mass, 1e-8)
  const invR = 1 / rho
  const lnR = Math.log(Math.max(rho / M, 1e-4))
  const sense = (opts.prograde ?? true) ? 1 : -1
  const OmegaK = Math.sqrt(M) / Math.pow(Math.max(rho, 1e-6), 1.5)
  const shear = sense * T.shearRate * OmegaK * (opts.time ?? 0)
  const turb = turbulenceSeamless(
    hx * invR * 1.6,
    hz * invR * 1.6,
    lnR + 0.1 * shear,
    3,
  )
  const amp = opts.turbContrast ?? T.tempJitterAmp
  // turb ~ [0,1] → jitter around 1
  const j = 1 + amp * (2 * turb - 1)
  return Math.min(1.22, Math.max(0.82, j))
}

/**
 * Max |Δf| across the negative-x axis (atan2 branch), at fixed ρ.
 * Samples just above and below the cut at the same radius.
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
