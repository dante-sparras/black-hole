/** Small UI formatting helpers (no DOM). */

export function fmt(n: number, digits = 3): string {
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(digits)
}

export function fmtMdot(m: number): string {
  if (m >= 0.1) return fmt(m, 2)
  if (m >= 0.01) return fmt(m, 3)
  return m.toExponential(1)
}

/** Optical-viz temperature for HUD (K). */
export function fmtTempK(t: number): string {
  if (!Number.isFinite(t) || t <= 0) return '—'
  if (t >= 10_000) return `${(t / 1000).toFixed(1)}k K`
  if (t >= 1000) return `${Math.round(t)} K`
  return `${t.toFixed(0)} K`
}
