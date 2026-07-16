/** Geometric units: G = c = 1 throughout the physics layer. */
export const G = 1 as const
export const C = 1 as const

/**
 * Soft max |a★| for numerical stability (near-extremal Kerr).
 * Free spin range is signed: a★ ∈ [−MAX_SPIN_STAR, +MAX_SPIN_STAR].
 */
export const MAX_SPIN_STAR = 0.998

/** Default no-hair parameters — high prograde Kerr for strong default visuals. */
export const DEFAULT_MASS = 1
/** Default dimensionless spin a★ = +0.9 (signed; UI allows ±MAX_SPIN_STAR). */
export const DEFAULT_SPIN_STAR = 0.9
export const DEFAULT_CHARGE = 0

/**
 * Default Eddington ratio ṁ = Ṁ/Ṁ_Edd (disk, not hair).
 * ~0.1 is a typical bright thin-disk reference for visualization.
 */
export const DEFAULT_MDOT = 0.1
/** Dim floor — still visible but cool/red. */
export const MDOT_MIN = 0.001
/** Near/slightly super-Eddington for look-dev (thin-disk assumption shaky above ~1). */
export const MDOT_MAX = 3

/** Minimum positive mass to avoid division by zero / naked pathologies. */
export const MASS_MIN = 1e-6
