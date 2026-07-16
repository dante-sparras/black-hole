/**
 * Upload GRMHD dens cube as WebGPU/Three Data3DTexture (R32F).
 */
import {
  ClampToEdgeWrapping,
  Data3DTexture,
  FloatType,
  LinearFilter,
  NoColorSpace,
  RedFormat,
} from 'three'
import type { GrmhdCube } from '../physics/grmhdCube'

export type GrmhdGpuTexture = {
  texture: Data3DTexture
  origin: { x: number; y: number; z: number }
  extent: { x: number; y: number; z: number }
  densScale: number
}

export function createGrmhdTexture(cube: GrmhdCube): GrmhdGpuTexture {
  const tex = new Data3DTexture(cube.data, cube.nx, cube.ny, cube.nz)
  tex.format = RedFormat
  tex.type = FloatType
  tex.minFilter = LinearFilter
  tex.magFilter = LinearFilter
  tex.wrapS = ClampToEdgeWrapping
  tex.wrapT = ClampToEdgeWrapping
  tex.wrapR = ClampToEdgeWrapping
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
