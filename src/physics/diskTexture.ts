/**
 * Accretion-disk surface texture (not black-hole hair).
 * Log spirals + multi-scale turbulence for surface brightness modulation.
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
): number {
  let amp = 0.5
  let sum = 0
  let norm = 0
  let s = 1
  for (let i = 0; i < 3; i++) {
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

export type DiskTextureOptions = {
  arms?: number
  pitch?: number
  armContrast?: number
  turbContrast?: number
  phase?: number
}

/**
 * Surface brightness modulation. Seamless in azimuth.
 *
 * Spiral uses cos(m·φ − …) with integer m → continuous at φ=±π.
 * Turbulence samples (cos φ, sin φ, ln ρ) — no raw φ coordinate.
 */
export function diskTextureFactor(
  hx: number,
  hz: number,
  mass: number,
  opts: DiskTextureOptions = {},
): number {
  const arms = Math.max(1, Math.round(opts.arms ?? 2))
  const pitch = opts.pitch ?? 0.55
  const armContrast = opts.armContrast ?? 0.55
  const turbContrast = opts.turbContrast ?? 0.4
  const phase = opts.phase ?? 0.3

  const M = Math.max(mass, 1e-8)
  const rho = Math.hypot(hx, hz)
  if (rho < 1e-8) return 1

  const invR = 1 / rho
  const cphi = hx * invR
  const sphi = hz * invR
  const lnR = Math.log(Math.max(rho / M, 1e-4))

  // cos(m·φ) = T_m(cphi) via complex power: (c+is)^m
  // For m=2: cos(2φ)=c²−s², sin(2φ)=2cs
  let cm = cphi
  let sm = sphi
  for (let k = 1; k < arms; k++) {
    const nc = cm * cphi - sm * sphi
    const ns = cm * sphi + sm * cphi
    cm = nc
    sm = ns
  }
  // Spiral: Re[ e^{i(mφ − m·pitch·lnR + phase)} ] = cm·cos(α) + sm·sin(α)
  // where α = −m·pitch·lnR + phase
  const alpha = -arms * pitch * lnR + phase
  const ca = Math.cos(alpha)
  const sa = Math.sin(alpha)
  const armWave = 0.5 + 0.5 * (cm * ca + sm * sa)
  const armsBright = Math.pow(Math.max(armWave, 1e-4), 1.35)

  // Seamless turbulence in (cosφ, sinφ, lnR)
  const turb = turbulenceSeamless(cphi * 1.4, sphi * 1.4, lnR)

  // Radial-only ripple (no φ) — fully seamless
  const ripple = 0.5 + 0.5 * Math.sin(lnR * 4.2)

  let f = 1
  f *= 1 - armContrast + armContrast * (0.35 + 0.9 * armsBright)
  f *= 1 - turbContrast + turbContrast * (0.45 + 0.9 * turb)
  f *= 0.92 + 0.16 * ripple

  return Math.min(1.85, Math.max(0.28, f))
}

export function diskTemperatureJitter(
  hx: number,
  hz: number,
  mass: number,
  turbContrast = 0.4,
): number {
  const rho = Math.hypot(hx, hz)
  if (rho < 1e-8) return 1
  const M = Math.max(mass, 1e-8)
  const invR = 1 / rho
  const lnR = Math.log(Math.max(rho / M, 1e-4))
  const turb = turbulenceSeamless(hx * invR * 1.6, hz * invR * 1.6, lnR)
  const j = 1 - 0.5 * turbContrast + turbContrast * turb
  return Math.min(1.2, Math.max(0.85, j))
}

/**
 * Max |Δf| across the negative-x axis (atan2 branch), at fixed ρ.
 * Samples just above and below the cut at the same radius.
 */
export function azimuthSeamDelta(rho: number, mass: number): number {
  const eps = 1e-6
  const a = diskTextureFactor(-rho, eps, mass)
  const b = diskTextureFactor(-rho, -eps, mass)
  return Math.abs(a - b)
}
