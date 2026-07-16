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

export function setText(el: HTMLElement | null, text: string): void {
  if (el) el.textContent = text
}
