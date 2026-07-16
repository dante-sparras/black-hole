/**
 * Global scale-free camera mode (not hair, not per-preset).
 * true  → D = distanceM · M (angular image independent of mass)
 * false → D = distanceM fixed geometric (mass grows hole & lensing)
 */
import { emitStore } from './batch'

export const SCALE_FREE_DEFAULT = true

type Listener = (scaleFree: boolean) => void

let scaleFree = SCALE_FREE_DEFAULT
const listeners = new Set<Listener>()

export function getScaleFree(): boolean {
  return scaleFree
}

export function setScaleFree(on: boolean): boolean {
  scaleFree = Boolean(on)
  emitStore('scaleFree', () => {
    for (const fn of listeners) fn(scaleFree)
  })
  return scaleFree
}

export function subscribeScaleFree(listener: Listener): () => void {
  listeners.add(listener)
  listener(scaleFree)
  return () => {
    listeners.delete(listener)
  }
}
