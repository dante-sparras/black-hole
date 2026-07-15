import { describe, expect, test } from 'bun:test'
import {
  checksumRgb,
  compareChecksums,
  DEBUG_MODES,
  isDebugModeId,
  probeRay,
  runHealthCheck,
  setDebug,
  getDebug,
  clearDebugLog,
  debugLog,
  getDebugLog,
} from '../../src/debug'
import { DEFAULT_DISK } from '../../src/physics/diskParams'
import { deriveGeometry } from '../../src/physics/derive'
import { OBSERVER_DEFAULTS } from '../../src/physics/observer'
import { normalizeParams } from '../../src/physics/validate'

describe('debug modes', () => {
  test('mode ids 0–8', () => {
    expect(isDebugModeId(0)).toBe(true)
    expect(isDebugModeId(8)).toBe(true)
    expect(isDebugModeId(9)).toBe(false)
    expect(DEBUG_MODES.fate).toBe(1)
  })

  test('setDebug clamps invalid mode', () => {
    setDebug({ mode: 99 as never })
    expect(getDebug().mode).toBe(0)
    setDebug({ mode: DEBUG_MODES.steps })
    expect(getDebug().mode).toBe(2)
    setDebug({ mode: DEBUG_MODES.normal })
  })
})

describe('debug log', () => {
  test('ring buffer records levels', () => {
    clearDebugLog()
    debugLog.info('t', 'hello')
    debugLog.warn('t', 'careful')
    const log = getDebugLog()
    expect(log.length).toBeGreaterThanOrEqual(2)
    expect(log.some((e) => e.level === 'warn')).toBe(true)
  })
})

describe('probeRay', () => {
  test('center Schw is capture', () => {
    const p = probeRay({
      params: { mass: 1, spinStar: 0, charge: 0 },
      ndcX: 0,
      ndcY: 0,
    })
    expect(p.fate === 'capture' || p.fate === 'disk').toBe(true)
    expect(p.steps).toBeGreaterThan(5)
    expect(p.stepsLog.length).toBeGreaterThan(0)
    expect(p.summary).toContain('fate=')
  })

  test('off-axis often escapes', () => {
    const p = probeRay({
      params: { mass: 1, spinStar: 0, charge: 0 },
      ndcX: 0.9,
      ndcY: 0.9,
    })
    expect(['escape', 'disk', 'capture']).toContain(p.fate)
  })
})

describe('runHealthCheck', () => {
  test('default scene is healthy or warn (not hard-fail center)', () => {
    const params = normalizeParams({ mass: 1, spinStar: 0, charge: 0 })
    const report = runHealthCheck({
      params,
      derived: deriveGeometry(params),
      disk: DEFAULT_DISK,
      camera: OBSERVER_DEFAULTS,
    })
    expect(report.checks.length).toBeGreaterThan(3)
    const center = report.checks.find((c) => c.id === 'center')
    expect(center?.level).not.toBe('fail')
    expect(report.diskFrac).toBeGreaterThan(0)
  })
})

describe('checksums', () => {
  test('black image checksum', () => {
    const rgb = new Uint8Array(12)
    const cs = checksumRgb(2, 2, rgb)
    expect(cs.meanLuma).toBe(0)
    expect(cs.blackFrac).toBe(1)
    expect(cs.hash).toMatch(/^[0-9a-f]{8}$/)
  })

  test('compare detects drift', () => {
    const a = checksumRgb(2, 2, new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))
    const b = checksumRgb(2, 2, new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255]))
    const diff = compareChecksums(a, b, { meanLuma: 0.01 })
    expect(diff.ok).toBe(false)
    expect(diff.failures.length).toBeGreaterThan(0)
  })

  test('identical matches', () => {
    const rgb = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120])
    const a = checksumRgb(2, 2, rgb)
    const b = checksumRgb(2, 2, rgb)
    expect(compareChecksums(a, b).ok).toBe(true)
  })
})
