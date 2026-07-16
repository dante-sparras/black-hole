/**
 * GRMHD density cube state — not hair, not a free physics law.
 * When enabled + loaded, volume dens samples the 3D field.
 */
import { emitStore } from './batch'
import type { GrmhdCube } from '../physics/grmhdCube'

export type GrmhdState = {
  /** Use cube dens in RT when cube is loaded */
  enabled: boolean
  /** Mix 0 = pure analytic, 1 = pure cube (when enabled) */
  mix: number
  /** Loaded cube or null */
  cube: GrmhdCube | null
  /** Source label for HUD */
  label: string
  /** Load error message if any */
  error: string | null
}

const DEFAULT: GrmhdState = {
  enabled: false,
  mix: 1,
  cube: null,
  label: 'none',
  error: null,
}

type Listener = (s: GrmhdState) => void

let state: GrmhdState = { ...DEFAULT }
const listeners = new Set<Listener>()

export function getGrmhd(): GrmhdState {
  return state
}

export function setGrmhd(partial: Partial<GrmhdState>): GrmhdState {
  const next: GrmhdState = { ...state, ...partial }
  next.enabled = Boolean(next.enabled)
  next.mix = Math.min(1, Math.max(0, Number(next.mix) || 0))
  next.label = String(next.label ?? 'none')
  next.error = partial.error === undefined ? next.error : partial.error
  if ('cube' in partial) {
    next.cube = partial.cube ?? null
  }
  state = next
  emitStore('grmhd', () => {
    for (const fn of listeners) fn(state)
  })
  return state
}

export function subscribeGrmhd(listener: Listener): () => void {
  listeners.add(listener)
  listener(state)
  return () => {
    listeners.delete(listener)
  }
}

export function clearGrmhdCube(): void {
  setGrmhd({ cube: null, enabled: false, label: 'none', error: null })
}
