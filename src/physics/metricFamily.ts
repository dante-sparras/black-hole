/**
 * Metric-family routing from no-hair parameters.
 * Single source of truth for schw / kerr / rn / kn labels and mode tags.
 */
import type { BlackHoleParams, MetricFamily } from './types'

const EPS = 1e-12

/** Integrator mode for live render tags (mirrored by state/geodesic). */
export type IntegratorModeTag = 'rt' | 'bl'

export function metricFamilyFromParams(
  params: Pick<BlackHoleParams, 'spinStar' | 'charge'>,
): MetricFamily {
  const spinning = Math.abs(params.spinStar) >= EPS
  const charged = Math.abs(params.charge) >= EPS
  if (!spinning && !charged) return 'schwarzschild'
  if (spinning && !charged) return 'kerr'
  if (!spinning && charged) return 'reissner-nordstrom'
  return 'kerr-newman'
}

/**
 * Live-render mode tag for stats HUD.
 * RT = Cartesian force approx; BL = Mino Kerr nulls.
 * `~` = known approximation (Kerr-force RT, or BL with Q on Kerr Δ).
 */
export function realtimeModeTag(
  params: Pick<BlackHoleParams, 'spinStar' | 'charge'>,
  integrator: IntegratorModeTag = 'rt',
): string {
  const fam = metricFamilyFromParams(params)
  const short =
    fam === 'schwarzschild'
      ? 'schw'
      : fam === 'kerr'
        ? 'kerr'
        : fam === 'reissner-nordstrom'
          ? 'rn'
          : 'kn'
  if (integrator === 'bl') {
    const charged = Math.abs(params.charge) >= EPS
    if (charged) return `${short}-BL~`
    return `${short}-BL`
  }
  if (short === 'kerr' || short === 'kn') return `${short}-RT~`
  return `${short}-RT`
}

/** r_ISCO in units of M for GPU uniforms */
export function rIscoOverM(rIsco: number, mass: number): number {
  return rIsco / Math.max(mass, 1e-12)
}
