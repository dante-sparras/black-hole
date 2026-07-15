/**
 * Classical no-hair parameters for a stationary Einstein–Maxwell black hole.
 * Geometric units G = c = 1:
 *   - mass M
 *   - dimensionless spin a★ = J / M²  (Kerr length a = a★ · M)
 *   - charge Q
 *
 * Accretion disk parameters (ṁ, outer radius, …) live in DiskParams — not hair.
 */
export type BlackHoleParams = {
  readonly mass: number
  /** Dimensionless spin a★ after validation. */
  readonly spinStar: number
  readonly charge: number
}

export type MetricFamily =
  | 'schwarzschild'
  | 'kerr'
  | 'kerr-newman'
  | 'reissner-nordstrom'

export type DerivedGeometry = {
  readonly mass: number
  readonly spinStar: number
  /** a = a★ · M */
  readonly spinLength: number
  readonly charge: number
  readonly family: MetricFamily
  /** Outer / event horizon r₊ */
  readonly rPlus: number
  /** Inner / Cauchy horizon r₋ (0 when non-rotating uncharged) */
  readonly rMinus: number
  /** Equatorial outer ergosphere radius (Kerr/KN); 2M on equator */
  readonly rErgoEquator: number
  /**
   * Primary photon-sphere radius for display.
   * Schwarzschild: 3M. Kerr: prograde equatorial circular photon orbit.
   */
  readonly rPhotonSphere: number
  /**
   * Prograde / co-rotating critical impact b_c (analytic closed form).
   * Schw: 3√3 M; Kerr/RN/KN: familyCriticalImpact — HUD also exposes b_c^±.
   * Image silhouette is from the real-time integrator, not this scalar.
   */
  readonly criticalImpact: number
  /** Prograde thin-disk ISCO (inner edge) */
  readonly rIsco: number
  /** true if M² ≥ a² + Q² */
  readonly hasHorizon: boolean
  /** M² − a² − Q² */
  readonly extremalityDelta: number
}

export function spinLength(params: Pick<BlackHoleParams, 'mass' | 'spinStar'>): number {
  return params.spinStar * params.mass
}
