/**
 * GRMHD density cube — real 3D dens field for volume RT.
 *
 * Format `.bhcm` (Black-Hole Cube Map), little-endian:
 *   magic "BHCM" (4)
 *   version u32 (=1)
 *   nx, ny, nz u32
 *   originX,Y,Z f32   — box min corner in units of M
 *   extentX,Y,Z f32   — box size in units of M
 *   densScale f32     — multiply samples (normalize peak ~1)
 *   data: nx*ny*nz f32 density ≥ 0 (x varies fastest)
 *
 * Coordinates match the sim: +Y spin axis, equatorial XZ.
 */

export const BHCM_MAGIC = 0x4d434842 // 'BHCM' LE: B H C M
export const BHCM_VERSION = 1

export type GrmhdCubeMeta = {
  nx: number
  ny: number
  nz: number
  /** Box min corner (units of M) */
  origin: { x: number; y: number; z: number }
  /** Box size (units of M) */
  extent: { x: number; y: number; z: number }
  densScale: number
}

export type GrmhdCube = GrmhdCubeMeta & {
  /** Row-major dens[ix + nx*(iy + ny*iz)] */
  data: Float32Array
}

export function createEmptyCube(
  nx: number,
  ny: number,
  nz: number,
  halfBoxM = 40,
  zHalfM = 12,
): GrmhdCube {
  return {
    nx,
    ny,
    nz,
    origin: { x: -halfBoxM, y: -zHalfM, z: -halfBoxM },
    extent: { x: 2 * halfBoxM, y: 2 * zHalfM, z: 2 * halfBoxM },
    densScale: 1,
    data: new Float32Array(nx * ny * nz),
  }
}

export function cubeIndex(c: GrmhdCubeMeta, ix: number, iy: number, iz: number): number {
  return ix + c.nx * (iy + c.ny * iz)
}

/** World (x,y,z) in units of M → dens (trilinear). Outside box → 0. */
export function sampleGrmhdCube(
  cube: GrmhdCube,
  xM: number,
  yM: number,
  zM: number,
): number {
  const { nx, ny, nz, origin, extent, densScale, data } = cube
  if (nx < 2 || ny < 2 || nz < 2) return 0
  const u = (xM - origin.x) / extent.x
  const v = (yM - origin.y) / extent.y
  const w = (zM - origin.z) / extent.z
  if (u < 0 || v < 0 || w < 0 || u > 1 || v > 1 || w > 1) return 0

  const fx = u * (nx - 1)
  const fy = v * (ny - 1)
  const fz = w * (nz - 1)
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const z0 = Math.floor(fz)
  const x1 = Math.min(nx - 1, x0 + 1)
  const y1 = Math.min(ny - 1, y0 + 1)
  const z1 = Math.min(nz - 1, z0 + 1)
  const tx = fx - x0
  const ty = fy - y0
  const tz = fz - z0

  const c000 = data[cubeIndex(cube, x0, y0, z0)]!
  const c100 = data[cubeIndex(cube, x1, y0, z0)]!
  const c010 = data[cubeIndex(cube, x0, y1, z0)]!
  const c110 = data[cubeIndex(cube, x1, y1, z0)]!
  const c001 = data[cubeIndex(cube, x0, y0, z1)]!
  const c101 = data[cubeIndex(cube, x1, y0, z1)]!
  const c011 = data[cubeIndex(cube, x0, y1, z1)]!
  const c111 = data[cubeIndex(cube, x1, y1, z1)]!

  const c00 = c000 * (1 - tx) + c100 * tx
  const c10 = c010 * (1 - tx) + c110 * tx
  const c01 = c001 * (1 - tx) + c101 * tx
  const c11 = c011 * (1 - tx) + c111 * tx
  const c0 = c00 * (1 - ty) + c10 * ty
  const c1 = c01 * (1 - ty) + c11 * ty
  return Math.max(0, (c0 * (1 - tz) + c1 * tz) * densScale)
}

export function encodeBhcm(cube: GrmhdCube): ArrayBuffer {
  const headerBytes = 4 + 4 + 12 + 24 + 12 + 4 // magic+ver+n+origin+extent+scale
  const buf = new ArrayBuffer(headerBytes + cube.data.byteLength)
  const view = new DataView(buf)
  let o = 0
  view.setUint32(o, BHCM_MAGIC, true)
  o += 4
  view.setUint32(o, BHCM_VERSION, true)
  o += 4
  view.setUint32(o, cube.nx, true)
  o += 4
  view.setUint32(o, cube.ny, true)
  o += 4
  view.setUint32(o, cube.nz, true)
  o += 4
  view.setFloat32(o, cube.origin.x, true)
  o += 4
  view.setFloat32(o, cube.origin.y, true)
  o += 4
  view.setFloat32(o, cube.origin.z, true)
  o += 4
  view.setFloat32(o, cube.extent.x, true)
  o += 4
  view.setFloat32(o, cube.extent.y, true)
  o += 4
  view.setFloat32(o, cube.extent.z, true)
  o += 4
  view.setFloat32(o, cube.densScale, true)
  o += 4
  new Float32Array(buf, o).set(cube.data)
  return buf
}

