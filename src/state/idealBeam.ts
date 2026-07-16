/**
 * Ideal bolometric beaming toggle (not hair, not per-preset).
 * Default ON: ideal GRRT-like I ∝ g³.
 * false = soft display I ∝ g² (opt-out only).
 */
import { emitStore } from './batch'

export const IDEAL_BEAM_DEFAULT = true

type Listener = (ideal: boolean) => void

let idealBeam = IDEAL_BEAM_DEFAULT
const listeners = new Set<Listener>()

export function getIdealBeam(): boolean {
  return idealBeam
}

export function setIdealBeam(on: boolean): boolean {
  idealBeam = Boolean(on)
  emitStore('idealBeam', () => {
    for (const fn of listeners) fn(idealBeam)
  })
  return idealBeam
}

export function subscribeIdealBeam(listener: Listener): () => void {
  listeners.add(listener)
  listener(idealBeam)
  return () => {
    listeners.delete(listener)
  }
}
