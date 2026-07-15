/**
 * Structured debug log — no raw console spam in production paths.
 * Ring buffer for HUD; optional DEV console when enabled.
 */
export type DebugLevel = 'info' | 'warn' | 'error'

export type DebugEntry = {
  t: number
  level: DebugLevel
  code: string
  message: string
  data?: Record<string, number | string | boolean | null>
}

const MAX = 40
const ring: DebugEntry[] = []
type Listener = (entries: readonly DebugEntry[]) => void
const listeners = new Set<Listener>()

let consoleMirror = false

export function setDebugConsoleMirror(on: boolean): void {
  consoleMirror = on
}

export function getDebugLog(): readonly DebugEntry[] {
  return ring
}

export function clearDebugLog(): void {
  ring.length = 0
  for (const fn of listeners) fn(ring)
}

function push(level: DebugLevel, code: string, message: string, data?: DebugEntry['data']): void {
  const entry: DebugEntry = { t: Date.now(), level, code, message, data }
  ring.push(entry)
  while (ring.length > MAX) ring.shift()
  for (const fn of listeners) fn(ring)
  if (consoleMirror && typeof console !== 'undefined') {
    const line = `[${level}] ${code}: ${message}`
    if (level === 'error') console.error(line, data ?? '')
    else if (level === 'warn') console.warn(line, data ?? '')
    else console.info(line, data ?? '')
  }
}

export const debugLog = {
  info: (code: string, message: string, data?: DebugEntry['data']) =>
    push('info', code, message, data),
  warn: (code: string, message: string, data?: DebugEntry['data']) =>
    push('warn', code, message, data),
  error: (code: string, message: string, data?: DebugEntry['data']) =>
    push('error', code, message, data),
}

export function subscribeDebugLog(listener: Listener): () => void {
  listeners.add(listener)
  listener(ring)
  return () => {
    listeners.delete(listener)
  }
}
