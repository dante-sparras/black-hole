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
