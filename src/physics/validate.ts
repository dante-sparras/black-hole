import {
  DEFAULT_CHARGE,
  DEFAULT_MASS,
  DEFAULT_SPIN_STAR,
  MASS_MIN,
  MAX_SPIN_STAR,
} from './constants'
import type { BlackHoleParams } from './types'

export type ParamsInput = Partial<BlackHoleParams>

export function isExtremalOk(p: BlackHoleParams): boolean {
  const a = p.spinStar * p.mass
  return p.mass * p.mass >= a * a + p.charge * p.charge
}

/**
 * Normalize user input into a safe BlackHoleParams.
 * - mass > 0
 * - |spinStar| ≤ MAX_SPIN_STAR
 * - |charge| reduced if needed so M² ≥ a² + Q² (prefer keeping spin)
 */
export function normalizeParams(input: ParamsInput): BlackHoleParams {
  let mass = Number.isFinite(input.mass) ? (input.mass as number) : DEFAULT_MASS
  mass = Math.max(MASS_MIN, mass)

  let spinStar = Number.isFinite(input.spinStar)
    ? (input.spinStar as number)
    : DEFAULT_SPIN_STAR
  spinStar = Math.min(MAX_SPIN_STAR, Math.max(-MAX_SPIN_STAR, spinStar))

  let charge = Number.isFinite(input.charge) ? (input.charge as number) : DEFAULT_CHARGE
  const a = spinStar * mass
  const maxQ2 = Math.max(0, mass * mass - a * a)
  const maxQ = Math.sqrt(maxQ2)
  if (Math.abs(charge) > maxQ) {
    charge = (charge === 0 ? 1 : Math.sign(charge)) * maxQ
  }

  return { mass, spinStar, charge }
}