export function decodeBhcm(buffer: ArrayBuffer): GrmhdCube {
  if (buffer.byteLength < 48) {
    throw new Error('BHCM: buffer too small')
  }
  const view = new DataView(buffer)
  let o = 0
  const magic = view.getUint32(o, true)
  o += 4
  if (magic !== BHCM_MAGIC) {
    throw new Error(`BHCM: bad magic 0x${magic.toString(16)}`)
  }
  const version = view.getUint32(o, true)
  o += 4
  if (version !== BHCM_VERSION) {
    throw new Error(`BHCM: unsupported version ${version}`)
  }
  const nx = view.getUint32(o, true)
  o += 4
  const ny = view.getUint32(o, true)
  o += 4
  const nz = view.getUint32(o, true)
  o += 4
  if (nx < 2 || ny < 2 || nz < 2 || nx > 512 || ny > 512 || nz > 512) {
    throw new Error(`BHCM: bad dims ${nx}×${ny}×${nz}`)
  }
  const origin = {
    x: view.getFloat32(o, true),
    y: view.getFloat32(o + 4, true),
    z: view.getFloat32(o + 8, true),
  }
  o += 12
  const extent = {
    x: view.getFloat32(o, true),
    y: view.getFloat32(o + 4, true),
    z: view.getFloat32(o + 8, true),
  }
  o += 12
  const densScale = view.getFloat32(o, true)
  o += 4
  const n = nx * ny * nz
  const need = o + n * 4
  if (buffer.byteLength < need) {
    throw new Error(`BHCM: expected ${need} bytes, got ${buffer.byteLength}`)
  }
  const data = new Float32Array(buffer, o, n).slice()
  return { nx, ny, nz, origin, extent, densScale, data }
}

/**
 * Build a GRMHD-*like* density field (for offline gen / demos).
 * Not a true HARM dump — use convert-harm.ts for real cubes.
 *
 * Features: thin sech² disk, log-spiral dens waves, log-normal MRI, ISCO hole.
 */
export function synthesizeGrmhdLikeCube(opts: {
  n?: number
  halfBoxM?: number
  zHalfM?: number
  rInM?: number
  rOutM?: number
  hOverR?: number
  aStar?: number
  seed?: number
}): GrmhdCube {
  const n = opts.n ?? 80
  const halfBoxM = opts.halfBoxM ?? 36
  const zHalfM = opts.zHalfM ?? 10
  const rIn = opts.rInM ?? 2.2 // near high-spin ISCO
  const rOut = opts.rOutM ?? 28
  const h0 = opts.hOverR ?? 0.08
  const aStar = opts.aStar ?? 0.9
  const seed = opts.seed ?? 42

  const cube = createEmptyCube(n, Math.max(24, Math.floor(n * 0.45)), n, halfBoxM, zHalfM)
  // ny can differ
  const ny = cube.ny
  const nx = cube.nx
  const nz = cube.nz
  cube.data = new Float32Array(nx * ny * nz)

  let peak = 0
  for (let iz = 0; iz < nz; iz++) {
    for (let iy = 0; iy < ny; iy++) {
      for (let ix = 0; ix < nx; ix++) {
        const x = cube.origin.x + ((ix + 0.5) / nx) * cube.extent.x
        const y = cube.origin.y + ((iy + 0.5) / ny) * cube.extent.y
        const z = cube.origin.z + ((iz + 0.5) / nz) * cube.extent.z
        const rho = Math.hypot(x, z)
        if (rho < rIn * 0.95 || rho > rOut * 1.15) {
          cube.data[cubeIndex(cube, ix, iy, iz)] = 0
          continue
        }
        const phi = Math.atan2(z, x)
        const lnR = Math.log(Math.max(rho, 1e-3))
        // Log spiral m=2 + frame-drag wind
        const drag = aStar * (1 / Math.max(rho, 1.2))
        const arm = 0.5 + 0.5 * Math.cos(2 * phi - 0.75 * lnR + drag * 2)
        const fil = 0.5 + 0.5 * Math.cos(6 * phi - 0.4 * lnR + drag)
        // MRI log-normal from hash
        const h = hash01(ix * 12.9898 + iy * 78.233 + iz * 37.719 + seed)
        const h2 = hash01(ix * 5.1 + iy * 11.3 + iz * 17.7 + seed * 1.7)
        const mri = Math.exp(0.65 * (2 * h - 1) - 0.5 * 0.65 * 0.65)
        const H = h0 * rho * (0.35 + Math.pow(rho / rOut, 0.9))
        const sech = 1 / Math.max(Math.cosh(y / Math.max(H, 0.05)), 1e-4)
        const densZ = sech * sech
        const radial =
          Math.max(0, 1 - Math.sqrt(rIn / Math.max(rho, rIn * 1.01))) *
          Math.exp(-Math.max(0, (rho - rOut * 0.85) / (rOut * 0.2)))
        const spiral = 0.35 + 0.9 * Math.pow(arm, 1.6) + 0.35 * Math.pow(fil, 2)
        let dens = densZ * radial * spiral * mri * (0.7 + 0.5 * h2)
        // Inner plasma boost
        if (rho < rIn * 3) dens *= 1.15 + 0.4 * h
        // Outer dust lanes (lower dens)
        if (rho > rOut * 0.55) dens *= 0.75 + 0.35 * Math.sin(lnR * 4 + phi * 2)
        cube.data[cubeIndex(cube, ix, iy, iz)] = dens
        if (dens > peak) peak = dens
      }
    }
  }
  // Normalize peak ≈ 1
  if (peak > 1e-12) {
    for (let i = 0; i < cube.data.length; i++) {
      cube.data[i]! /= peak
    }
  }
  cube.densScale = 1
  return cube
}

function hash01(n: number): number {
  const x = Math.sin(n) * 43758.5453
  return x - Math.floor(x)
}

/** Peak dens after densScale (for HUD). */
export function cubePeakDensity(cube: GrmhdCube): number {
  let p = 0
  for (let i = 0; i < cube.data.length; i++) {
    const v = cube.data[i]!
    if (v > p) p = v
  }
  return p * cube.densScale
}
