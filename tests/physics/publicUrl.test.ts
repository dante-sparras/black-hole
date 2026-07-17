import { describe, expect, test } from 'bun:test'
import { publicUrl } from '../../src/app/publicUrl'

describe('publicUrl (Vite base)', () => {
  test('strips leading slash and joins base', () => {
    // Under bun test, BASE_URL is typically '/'
    const u = publicUrl('/noise_deep.png')
    expect(u.endsWith('noise_deep.png')).toBe(true)
    expect(u.includes('//noise')).toBe(false)
  })

  test('accepts path without leading slash', () => {
    const u = publicUrl('cubes/demo.bhcm')
    expect(u.endsWith('cubes/demo.bhcm')).toBe(true)
  })
})
