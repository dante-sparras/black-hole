import { describe, expect, test } from 'bun:test'
import { CONTROL_HELP, getControlHelp } from '../../src/ui/controlHelp'
import { buildControlsHtml } from '../../src/ui/controlsMarkup'

const EXPECTED_KEYS = [
  'mass',
  'spin',
  'charge',
  'rho0',
  'scaleH',
  'gamma',
  'beta',
  'rin',
  'outer',
  'tilt',
  'jet',
  'dist',
  'inc',
  'azim',
  'fov',
  'quality',
  'grmhd',
] as const

describe('control 🛈 help', () => {
  test('every free control has help content', () => {
    for (const k of EXPECTED_KEYS) {
      const h = getControlHelp(k)
      expect(h).toBeDefined()
      expect(h!.title.length).toBeGreaterThan(0)
      expect(h!.summary.length).toBeGreaterThan(0)
      expect(h!.body.length).toBeGreaterThan(20)
    }
  })

  test('CONTROL_HELP keys match free UI set (no free ṁ)', () => {
    expect(Object.keys(CONTROL_HELP).sort()).toEqual([...EXPECTED_KEYS].sort())
    expect(CONTROL_HELP.mdot).toBeUndefined()
  })

  test('markup has expert free bases and no ṁ slider', () => {
    const html = buildControlsHtml()
    for (const k of EXPECTED_KEYS) {
      expect(html).toContain(`data-help="${k}"`)
    }
    expect(html).toContain('id="d-hr"')
    expect(html).toContain('id="d-gamma"')
    expect(html).toContain('id="d-rin"')
    expect(html).not.toContain('id="d-mdot"')
    expect(html).toContain('Jet strength')
  })
})
