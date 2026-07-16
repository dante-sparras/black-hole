/**
 * Live health checks via sparse CPU probes (P1).
 */
import { diskPeakTemperatureK } from '../physics/disk'
import type { DiskParams } from '../physics/diskParams'
import { RT } from '../physics/geodesic/rtConstants'
import type { BlackHoleParams, DerivedGeometry } from '../physics/types'
import type { ObserverCamera } from '../physics/observer'
import { renderCpuRef } from '../physics/geodesic/cpuRef'
import { probeRay } from './probe'
import { debugLog } from './log'

export type HealthLevel = 'ok' | 'warn' | 'fail'

export type HealthCheck = {
  id: string
  label: string
  level: HealthLevel
  detail: string
}

export type HealthReport = {
  ok: boolean
  level: HealthLevel
  checks: HealthCheck[]
  /** Compact one-liner for stats strip */
  summary: string
  centerFate: string
  diskFrac: number
  captureFrac: number
  escapeFrac: number
  maxFrac: number
  tPeakK: number
}

function worst(a: HealthLevel, b: HealthLevel): HealthLevel {
  const rank = { ok: 0, warn: 1, fail: 2 }
  return rank[a] >= rank[b] ? a : b
}

export type HealthInput = {
  params: BlackHoleParams
  derived: DerivedGeometry
  disk: DiskParams
  camera: ObserverCamera
  scaleFree?: boolean
}

/**
 * Run cheap multi-pixel CPU topology + analytic sanity checks.
 */
export function runHealthCheck(input: HealthInput): HealthReport {
  const { params, derived, disk, camera } = input
  const scaleFree = input.scaleFree ?? true
  const checks: HealthCheck[] = []

  // Sparse topology render
  const ref = renderCpuRef({
    params,
    camera,
    diskOuterM: disk.outerM,
    width: 48,
    height: 27,
    scaleFree,
  })
  const total =
    ref.counts.capture + ref.counts.disk + ref.counts.escape + ref.counts.max
  const captureFrac = total ? ref.counts.capture / total : 0
  const diskFrac = total ? ref.counts.disk / total : 0
  const escapeFrac = total ? ref.counts.escape / total : 0
  const maxFrac = total ? ref.counts.max / total : 0

  // Center fate
  const centerOk =
    ref.center.fate === 'capture' || ref.center.fate === 'disk'
  checks.push({
    id: 'center',
    label: 'Center ray',
    level: centerOk ? 'ok' : 'fail',
    detail: `fate=${ref.center.fate} minR=${(ref.center.minR / params.mass).toFixed(2)}M`,
  })

  checks.push({
    id: 'disk',
    label: 'Disk hits',
    level: diskFrac > 0.02 ? 'ok' : diskFrac > 0 ? 'warn' : 'fail',
    detail: `${(diskFrac * 100).toFixed(1)}% pixels`,
  })

  checks.push({
    id: 'escape',
    label: 'Escapes',
    level: escapeFrac > 0.1 ? 'ok' : 'warn',
    detail: `${(escapeFrac * 100).toFixed(1)}%`,
  })

  checks.push({
    id: 'stall',
    label: 'Max-step stall',
    level: maxFrac < 0.15 ? 'ok' : maxFrac < 0.35 ? 'warn' : 'fail',
    detail: `${(maxFrac * 100).toFixed(1)}% (floor=${RT.adaptFloor})`,
  })

  // Finite geometry
  const finite =
    Number.isFinite(derived.rPlus) &&
    Number.isFinite(derived.rIsco) &&
    Number.isFinite(params.mass)
  checks.push({
    id: 'finite',
    label: 'Finite geometry',
    level: finite ? 'ok' : 'fail',
    detail: finite
      ? `r₊=${derived.rPlus.toFixed(3)} r_ISCO=${derived.rIsco.toFixed(3)}`
      : 'NaN in r₊/ISCO',
  })

  // Extremality residual
  const a = params.spinStar * params.mass
  const ext = params.mass * params.mass - a * a - params.charge * params.charge
  checks.push({
    id: 'extremal',
    label: 'Extremality',
    level: ext >= -1e-9 ? 'ok' : 'fail',
    detail: `M²−a²−Q²=${ext.toFixed(4)}`,
  })

  // ṁ / T peak
  const tPeakK = diskPeakTemperatureK(
    disk.mdot,
    derived.rIsco / Math.max(params.mass, 1e-12),
    params.spinStar,
  )
  checks.push({
    id: 'tpeak',
    label: 'T_peak',
    level: tPeakK > 500 && tPeakK < 200_000 ? 'ok' : 'warn',
    detail: `${Math.round(tPeakK)} K · ṁ=${disk.mdot}`,
  })

  // Screen-center probe (verbose-capable)
  const centerProbe = probeRay({
    params,
    camera,
    diskOuterM: disk.outerM,
    ndcX: 0,
    ndcY: 0,
    logStride: 64,
    scaleFree,
  })
  if (centerProbe.fate === 'escape' && params.spinStar < 0.5) {
    checks.push({
      id: 'probe-center',
      label: 'Probe center',
      level: 'warn',
      detail: centerProbe.summary,
    })
  }

  let level: HealthLevel = 'ok'
  for (const c of checks) level = worst(level, c.level)

  const summary =
    `${level.toUpperCase()} · center=${ref.center.fate} · ` +
    `disk=${(diskFrac * 100).toFixed(0)}% esc=${(escapeFrac * 100).toFixed(0)}% ` +
    `stall=${(maxFrac * 100).toFixed(0)}% · T≈${Math.round(tPeakK)}K`

  if (level === 'fail') {
    debugLog.error('health', summary)
  } else if (level === 'warn') {
    debugLog.warn('health', summary)
  }

  return {
    ok: level === 'ok',
    level,
    checks,
    summary,
    centerFate: ref.center.fate,
    diskFrac,
    captureFrac,
    escapeFrac,
    maxFrac,
    tPeakK,
  }
}
