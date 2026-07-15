/**
 * Geodesic integrator mode (not black-hole hair, not per-preset).
 * 'rt' = real-time Cartesian (default, GPU twin of knNullAccel)
 * 'bl' = Boyer–Lindquist Mino-time (CPU Phase 1–3 math on GPU)
 */
export type GeodesicIntegrator = 'rt' | 'bl'

export const GEODESIC_DEFAULTS = {
  integrator: 'rt' as GeodesicIntegrator,
}

type Listener = (mode: GeodesicIntegrator) => void

let integrator: GeodesicIntegrator = GEODESIC_DEFAULTS.integrator
const listeners = new Set<Listener>()

export function getGeodesicIntegrator(): GeodesicIntegrator {
  return integrator
}

export function setGeodesicIntegrator(mode: GeodesicIntegrator): GeodesicIntegrator {
  integrator = mode === 'bl' ? 'bl' : 'rt'
  for (const fn of listeners) fn(integrator)
  return integrator
}

export function subscribeGeodesic(listener: Listener): () => void {
  listeners.add(listener)
  listener(integrator)
  return () => {
    listeners.delete(listener)
  }
}
