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
    maxSteps: 340,
    /** Keep full pixel density so post-AA (SMAA) has room to work on mobile */
    dpr: 1,
    volumeStride: 4,
    baseStepM: 0.15,
  },
  med: {
    maxSteps: RT.defaultMaxSteps,
    dpr: 1,
    volumeStride: 2,
    baseStepM: 0.12,
  },
  high: {
    maxSteps: 660,
    dpr: 1.15,
    volumeStride: 1,
    baseStepM: 0.1,
  },
}

/** Default: high-looking med — denser volume, still interactive */
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
