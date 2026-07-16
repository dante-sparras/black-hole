/**
 * Upload GRMHD dens cube as WebGPU-safe Data3DTexture.
 *
 * Uses **R8 UNORM** (not R32F): float linear filtering is optional in WebGPU
 * and often fails pipeline creation → pure black canvas.
 */
import {
  ClampToEdgeWrapping,
  Data3DTexture,
  LinearFilter,
  NoColorSpace,
  RedFormat,
  UnsignedByteType,
} from 'three'
import type { GrmhdCube } from '../physics/grmhdCube'

export type GrmhdGpuTexture = {
  texture: Data3DTexture
  origin: { x: number; y: number; z: number }
  extent: { x: number; y: number; z: number }
  densScale: number
}

export function createGrmhdTexture(cube: GrmhdCube): GrmhdGpuTexture {
  const n = cube.nx * cube.ny * cube.nz
  const bytes = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const v = cube.data[i] ?? 0
    bytes[i] = Math.min(255, Math.max(0, Math.round(v * 255)))
  }
  const tex = new Data3DTexture(bytes, cube.nx, cube.ny, cube.nz)
  tex.format = RedFormat
  tex.type = UnsignedByteType
  tex.minFilter = LinearFilter
  tex.magFilter = LinearFilter
  tex.wrapS = ClampToEdgeWrapping
  tex.wrapT = ClampToEdgeWrapping
  tex.wrapR = ClampToEdgeWrapping
  tex.generateMipmaps = false
  tex.colorSpace = NoColorSpace
  tex.needsUpdate = true
  return {
    texture: tex,
    origin: { ...cube.origin },
    extent: { ...cube.extent },
    densScale: cube.densScale,
  }
}

export function disposeGrmhdTexture(gpu: GrmhdGpuTexture | null): void {
  gpu?.texture.dispose()
}
