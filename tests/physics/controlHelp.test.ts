import { describe, expect, test } from 'bun:test'
import { CONTROL_HELP, getControlHelp } from '../../src/ui/controlHelp'
import { buildControlsHtml } from '../../src/ui/controlsMarkup'

const EXPECTED_KEYS = [
  'mass',
  'spin',
  'charge',
  'rho0',
  'beta',
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

  test('markup includes info buttons for each free help id and no ṁ slider', () => {
    const html = buildControlsHtml()
    for (const k of EXPECTED_KEYS) {
      expect(html).toContain(`data-help="${k}"`)
    }
    expect(html).toContain('class="ctrl-info"')
    expect(html).toContain('🛈')
    expect(html).not.toContain('id="d-mdot"')
    expect(html).toContain('ṁ derived')
  })
})
