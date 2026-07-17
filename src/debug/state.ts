/**
 * Global debug UI/runtime state (not hair, not presets).
 */
import {
  DEBUG_MODES,
  isDebugModeId,
  type DebugModeId,
} from './modes'
import { setDebugConsoleMirror } from './log'

export type DebugState = {
  /** Active false-color mode */
  mode: DebugModeId
  /** Show health strip + run CPU probes */
  healthEnabled: boolean
  /** Click-to-probe rays */
  probeEnabled: boolean
  /** Mirror debugLog to console */
  consoleMirror: boolean
}

export const DEBUG_DEFAULTS: DebugState = {
  mode: DEBUG_MODES.normal,
  healthEnabled: false,
  /** Off until Debug mode is enabled + user opts in */
  probeEnabled: false,
  consoleMirror: false,
}

type Listener = (s: DebugState) => void

let state: DebugState = { ...DEBUG_DEFAULTS }
const listeners = new Set<Listener>()

export function getDebug(): DebugState {
  return state
}

export function setDebug(partial: Partial<DebugState>): DebugState {
  const next = { ...state, ...partial }
  if (typeof next.mode === 'number' && !isDebugModeId(next.mode)) {
    next.mode = DEBUG_MODES.normal
  }
  state = next
  setDebugConsoleMirror(state.consoleMirror)
  for (const fn of listeners) fn(state)
  return state
}

export function subscribeDebug(listener: Listener): () => void {
  listeners.add(listener)
  listener(state)
  return () => {
    listeners.delete(listener)
  }
}
