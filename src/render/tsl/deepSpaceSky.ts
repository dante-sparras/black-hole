// @ts-nocheck — TSL; top-level only.
/**
 * Deep-space backdrop: equirectangular environment map (public/space.jpg)
 * sampled by escape-ray direction. Replaces procedural starfield.
 */
import { asin, atan, clamp, float, max, min, texture, vec2, vec3 } from 'three/tsl'

const INV_TWO_PI = 1 / (Math.PI * 2)
const INV_PI = 1 / Math.PI

/**
 * @param d unit escape direction
 * @param spaceMap equirectangular texture node / THREE.Texture
 * @param uSkyBright brightness multiplier (from sky.starBrightness)
 */
export function sampleDeepSpaceSky(d, spaceMap, uSkyBright) {
  // Equirectangular: u = lon/(2π)+½, v = ½ − asin(y)/π
  const y = clamp(d.y, float(-1), float(1))
  const lon = atan(d.x, d.z) // TSL atan(y,x) = atan2
  const lat = asin(y)
  const u = lon.mul(INV_TWO_PI).add(0.5)
  const v = float(0.5).sub(lat.mul(INV_PI))
  const uv = vec2(u, v)
  const tex = texture(spaceMap, uv)
  // Photo is sRGB-ish; mild lift so disk HDR still reads, not pure black voids
  const bright = max(uSkyBright, float(0.35))
  const rgb = tex.rgb.mul(bright.mul(1.15))
  return min(rgb, vec3(2.2, 2.15, 2.3))
}
