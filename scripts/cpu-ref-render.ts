/**
 * Multi-case CPU reference suite (P2) + golden checksums (P4).
 *
 *   bun run test:ref              # assert topology + golden soft match
 *   bun run test:ref -- --write   # regenerate goldens + PPMs under tmp/
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  checksumRgb,
  compareChecksums,
  type GoldenRecord,
} from '../src/debug/checksum'
import { probeRay } from '../src/debug/probe'
import { renderCpuRef, rgbToPpm } from '../src/physics/geodesic/cpuRef'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const outDir = join(root, 'tmp')
const goldenPath = join(root, 'tests', 'fixtures', 'cpu-ref-goldens.json')

const writeMode = process.argv.includes('--write')

type CaseDef = {
  id: string
  description: string
  params: { mass: number; spinStar: number; charge: number }
  width: number
  height: number
  diskOuterM?: number
  expect: {
    centerCaptureOrDisk: boolean
    minDiskFrac: number
    minEscapeFrac: number
    maxMaxFrac: number
  }
}

const CASES: CaseDef[] = [
  {
    id: 'schw-default',
    description: 'Schwarzschild default camera',
    params: { mass: 1, spinStar: 0, charge: 0 },
    width: 96,
    height: 54,
    expect: {
      centerCaptureOrDisk: true,
      minDiskFrac: 0.03,
      minEscapeFrac: 0.2,
      maxMaxFrac: 0.25,
    },
  },
  {
    id: 'kerr-high-spin',
    description: 'Kerr a★=0.9',
    params: { mass: 1, spinStar: 0.9, charge: 0 },
    width: 80,
    height: 45,
    expect: {
      centerCaptureOrDisk: true,
      minDiskFrac: 0.02,
      minEscapeFrac: 0.15,
      maxMaxFrac: 0.35,
    },
  },
  {
    id: 'rn-q05',
    description: 'RN Q=0.5',
    params: { mass: 1, spinStar: 0, charge: 0.5 },
    width: 80,
    height: 45,
    expect: {
      centerCaptureOrDisk: true,
      minDiskFrac: 0.02,
      minEscapeFrac: 0.15,
      maxMaxFrac: 0.3,
    },
  },
  {
    id: 'extremal-near',
    description: 'Near-extremal Kerr a★=0.998',
    params: { mass: 1, spinStar: 0.998, charge: 0 },
    width: 64,
    height: 36,
    expect: {
      centerCaptureOrDisk: true,
      minDiskFrac: 0.01,
      minEscapeFrac: 0.1,
      maxMaxFrac: 0.4,
    },
  },
]

function fracs(counts: Record<string, number>) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1
  return {
    captureFrac: (counts.capture ?? 0) / total,
    diskFrac: (counts.disk ?? 0) / total,
    escapeFrac: (counts.escape ?? 0) / total,
    maxFrac: (counts.max ?? 0) / total,
  }
}

mkdirSync(outDir, { recursive: true })
mkdirSync(dirname(goldenPath), { recursive: true })

const goldens: GoldenRecord[] = []
const failures: string[] = []

for (const c of CASES) {
  const result = renderCpuRef({
    params: c.params,
    width: c.width,
    height: c.height,
    diskOuterM: c.diskOuterM,
  })
  const f = fracs(result.counts)
  const cs = checksumRgb(result.width, result.height, result.rgb)

  // Topology asserts
  if (c.expect.centerCaptureOrDisk) {
    if (result.center.fate !== 'capture' && result.center.fate !== 'disk') {
      failures.push(`${c.id}: center fate=${result.center.fate}`)
    }
  }
  if (f.diskFrac < c.expect.minDiskFrac) {
    failures.push(
      `${c.id}: diskFrac ${f.diskFrac.toFixed(3)} < ${c.expect.minDiskFrac}`,
    )
  }
  if (f.escapeFrac < c.expect.minEscapeFrac) {
    failures.push(
      `${c.id}: escapeFrac ${f.escapeFrac.toFixed(3)} < ${c.expect.minEscapeFrac}`,
    )
  }
  if (f.maxFrac > c.expect.maxMaxFrac) {
    failures.push(
      `${c.id}: maxFrac ${f.maxFrac.toFixed(3)} > ${c.expect.maxMaxFrac}`,
    )
  }

  // Center probe sanity
  const probe = probeRay({
    params: c.params,
    ndcX: 0,
    ndcY: 0,
    diskOuterM: c.diskOuterM,
  })
  if (probe.steps < 1) failures.push(`${c.id}: probe zero steps`)

  const ppmPath = join(outDir, `cpu-ref-${c.id}.ppm`)
  writeFileSync(ppmPath, rgbToPpm(result.width, result.height, result.rgb))

  const record: GoldenRecord = {
    id: c.id,
    description: c.description,
    params: c.params,
    width: c.width,
    height: c.height,
    checksum: cs,
    topology: {
      ...f,
      centerFate: result.center.fate,
    },
  }
  goldens.push(record)

  // Soft golden compare when fixture exists
  if (!writeMode && existsSync(goldenPath)) {
    try {
      const all = JSON.parse(readFileSync(goldenPath, 'utf8')) as GoldenRecord[]
      const exp = all.find((g) => g.id === c.id)
      if (exp) {
        const diff = compareChecksums(cs, exp.checksum, {
          meanLuma: 0.06,
          centerLuma: 0.08,
          blackFrac: 0.12,
          brightFrac: 0.12,
        })
        if (!diff.ok) {
          failures.push(`${c.id}: golden mismatch: ${diff.failures.join('; ')}`)
        }
      }
    } catch (err) {
      failures.push(
        `${c.id}: golden read failed: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  process.stdout.write(
    JSON.stringify(
      {
        id: c.id,
        counts: result.counts,
        fracs: f,
        center: result.center,
        checksum: cs,
        ppm: ppmPath,
        probe: probe.summary,
      },
      null,
      0,
    ) + '\n',
  )
}

if (writeMode) {
  writeFileSync(goldenPath, JSON.stringify(goldens, null, 2) + '\n')
  process.stdout.write(`wrote goldens → ${goldenPath}\n`)
}

if (failures.length) {
  process.stderr.write('FAIL:\n' + failures.map((f) => `  - ${f}`).join('\n') + '\n')
  process.exit(1)
}

process.stdout.write(`OK ${CASES.length} cases\n`)
