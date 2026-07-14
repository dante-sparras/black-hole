/** Geometric units: G = c = 1 throughout the physics layer. */
export const G = 1 as const
export const C = 1 as const

/** Soft max |spin★| for numerical stability (near-extremal Kerr). */
export const MAX_SPIN_STAR = 0.998

/** Default no-hair parameters (Schwarzschild of unit mass). */
export const DEFAULT_MASS = 1
export const DEFAULT_SPIN_STAR = 0
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
