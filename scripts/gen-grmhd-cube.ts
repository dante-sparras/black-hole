/**
 * Generate a demo GRMHD-like density cube for the browser pipeline.
 *
 *   bun run scripts/gen-grmhd-cube.ts
 *   → public/cubes/demo.bhcm
 *
 * For *true* HARM/BHAC dumps, use scripts/convert-harm-stub.ts notes
 * (full HDF5 converter is offline / Python).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  encodeBhcm,
  synthesizeGrmhdLikeCube,
  cubePeakDensity,
} from '../src/physics/grmhdCube'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'public', 'cubes', 'demo.bhcm')

const cube = synthesizeGrmhdLikeCube({
  n: 72,
  halfBoxM: 34,
  zHalfM: 9,
  rInM: 2.3,
  rOutM: 26,
  hOverR: 0.085,
  aStar: 0.92,
  seed: 7,
})

mkdirSync(dirname(out), { recursive: true })
const buf = encodeBhcm(cube)
writeFileSync(out, Buffer.from(buf))

const mb = (buf.byteLength / (1024 * 1024)).toFixed(2)
console.log(
  `Wrote ${out}\n  ${cube.nx}×${cube.ny}×${cube.nz}  peak=${cubePeakDensity(cube).toFixed(3)}  ${mb} MiB`,
)
