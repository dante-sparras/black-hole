/**
 * Accretion disk store (not black-hole hair).
 */
import {
  DEFAULT_DISK,
  normalizeDisk,
  type DiskInput,
  type DiskParams,
} from '../physics/diskParams'

type Listener = (disk: DiskParams) => void

let disk: DiskParams = normalizeDisk({})
const listeners = new Set<Listener>()

export function getDisk(): DiskParams {
  return disk
}

export function setDisk(input: DiskInput): DiskParams {
  disk = normalizeDisk({ ...disk, ...input })
  for (const fn of listeners) fn(disk)
  return disk
}

export function subscribeDisk(listener: Listener): () => void {
  listeners.add(listener)
  listener(disk)
  return () => {
    listeners.delete(listener)
  }
}

export { DEFAULT_DISK }
