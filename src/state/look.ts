/**
 * Look / post-process settings (not black-hole hair).
 * Bloom is Unreal-style luminance threshold + multi-mip blur.
 * Defaults stay subtle so the shadow stays readable.
 */
import { emitStore } from './batch'

export type LookState = {
  /** Master bloom toggle */
  bloomEnabled: boolean
  /** Bloom intensity (0 = off visually even if enabled) */
  bloomStrength: number
  /** Blur spread in [0, 1] */
  bloomRadius: number
  /** Luminance threshold (HDR); higher = only hottest pixels bloom */
  bloomThreshold: number
  /** Renderer tone-mapping exposure */
  exposure: number
}

/** Subtle film glow — disk edges, not a white-out of the hole.
 * Inspired by MisterPrada/singularity soft bloom (str~0.22, r~0), but with
 * a mid threshold so the pure-black shadow stays readable.
 */
export const LOOK_DEFAULTS: LookState = {
  /** Soft default glow (singularity-style cinematic without crushing physics) */
  bloomEnabled: true,
  bloomStrength: 0.3,
  bloomRadius: 0.12,
  bloomThreshold: 0.36,
  exposure: 0.98,
}

export const LOOK_LIMITS = {
  bloomStrength: { min: 0, max: 0.85 },
  bloomRadius: { min: 0, max: 1 },
  bloomThreshold: { min: 0, max: 2 },
  exposure: { min: 0.2, max: 3 },
} as const

type Listener = (look: LookState) => void

let look: LookState = { ...LOOK_DEFAULTS }
const listeners = new Set<Listener>()

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

export function getLook(): LookState {
  return look
}

export function setLook(partial: Partial<LookState>): LookState {
  const next: LookState = { ...look, ...partial }
  next.bloomStrength = clamp(
    next.bloomStrength,
    LOOK_LIMITS.bloomStrength.min,
    LOOK_LIMITS.bloomStrength.max,
  )
  next.bloomRadius = clamp(
    next.bloomRadius,
    LOOK_LIMITS.bloomRadius.min,
    LOOK_LIMITS.bloomRadius.max,
  )
  next.bloomThreshold = clamp(
    next.bloomThreshold,
    LOOK_LIMITS.bloomThreshold.min,
    LOOK_LIMITS.bloomThreshold.max,
  )
  next.exposure = clamp(
    next.exposure,
    LOOK_LIMITS.exposure.min,
    LOOK_LIMITS.exposure.max,
  )
  next.bloomEnabled = Boolean(next.bloomEnabled)
  look = next
  emitStore('look', () => {
    for (const fn of listeners) fn(look)
  })
  return look
}

export function subscribeLook(listener: Listener): () => void {
  listeners.add(listener)
  listener(look)
  return () => {
    listeners.delete(listener)
  }
}
