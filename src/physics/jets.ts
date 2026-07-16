/**
 * Optional bipolar jet helpers (analytic funnel proxy — not full GRMHD).
 * Strength scales with spin² · ṁ^α · user jetPower.
 */

export type JetParams = {
  /** User 0…1; 0 = off */
  readonly jetPower: number
  readonly spinStar: number
  readonly mdot: number
}

/**
 * Effective jet luminosity scale (dimensionless 0…~1).
 * Blandford–Znajek-inspired: ∝ a★² · ṁ^0.4 · jetPower.
 * Retrograde |a★| still allows jets but same a²; low spin → dim.
 */
export function jetEffectivePower(p: JetParams): number {
  const user = Math.min(1, Math.max(0, p.jetPower))
  if (user <= 1e-6) return 0
  const a2 = Math.min(1, p.spinStar * p.spinStar)
  const m = Math.max(p.mdot, 1e-4)
  const scale = a2 * Math.pow(m / 0.1, 0.4)
  return Math.min(1.2, user * scale)
}

/**
 * Analytic funnel density weight at lab position (spin ‖ +Y).
 * r_cyl = √(x²+z²), polar concentration near axis outside horizon.
 */
export function jetFunnelWeight(
  x: number,
  y: number,
  z: number,
  mass: number,
  rPlus: number,
): number {
  const M = Math.max(mass, 1e-12)
  const r = Math.hypot(x, y, z)
  if (r <= rPlus * 1.05) return 0
  const rho = Math.hypot(x, z)
  const core = M * 0.45
  const radial = Math.exp(-((rho / Math.max(core, 1e-6)) ** 2))
  // Prefer polar: |y|/r ≳ 0.55
  const mu = Math.abs(y) / Math.max(r, 1e-6)
  const polar = Math.max(0, (mu - 0.45) / 0.55)
  // Soft floor above disk midplane band
  const awayDisk = Math.min(1, Math.abs(y) / Math.max(M * 1.5, 1e-6))
  return radial * polar * polar * Math.min(1, awayDisk)
}

/** RGB-ish cool jet core (relative linear RGB 0…1). */
export function jetCoreColor(mdot: number): { r: number; g: number; b: number } {
  const hot = Math.min(1, Math.max(0, Math.log10(Math.max(mdot, 0.01) / 0.1) * 0.15 + 0.5))
  return {
    r: 0.55 + hot * 0.25,
    g: 0.72 + hot * 0.15,
    b: 0.95,
  }
}
