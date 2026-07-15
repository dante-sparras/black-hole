/**
 * Image checksums + golden comparison (P2/P4).
 */
export type ImageChecksum = {
  width: number
  height: number
  /** Mean luma 0–1 */
  meanLuma: number
  /** Mean R,G,B 0–1 */
  meanRgb: [number, number, number]
  /** Center 3×3 mean luma */
  centerLuma: number
  /** Fraction of near-black pixels (luma < 0.02) */
  blackFrac: number
  /** Fraction of bright pixels (luma > 0.15) */
  brightFrac: number
  /** Simple hash for exact regression */
  hash: string
}

function luma(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

/**
 * Compute checksums from row-major RGB bytes (0–255).
 */
export function checksumRgb(
  width: number,
  height: number,
  rgb: Uint8Array,
): ImageChecksum {
  let sumR = 0
  let sumG = 0
  let sumB = 0
  let sumL = 0
  let black = 0
  let bright = 0
  let h = 2166136261 >>> 0
  const n = width * height

  for (let i = 0; i < n; i++) {
    const o = i * 3
    const r = rgb[o]!
    const g = rgb[o + 1]!
    const b = rgb[o + 2]!
    sumR += r
    sumG += g
    sumB += b
    const L = luma(r, g, b)
    sumL += L
    if (L < 0.02) black++
    if (L > 0.15) bright++
    // FNV-1a style mix
    h ^= r
    h = Math.imul(h, 16777619)
    h ^= g
    h = Math.imul(h, 16777619)
    h ^= b
    h = Math.imul(h, 16777619)
  }

  // Center 3×3
  let cSum = 0
  let cN = 0
  const cx = Math.floor(width / 2)
  const cy = Math.floor(height / 2)
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = cx + dx
      const y = cy + dy
      if (x < 0 || y < 0 || x >= width || y >= height) continue
      const o = (y * width + x) * 3
      cSum += luma(rgb[o]!, rgb[o + 1]!, rgb[o + 2]!)
      cN++
    }
  }

  return {
    width,
    height,
    meanLuma: sumL / n,
    meanRgb: [sumR / n / 255, sumG / n / 255, sumB / n / 255],
    centerLuma: cN ? cSum / cN : 0,
    blackFrac: black / n,
    brightFrac: bright / n,
    hash: (h >>> 0).toString(16).padStart(8, '0'),
  }
}

export type ChecksumTolerance = {
  meanLuma?: number
  centerLuma?: number
  blackFrac?: number
  brightFrac?: number
  /** If true, require exact hash match */
  exactHash?: boolean
}

export type ChecksumDiff = {
  ok: boolean
  failures: string[]
  actual: ImageChecksum
  expected: ImageChecksum
}

/**
 * Compare checksums with absolute tolerances (defaults suit fate-color PPMs).
 */
export function compareChecksums(
  actual: ImageChecksum,
  expected: ImageChecksum,
  tol: ChecksumTolerance = {},
): ChecksumDiff {
  const failures: string[] = []
  const meanTol = tol.meanLuma ?? 0.04
  const centerTol = tol.centerLuma ?? 0.05
  const blackTol = tol.blackFrac ?? 0.08
  const brightTol = tol.brightFrac ?? 0.08

  if (actual.width !== expected.width || actual.height !== expected.height) {
    failures.push(
      `size ${actual.width}x${actual.height} ≠ ${expected.width}x${expected.height}`,
    )
  }
  if (Math.abs(actual.meanLuma - expected.meanLuma) > meanTol) {
    failures.push(
      `meanLuma ${actual.meanLuma.toFixed(4)} vs ${expected.meanLuma.toFixed(4)} (tol ${meanTol})`,
    )
  }
  if (Math.abs(actual.centerLuma - expected.centerLuma) > centerTol) {
    failures.push(
      `centerLuma ${actual.centerLuma.toFixed(4)} vs ${expected.centerLuma.toFixed(4)}`,
    )
  }
  if (Math.abs(actual.blackFrac - expected.blackFrac) > blackTol) {
    failures.push(
      `blackFrac ${actual.blackFrac.toFixed(3)} vs ${expected.blackFrac.toFixed(3)}`,
    )
  }
  if (Math.abs(actual.brightFrac - expected.brightFrac) > brightTol) {
    failures.push(
      `brightFrac ${actual.brightFrac.toFixed(3)} vs ${expected.brightFrac.toFixed(3)}`,
    )
  }
  if (tol.exactHash && actual.hash !== expected.hash) {
    failures.push(`hash ${actual.hash} ≠ ${expected.hash}`)
  }

  return { ok: failures.length === 0, failures, actual, expected }
}

/** Compact golden record for JSON fixtures */
export type GoldenRecord = {
  id: string
  description: string
  params: { mass: number; spinStar: number; charge: number }
  width: number
  height: number
  checksum: ImageChecksum
  /** Topology fractions */
  topology: {
    captureFrac: number
    diskFrac: number
    escapeFrac: number
    maxFrac: number
    centerFate: string
  }
}
