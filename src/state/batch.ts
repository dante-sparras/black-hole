/**
 * Store notification batching.
 * Nested withBatch merges into the outermost flush.
 * emitStore(id, fn) defers one notify per id (latest wins) until flush.
 */
let depth = 0
const pending = new Map<string, () => void>()

export function isBatching(): boolean {
  return depth > 0
}

/** Run mutations with a single end-of-batch notify flush. */
export function withBatch(run: () => void): void {
  depth++
  try {
    run()
  } finally {
    depth--
    if (depth === 0) flush()
  }
}

/**
 * Notify listeners now, or once at end of batch (keyed so multi-set of same store = one fire).
 */
export function emitStore(id: string, notify: () => void): void {
  if (depth > 0) {
    pending.set(id, notify)
    return
  }
  notify()
}

function flush(): void {
  if (pending.size === 0) return
  const jobs = [...pending.values()]
  pending.clear()
  for (const job of jobs) job()
}
