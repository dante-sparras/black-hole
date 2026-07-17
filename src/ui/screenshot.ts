/**
 * Capture the live WebGPU/WebGL canvas and trigger a PNG download
 * at the canvas's current pixel resolution (includes DPR).
 */

export type ScreenshotCaptureOpts = {
  /** Force one more present so the drawable buffer is fresh. */
  renderFrame: () => void
  /** Canvas that shows the final composite (renderer.domElement). */
  getCanvas: () => HTMLCanvasElement
  /** Optional basename prefix (default black-hole). */
  prefix?: string
  /** Extra tags for the filename (e.g. a★, quality). */
  tags?: string[]
}

export type ScreenshotResult = {
  width: number
  height: number
  filename: string
  blob: Blob
}

/** Safe filename segment from free text. */
export function slugTag(s: string): string {
  return s
    .trim()
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40)
}

export function buildScreenshotFilename(
  width: number,
  height: number,
  opts?: { prefix?: string; tags?: string[]; date?: Date },
): string {
  const prefix = slugTag(opts?.prefix ?? 'black-hole') || 'black-hole'
  const d = opts?.date ?? new Date()
  const iso = d.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
  const tags = (opts?.tags ?? []).map(slugTag).filter(Boolean)
  const mid = tags.length ? `_${tags.join('_')}` : ''
  return `${prefix}_${width}x${height}${mid}_${iso}.png`
}

function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png'): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (typeof canvas.toBlob === 'function') {
      canvas.toBlob((blob) => {
        if (blob && blob.size > 0) resolve(blob)
        else {
          // Fallback for some WebGPU present paths
          try {
            const dataUrl = canvas.toDataURL(type)
            const bin = dataUrlToBlob(dataUrl)
            if (bin.size > 0) resolve(bin)
            else reject(new Error('Empty canvas capture (toBlob/toDataURL).'))
          } catch (err) {
            reject(err instanceof Error ? err : new Error(String(err)))
          }
        }
      }, type)
      return
    }
    try {
      resolve(dataUrlToBlob(canvas.toDataURL(type)))
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)))
    }
  })
}

function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',')
  const mime = parts[0]?.match(/:(.*?);/)?.[1] ?? 'image/png'
  const bin = atob(parts[1] ?? '')
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke after the browser has a chance to start the download
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000)
}

/**
 * Render once (double-rAF so WebGPU presents), snapshot canvas pixels, download PNG.
 */
export async function captureAndDownloadScreenshot(
  opts: ScreenshotCaptureOpts,
): Promise<ScreenshotResult> {
  const canvas = opts.getCanvas()
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Screenshot target is not a canvas.')
  }

  // Two frames: first runs user render, second waits for GPU present
  await new Promise<void>((r) => requestAnimationFrame(() => r()))
  opts.renderFrame()
  await new Promise<void>((r) => requestAnimationFrame(() => r()))
  // Some backends present a frame later — one more present+paint
  opts.renderFrame()
  await new Promise<void>((r) => requestAnimationFrame(() => r()))

  const width = canvas.width
  const height = canvas.height
  if (width < 1 || height < 1) {
    throw new Error('Canvas has zero size — nothing to capture.')
  }

  const blob = await canvasToBlob(canvas)
  const filename = buildScreenshotFilename(width, height, {
    prefix: opts.prefix,
    tags: opts.tags,
  })
  downloadBlob(blob, filename)
  return { width, height, filename, blob }
}
