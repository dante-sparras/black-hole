/**
 * Disk midplane tilt relative to black-hole spin (+Y).
 * Geometric units; pure math (no Three).
 *
 * Convention:
 *   1. Rotate about +Y by −node (line of nodes)
 *   2. Rotate about +X by −tilt (incline disk midplane)
 * Resulting y is height above the tilted midplane.
 */

export type TiltVec3 = { readonly x: number; readonly y: number; readonly z: number }

/**
 * Lab Cartesian → disk-frame coordinates.
 * tilt=0, node=0 → identity.
 */
export function labToDiskFrame(
  x: number,
  y: number,
  z: number,
  tiltRad: number,
  nodeRad = 0,
): TiltVec3 {
  const cN = Math.cos(nodeRad)
  const sN = Math.sin(nodeRad)
  const x1 = cN * x + sN * z
  const z1 = -sN * x + cN * z
  const y1 = y

  const cT = Math.cos(tiltRad)
  const sT = Math.sin(tiltRad)
  return {
    x: x1,
    y: cT * y1 - sT * z1,
    z: sT * y1 + cT * z1,
  }
}

/** Signed height above tilted midplane (disk-frame y). */
export function diskMidplaneHeight(
  x: number,
  y: number,
  z: number,
  tiltRad: number,
  nodeRad = 0,
): number {
  return labToDiskFrame(x, y, z, tiltRad, nodeRad).y
}

/** Cylindrical radius in the tilted disk plane. */
export function diskCylindricalRho(
  x: number,
  y: number,
  z: number,
  tiltRad: number,
  nodeRad = 0,
): number {
  const d = labToDiskFrame(x, y, z, tiltRad, nodeRad)
  return Math.hypot(d.x, d.z)
}
