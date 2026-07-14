/** Geometric units: G = c = 1 throughout the physics layer. */
export const G = 1 as const
export const C = 1 as const

/** Soft max |spin★| for numerical stability (near-extremal Kerr). */
export const MAX_SPIN_STAR = 0.998

/** Default no-hair parameters (Schwarzschild of unit mass). */
export const DEFAULT_MASS = 1
export const DEFAULT_SPIN_STAR = 0
export const DEFAULT_CHARGE = 0

/** Minimum positive mass to avoid division by zero / naked pathologies. */
export const MASS_MIN = 1e-6
