/**
 * Accretion-disk surface texture (not black-hole hair).
 * Log spirals + multi-scale turbulence for surface brightness modulation.
 * Geometric units; pure math (no Three.js).
 */

/** Hash → [0, 1) */
export function hash2(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return n - Math.floor(n)
}

/** Value-noise in 2D with bilinear interp, domain-tiled by period. */
export function valueNoise2(x: number, y: number, scale = 1): number {
  const xs = x * scale
  const ys = y * scale
  const x0 = Math.floor(xs)
  const y0 = Math.floor(ys)
  const fx = xs - x0
  const fy = ys - y0
  // Smoothstep
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

/** fBm-ish: 3 octaves of value noise. Returns ~[0, 1]. */
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

export type DiskTextureOptions = {
  /** Number of spiral arms (2 is classic). */
  arms?: number
  /** Pitch of log spiral (higher = tighter wind). */
  pitch?: number
  /** Arm contrast in [0, 1] — 0 = no arms. */
  armContrast?: number
  /** Turbulence contrast in [0, 1]. */
  turbContrast?: number
  /** Global seed phase (radians). */
  phase?: number
}

/**
 * Surface brightness / density modulation for a disk hit at (hx, hz).
 * Returns factor typically in ~[0.35, 1.6] so the disk never goes fully dark.
 *
 * Spiral: cos(m · (φ − pitch · ln(ρ))) with soft absolute-value brightening.
 */
export function diskTextureFactor(
  hx: number,
  hz: number,
  mass: number,
  opts: DiskTextureOptions = {},
): number {
  const arms = opts.arms ?? 2
  const pitch = opts.pitch ?? 0.55
  const armContrast = opts.armContrast ?? 0.55
  const turbContrast = opts.turbContrast ?? 0.4
  const phase = opts.phase ?? 0.3

  const M = Math.max(mass, 1e-8)
  const rho = Math.hypot(hx, hz)
  if (rho < 1e-8) return 1

  const phi = Math.atan2(hz, hx)
  const lnR = Math.log(Math.max(rho / M, 1e-4))

  // Trailing log-spiral arm phase
  const spiral = arms * (phi - pitch * lnR) + phase
  // Soft arms: peaks on arms, troughs between
  const armWave = 0.5 + 0.5 * Math.cos(spiral)
  // Sharpen slightly for filament look
  const armsBright = Math.pow(armWave, 1.35)

  // Turbulence in polar-ish coords (ρ/M, φ)
  const turb = turbulence2(rho / M * 0.35, phi * 1.7 + lnR * 0.8)

  // Optional weak radial ripples (density waves)
  const ripple = 0.5 + 0.5 * Math.sin(lnR * 4.2 + phi * 0.5)

  let f = 1
  f *= 1 - armContrast + armContrast * (0.35 + 0.9 * armsBright)
  f *= 1 - turbContrast + turbContrast * (0.45 + 0.9 * turb)
  f *= 0.92 + 0.16 * ripple

  // Keep in a usable visual range
  return Math.min(1.85, Math.max(0.28, f))
}

/**
 * Mild temperature jitter from turbulence (hotter in dense filaments).
 * ΔT scale ~ ±15% at full contrast.
 */
export function diskTemperatureJitter(
  hx: number,
  hz: number,
  mass: number,
  turbContrast = 0.4,
): number {
  const rho = Math.hypot(hx, hz)
  if (rho < 1e-8) return 1
  const phi = Math.atan2(hz, hx)
  const lnR = Math.log(Math.max(rho / Math.max(mass, 1e-8), 1e-4))
  const turb = turbulence2(rho / Math.max(mass, 1e-8) * 0.5, phi * 2.1 + lnR)
  const j = 1 - 0.5 * turbContrast + turbContrast * turb
  return Math.min(1.2, Math.max(0.85, j))
}
