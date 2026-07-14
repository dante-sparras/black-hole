/**
 * CLI: CPU reference topology render (aligned with GPU RT constants).
 *
 *   bun run scripts/cpu-ref-render.ts
 *   bun run test:ref
 */
import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { renderCpuRef, rgbToPpm } from '../src/physics/geodesic/cpuRef'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'tmp')
mkdirSync(outDir, { recursive: true })
const outPath = join(outDir, 'cpu-ref.ppm')

const result = renderCpuRef({
  params: { mass: 1, spinStar: 0, charge: 0, mdot: 0.1 },
  width: 96,
  height: 54,
})

writeFileSync(outPath, rgbToPpm(result.width, result.height, result.rgb))

const payload = {
  counts: result.counts,
  center: result.center,
  camera: result.camera,
  outPath,
}
// Structured for tests / CI to parse if needed
console.log(JSON.stringify(payload, null, 2))
console.log(`wrote ${outPath}`)
