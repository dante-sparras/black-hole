/**
 * Tiny pure numeric helpers shared by normalize / stores.
 * Keep free of domain types so any layer can import.
 */

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

/** Finite number or fallback (NaN/Infinity rejected). */
export function finiteNumber(v: number | undefined, fallback: number): number {
  return Number.isFinite(v as number) ? (v as number) : fallback
}
