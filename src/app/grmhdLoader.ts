/**
 * Load / upload GRMHD dens cubes into state + GPU tracer.
 */
import { decodeBhcm, type GrmhdCube } from '../physics/grmhdCube'
import { createGrmhdTexture, type GrmhdGpuTexture } from '../render/grmhdTexture'
import type { GeodesicTracer } from '../render/geodesicTracerTypes'
import { getGrmhd, setGrmhd } from '../state/grmhd'

let lastGpu: GrmhdGpuTexture | null = null

export async function loadGrmhdFromUrl(
  url: string,
  tracer: GeodesicTracer,
  opts: { enable?: boolean; mix?: number; label?: string } = {},
): Promise<GrmhdCube> {
  const res = await fetch(url)
  if (!res.ok) {
    setGrmhd({ error: `fetch ${url}: ${res.status}`, cube: null, enabled: false })
    throw new Error(`GRMHD fetch failed: ${res.status} ${url}`)
  }
  const buf = await res.arrayBuffer()
  const cube = decodeBhcm(buf)
  applyGrmhdCube(cube, tracer, {
    enable: opts.enable ?? true,
    mix: opts.mix ?? 1,
    label: opts.label ?? url.split('/').pop() ?? 'cube',
  })
  return cube
}

export function applyGrmhdCube(
  cube: GrmhdCube,
  tracer: GeodesicTracer,
  opts: { enable?: boolean; mix?: number; label?: string } = {},
): void {
  const enable = opts.enable ?? true
  const mix = opts.mix ?? 1
  const label = opts.label ?? 'cube'
  const gpu = createGrmhdTexture(cube)
  lastGpu = gpu
  setGrmhd({
    cube,
    enabled: enable,
    mix: enable ? mix : 0,
    label,
    error: null,
  })
  // Always bind texture so sample is valid; mix=0 keeps analytic dens
  tracer.setGrmhdCube(gpu, enable ? mix : 0)
}

export function syncGrmhdToTracer(tracer: GeodesicTracer): void {
  const s = getGrmhd()
  if (s.cube) {
    if (!lastGpu) {
      lastGpu = createGrmhdTexture(s.cube)
    }
    tracer.setGrmhdCube(lastGpu, s.enabled ? s.mix : 0)
  } else {
    tracer.setGrmhdCube(null, 0)
  }
}

export function setGrmhdEnabled(tracer: GeodesicTracer, enabled: boolean): void {
  const s = getGrmhd()
  const mix = enabled ? (s.mix > 0 ? s.mix : 1) : 0
  setGrmhd({ enabled, mix: enabled ? mix : 0 })
  if (s.cube) {
    if (!lastGpu) lastGpu = createGrmhdTexture(s.cube)
    tracer.setGrmhdCube(lastGpu, enabled ? mix : 0)
  } else {
    tracer.setGrmhdCube(null, 0)
  }
}

export function setGrmhdMix(tracer: GeodesicTracer, mix: number): void {
  const s = getGrmhd()
  setGrmhd({ mix })
  if (s.enabled && s.cube) {
    if (!lastGpu) lastGpu = createGrmhdTexture(s.cube)
    tracer.setGrmhdCube(lastGpu, mix)
  }
}
