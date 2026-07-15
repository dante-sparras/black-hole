/**
 * Debug view modes for the geodesic tracer (not hair).
 * 0 = production normal.
 */
export const DEBUG_MODES = {
  normal: 0,
  fate: 1,
  steps: 2,
  minR: 3,
  gFactor: 4,
  temperature: 5,
  flux: 6,
  impactB: 7,
  skyOnly: 8,
} as const

export type DebugModeId = (typeof DEBUG_MODES)[keyof typeof DEBUG_MODES]

export type DebugModeKey = keyof typeof DEBUG_MODES

export const DEBUG_MODE_OPTIONS: { id: DebugModeId; key: DebugModeKey; label: string }[] = [
  { id: 0, key: 'normal', label: 'Normal' },
  { id: 1, key: 'fate', label: 'Fate (capture/disk/escape)' },
  { id: 2, key: 'steps', label: 'Steps heatmap' },
  { id: 3, key: 'minR', label: 'min r / M' },
  { id: 4, key: 'gFactor', label: 'g-factor (disk)' },
  { id: 5, key: 'temperature', label: 'T color (disk)' },
  { id: 6, key: 'flux', label: 'NT flux (disk)' },
  { id: 7, key: 'impactB', label: 'Impact parameter' },
  { id: 8, key: 'skyOnly', label: 'Sky only' },
]

export function isDebugModeId(n: number): n is DebugModeId {
  return Number.isInteger(n) && n >= 0 && n <= 8
}
