import { describe, expect, test } from 'bun:test'
import { buildScreenshotFilename, slugTag } from '../../src/ui/screenshot'

describe('screenshot filename', () => {
  test('slugTag sanitizes', () => {
    expect(slugTag('a★ 0.9')).toBe('a_0.9')
    expect(slugTag('  med  ')).toBe('med')
  })

  test('buildScreenshotFilename includes resolution and tags', () => {
    const name = buildScreenshotFilename(1920, 1080, {
      prefix: 'black-hole',
      tags: ['med', 'a0.92'],
      date: new Date('2026-07-17T12:34:56.000Z'),
    })
    expect(name).toBe('black-hole_1920x1080_med_a0.92_2026-07-17_12-34-56.png')
  })

  test('empty tags omit middle segment', () => {
    const name = buildScreenshotFilename(800, 600, {
      date: new Date('2026-01-01T00:00:00.000Z'),
    })
    expect(name).toBe('black-hole_800x600_2026-01-01_00-00-00.png')
  })
})
