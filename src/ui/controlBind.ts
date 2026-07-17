/** Small DOM bind helpers for the controls panel. */

export function qs<T extends Element>(root: ParentNode, sel: string): T | null {
  return root.querySelector<T>(sel)
}

export function bindRange(
  input: HTMLInputElement | null,
  onInput: (value: number) => void,
): void {
  input?.addEventListener('input', () => {
    onInput(Number(input.value))
  })
}

/**
 * Editable number field (paired with a range slider).
 * Commits on change (blur) and Enter; ignores non-finite while typing.
 */
export function bindNumber(
  input: HTMLInputElement | null,
  onCommit: (value: number) => void,
  opts?: {
    /** Clamp/normalize before commit (e.g. map into limits). */
    parse?: (raw: number) => number
  },
): void {
  if (!input) return
  const commit = (): void => {
    const raw = Number(input.value)
    if (!Number.isFinite(raw)) return
    const v = opts?.parse ? opts.parse(raw) : raw
    if (!Number.isFinite(v)) return
    onCommit(v)
  }
  input.addEventListener('change', commit)
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault()
      commit()
      input.blur()
    }
  })
}

export function bindCheckbox(
  input: HTMLInputElement | null,
  onChange: (checked: boolean) => void,
): void {
  input?.addEventListener('change', () => {
    onChange(Boolean(input.checked))
  })
}

export function bindSelect(
  select: HTMLSelectElement | null,
  onChange: (value: string) => void,
): void {
  select?.addEventListener('change', () => {
    onChange(select.value)
  })
}

export function setRangeValue(input: HTMLInputElement | null, value: number | string): void {
  if (input) input.value = String(value)
}

/** Update a number input unless the user is mid-edit (focused). */
export function setNumValue(
  input: HTMLInputElement | null,
  value: number | string,
  opts?: { force?: boolean },
): void {
  if (!input) return
  if (!opts?.force && document.activeElement === input) return
  input.value = String(value)
}

export function setText(el: HTMLElement | null, text: string): void {
  if (el) el.textContent = text
}
