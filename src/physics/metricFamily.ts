/**
 * Metric-family routing from no-hair parameters.
 * Single source of truth for schw / kerr / rn / kn labels and mode tags.
 */
import type { BlackHoleParams, MetricFamily } from './types'

const EPS = 1e-12

export type GeodesicModeKind = 'rt' | 'bl'

export type RealtimeModeTag =
  | 'schw-RT'
  | 'kerr-RT'
  | 'rn-RT'
  | 'kn-RT'
  | 'schw-BL'
  | 'kerr-BL'
  | 'rn-BL'
  | 'kn-BL'

export function hasSpin(params: Pick<BlackHoleParams, 'spinStar'>): boolean {
  return Math.abs(params.spinStar) >= EPS
}

export function hasCharge(params: Pick<BlackHoleParams, 'charge'>): boolean {
  return Math.abs(params.charge) >= EPS
}

/** Analytic metric family from (a★, Q). */
export function metricFamilyFromParams(
  params: Pick<BlackHoleParams, 'spinStar' | 'charge'>,
): MetricFamily {
  const a = hasSpin(params)
  const q = hasCharge(params)
  if (!a && !q) return 'schwarzschild'
  if (a && !q) return 'kerr'
  if (!a && q) return 'reissner-nordstrom'
  return 'kerr-newman'
}

/**
 * Short stats-bar tag for the active integrator path.
 * RT = Cartesian real-time force; BL = Boyer–Lindquist Mino-time.
 */
export function realtimeModeTag(
  params: Pick<BlackHoleParams, 'spinStar' | 'charge'>,
  mode: GeodesicModeKind = 'rt',
): RealtimeModeTag {
  const a = hasSpin(params)
  const q = hasCharge(params)
  const suffix = mode === 'bl' ? 'BL' : 'RT'
  if (!a && !q) return `schw-${suffix}` as RealtimeModeTag
  if (a && !q) return `kerr-${suffix}` as RealtimeModeTag
  if (!a && q) return `rn-${suffix}` as RealtimeModeTag
  return `kn-${suffix}` as RealtimeModeTag
}

/** r_ISCO / M for GPU upload (scale-free). */
export function rIscoOverM(rIsco: number, mass: number): number {
  return rIsco / Math.max(mass, 1e-12)
}
