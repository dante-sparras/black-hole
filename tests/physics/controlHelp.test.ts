import { describe, expect, test } from 'bun:test'
import { CONTROL_HELP, getControlHelp } from '../../src/ui/controlHelp'
import { buildControlsHtml } from '../../src/ui/controlsMarkup'

const EXPECTED_KEYS = [
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

  test('CONTROL_HELP keys match free UI set (no free ṁ / mass)', () => {
    expect(Object.keys(CONTROL_HELP).sort()).toEqual([...EXPECTED_KEYS].sort())
    expect(CONTROL_HELP.mdot).toBeUndefined()
    expect(CONTROL_HELP.mass).toBeUndefined()
  })

  test('markup has expert free bases, three presets, no mass/ṁ sliders', () => {
    const html = buildControlsHtml()
    for (const k of EXPECTED_KEYS) {
      expect(html).toContain(`data-help="${k}"`)
    }
    expect(html).toContain('id="d-hr"')
    expect(html).toContain('id="d-gamma"')
    expect(html).toContain('id="d-rin"')
    expect(html).not.toContain('id="d-mdot"')
    expect(html).not.toContain('id="p-mass"')
    expect(html).toContain('Scale-free')
        expect(html).not.toContain('id="preset-hint"')
        expect(html).not.toContain('id="dbg-master"')
        expect(html).toContain('id="btn-screenshot"')
        expect(html).toContain('Screenshot PNG')
        expect(html).toContain('class="ctrl-num"')
        expect(html).toContain('type="number"')
        expect(html).toContain('data-val="spin"')
        expect(html).toContain('Jet strength')
        expect(html).toContain('data-preset="hot"')
        expect(html).toContain('data-preset="cool"')
        expect(html).toContain('data-preset="interstellar"')
        // order: Hot first in markup
        expect(html.indexOf('data-preset="hot"')).toBeLessThan(html.indexOf('data-preset="cool"'))
        expect(html.indexOf('data-preset="cool"')).toBeLessThan(
          html.indexOf('data-preset="interstellar"'),
        )
        expect(html).not.toContain('data-preset="schwarzschild"')
        expect(html).not.toContain('data-preset="default"')
        expect(html).not.toContain('M = 1 locked (scale-free)')
          })
        })
