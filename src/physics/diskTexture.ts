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
  /** Log-spiral pitch (tighter = more wound, GRMHD-like) */
  pitch: 0.55,
  /** Arm vs inter-arm contrast — softer face-on (no radar lace) */
  armContrast: 0.72,
  /** Multi-scale plasma — large-scale dominant */
  turbContrast: 0.72,
  /** Outer dusty lanes */
  dustContrast: 0.48,
  phase0: 0.35,
  /**
   * UI shear multiplier (default ~1.25). Combined with shearGain for visible wind.
   * Phase uses dimensionless Ω̃=(M/r)^{3/2} so rate is stable under mass changes.
   */
  shearRate: 1.25,
  /**
   * Visual gain: wall-clock seconds → pattern phase.
   * Uses Ω̃=(M/r)^{3/2} (not geometric Ω∝1/M) so scale-free mass does not freeze the disk.
   */
  shearGain: 32,
  texMin: 0.2,
  texMax: 2.2,
  /** Mild T jitter from clumping */
  tempJitterAmp: 0.14,
  /** H/R scale-height — singularity-thin photosphere (~surface disk). */
  scaleHeight: 0.032,
  /** Fine flow-aligned filament strength (reference streamlines) */
  streamContrast: 0.55,
  /** Secondary streamline harmonic weight — keep low (m=8 causes face-on lace) */
  streamHarmonic: 0.25,
  frameDragGain: 1.4,
  mriSigma: 0.55,
  photonRingBoost: 0,
  warpAmp: 0.05,
  rimRagged: 0.14,
  /** Noise dens — large-scale swirl, not high-freq edge lace */
  noiseDensMix: 0.78,
  /** Dual-sample edge — mild (high values → moiré face-on) */
  noiseEdgeBoost: 6.5,
} as const

/**
 * Unit-mean log-normal factor from unit noise n∈[0,1].
 * ξ = 2n−1 ∈ [-1,1]; f = exp(σ ξ − σ²/2).
 */
export function logNormalUnitMean(n: number, sigma: number): number {
  const s = Math.max(0, Math.min(1.5, sigma))
  const xi = 2 * Math.min(1, Math.max(0, n)) - 1
  return Math.exp(s * xi - 0.5 * s * s)
}

/**
 * Kerr spiral frame-drag phase (radians-ish display units).
 * δφ ≈ gain · a★ · (M/r) — stronger near horizon for spinning holes.
 */
export function frameDragPhase(aStar: number, rhoOverM: number, gain = DISK_TEXTURE.frameDragGain): number {
  const a = Math.min(0.998, Math.max(0, aStar))
  const rm = Math.max(rhoOverM, 1.05)
  return gain * a * (1 / rm)
}

/**
 * Photon-ring multi-wrap silk factor (≥1).
 * wrapHits: cumulative volume/plane hit count (0 = first contact).
 * rhoOverM: cylindrical radius in units of M.
 */
