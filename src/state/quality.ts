/**
 * Render quality (not physics). Only affects steps / DPR / volume stride.
 * Physics laws stay fixed — this is numerical resolution only.
 */
import { emitStore } from './batch'
import { RT } from '../physics/geodesic/rtConstants'

export type QualityLevel = 'low' | 'med' | 'high'

export type QualityConfig = {
  level: QualityLevel
  /** Effective max geodesic steps per ray */
  maxSteps: number
  /** devicePixelRatio cap */
  dpr: number
  volumeStride: number
  baseStepM: number
}

export const QUALITY_PRESETS: Record<QualityLevel, Omit<QualityConfig, 'level'>> = {
  low: {
    maxSteps: 320,
    dpr: 0.75,
    volumeStride: 4,
    baseStepM: 0.16,
  },
  med: {
    maxSteps: RT.defaultMaxSteps,
    dpr: 1,
    volumeStride: 3,
    baseStepM: 0.13,
  },
  high: {
    maxSteps: 640,
    dpr: 1.25,
    volumeStride: 2,
    baseStepM: 0.11,
  },
}

export const QUALITY_DEFAULT: QualityLevel = 'med'

type Listener = (q: QualityConfig) => void

let level: QualityLevel = QUALITY_DEFAULT
const listeners = new Set<Listener>()

export function getQuality(): QualityConfig {
  return { level, ...QUALITY_PRESETS[level] }
}

export function setQuality(next: QualityLevel): QualityConfig {
  level = next
  const q = getQuality()
  emitStore('quality', () => {
    for (const fn of listeners) fn(q)
  })
  return q
}

export function subscribeQuality(listener: Listener): () => void {
  listeners.add(listener)
  listener(getQuality())
  return () => {
    listeners.delete(listener)
  }
}
