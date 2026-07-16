/**
 * Stub: convert real GRMHD dumps → .bhcm
 *
 * Real pipeline (Python recommended):
 *   1. Load HARM / BHAC / Athena++ HDF5 (rho, optionally ugas)
 *   2. Resample to Cartesian grid in units of M (x,y,z), +Y = spin
 *   3. Write BHCM via the same header as src/physics/grmhdCube.ts
 *
 * Example (pseudocode):
 *   import h5py, numpy as np
 *   rho = f['rho'][...]  # shape (n1,n2,n3) in code coords
 *   # map to Cartesian (x,y,z)/M on nx×ny×nz
 *   # write magic BHCM + floats
 *
 * Public data sources (check licenses):
 *   - Illinois GRMHD library / EHT theory papers data releases
 *   - You own HARM/BHAC run dumps
 *
 * This stub only validates encode/decode roundtrip of a tiny cube.
 */
import {
  decodeBhcm,
  encodeBhcm,
  synthesizeGrmhdLikeCube,
  sampleGrmhdCube,
} from '../src/physics/grmhdCube'

const c = synthesizeGrmhdLikeCube({ n: 16, halfBoxM: 20, zHalfM: 6 })
const buf = encodeBhcm(c)
const c2 = decodeBhcm(buf)
const s = sampleGrmhdCube(c2, 8, 0, 0)
console.log('roundtrip ok', c2.nx, c2.ny, c2.nz, 'sample(8,0,0)=', s.toFixed(4))
console.log('See docs/grmhd-cubes.md for real dump conversion.')