export function photonRingSilk(
  wrapHits: number,
  rhoOverM: number,
  boost = DISK_TEXTURE.photonRingBoost,
): number {
  const wrap = Math.max(0, wrapHits)
  const prox = Math.exp(-1.15 * Math.abs(rhoOverM - 3))
  // boost=0 → only mild multi-hit (path stacking), no film silk
  const silk = 1 + Math.min(wrap, 3) * 0.12 + prox * Math.min(wrap, 2) * boost
  return Math.min(2.0, silk)
}

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
  /** Dimensionless spin for Kerr spiral frame-drag */
  aStar?: number
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

  // Dimensionless Keplerian: Ω̃ = (M/r)^{3/2}
  // Geometric Ω∝1/M at fixed r/M freezes the pattern when mass↑.
  const rhoM = Math.max(rho / M, 1e-4)
  const OmegaDim = Math.pow(rhoM, -1.5)
  const sense = prograde ? 1 : -1
  const shear = sense * shearRate * T.shearGain * OmegaDim * time
  // Kerr frame-drag: static spiral wind + slow time wind with spin
  const aStarOpt = opts.aStar ?? 0
  const drag = frameDragPhase(aStarOpt, rhoM)
  const shearTot = shear + drag * (1 + 0.12 * time)

  // Advect material frame: rotate (c,s) by shear (differential with r)
  const csh = Math.cos(shearTot)
  const ssh = Math.sin(shearTot)
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
  const alpha = -arms * pitch * lnR + phase0 + drag
  const ca = Math.cos(alpha)
  const sa = Math.sin(alpha)
  const armWave = 0.5 + 0.5 * (cm * ca + sm * sa)
  const armsBright = Math.pow(Math.max(armWave, 1e-4), 1.55)

  // m=2 soft streamlines only (m=8 dropped — face-on lace)
  const c2 = cx * cx - sx * sx
  const s2 = 2 * cx * sx
  const a2 = -2 * 0.28 * lnR + phase0 * 0.7 + drag * 0.5

  // Multi-scale turbulence in *advected* frame — LARGE SCALE only (face-on safe).
  // High freq (×6+) + pure radial sin(lnR) → concentric moiré when viewed face-on.
  const turb = turbulenceSeamless(cx * 0.95, sx * 0.95, lnR * 0.35 + 0.03 * shearTot, 3)
  const clump = turbulenceSeamless(cx * 1.75, sx * 1.75, lnR * 0.55 + 0.05 * shearTot, 3)
  // Mild mid swirl — still azimuthal, not radial rings
  const fine = turbulenceSeamless(cx * 2.6, sx * 2.6, lnR * 0.4, 2)
  // Log-normal MRI dens proxy (unit mean) — lower σ for softer face-on
  const mri = logNormalUnitMean(0.55 * turb + 0.35 * clump + 0.1 * fine, T.mriSigma * 0.85)

  // Dust: φ-dependent via seamless m=2 (no atan2 branch cut)
  const dustWave =
    0.5 +
    0.5 *
      (0.65 * (0.5 + 0.5 * (c2 * Math.cos(0.4 * lnR + 0.1 * shearTot) +
        s2 * Math.sin(0.4 * lnR + 0.1 * shearTot))) +
        0.35 * Math.sin(lnR * 1.1 + 0.2 * shearTot))
  const dustOuter = Math.min(1, Math.max(0, (lnR - 0.55) / 1.9))
  const dust = 1 - dustContrast * dustOuter * (0.4 + 0.6 * dustWave)

  // Soft large-scale radial brightness only (very low freq — no radar rings)
  const radialSoft = 0.88 + 0.12 * Math.sin(lnR * 0.85 + 0.15 * shearTot)

  // Irregular outer rim modulation (not a perfect circle)
  const c3 = cphi * cphi * cphi - 3 * cphi * sphi * sphi
  const s3 = 3 * cphi * cphi * sphi - sphi * sphi * sphi
  const rimN = hash2(cphi * 7.1, sphi * 5.3)
  const rim = 0.5 + 0.5 * (0.55 * c3 + 0.25 * s3 + 0.4 * rimN - 0.2)
  const edgeOut = Math.min(1, Math.max(0, (3.55 - lnR + T.rimRagged * (rim - 0.5)) / 1.55))
  const edgeOutS = edgeOut * edgeOut * (3 - 2 * edgeOut)

  // Soft radial edges
  const softIn = Math.min(1, Math.max(0, (rho / M - 5.5) / 2.5))
  const edgeIn = softIn * softIn * (3 - 2 * softIn)

  // Soft m=2 only for arms (drop harsh m=8 streams face-on)
  const stream2only = 0.5 + 0.5 * (c2 * Math.cos(a2) + s2 * Math.sin(a2))
  const streamsSoft =
    stream2only * 0.75 + Math.pow(Math.max(stream2only, 1e-4), 1.4) * 0.25

  let f = 1
  f *= 1 - armContrast * 0.85 + armContrast * 0.85 * (0.22 + 1.0 * armsBright)
  f *= 1 - streamContrast * 0.7 + streamContrast * 0.7 * (0.28 + 0.95 * streamsSoft)
  f *=
    1 -
    turbContrast +
    turbContrast * (0.2 + 0.55 * turb + 0.3 * clump + 0.1 * fine + 0.35 * (mri - 0.5))
  f *= dust
  f *= radialSoft
  f *= 0.82 + 0.22 * edgeIn * edgeOutS
  f *= 0.82 + 0.18 * mri

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
  const rhoM = Math.max(rho / M, 1e-4)
  const OmegaDim = Math.pow(rhoM, -1.5)
  const shearRate = opts.shearRate ?? T.shearRate
  const shear = sense * shearRate * T.shearGain * OmegaDim * (opts.time ?? 0)
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
