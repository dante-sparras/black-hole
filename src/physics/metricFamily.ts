/**
 * Metric-family routing from no-hair parameters.
 * Single source of truth for schw / kerr / rn / kn labels and RT mode tags.
 */
import type { BlackHoleParams, MetricFamily } from './types'

const EPS = 1e-12

export type RealtimeModeTag = 'schw-RT' | 'kerr-RT' | 'rn-RT' | 'kn-RT'

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
 * Short stats-bar tag for the real-time integrator path.
 * Matches GPU force law routing (not full Boyer–Lindquist).
 */
export function realtimeModeTag(
  params: Pick<BlackHoleParams, 'spinStar' | 'charge'>,
): RealtimeModeTag {
  const a = hasSpin(params)
  const q = hasCharge(params)
  if (!a && !q) return 'schw-RT'
  if (a && !q) return 'kerr-RT'
  if (!a && q) return 'rn-RT'
  return 'kn-RT'
}

/** r_ISCO / M for GPU upload (scale-free). */
export function rIscoOverM(rIsco: number, mass: number): number {
  return rIsco / Math.max(mass, 1e-12)
}
