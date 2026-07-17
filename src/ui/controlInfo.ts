/**
 * 🛈 control info cards — hover or click to show a fixed-position popup.
 * Click pins open until outside/Escape; hover is temporary when not pinned.
 */
import { getControlHelp } from './controlHelp'

const CARD_ID = 'ctrl-info-card'
const HIDE_MS = 140

export type ControlInfoController = {
  destroy: () => void
}

export function mountControlInfo(root: HTMLElement): ControlInfoController {
  let card = document.getElementById(CARD_ID) as HTMLDivElement | null
  if (!card) {
    card = document.createElement('div')
    card.id = CARD_ID
    card.className = 'ctrl-info-card'
    card.hidden = true
    card.setAttribute('role', 'tooltip')
    document.body.appendChild(card)
  }

  let pinnedBtn: HTMLButtonElement | null = null
  let activeBtn: HTMLButtonElement | null = null
  let hideTimer: ReturnType<typeof setTimeout> | null = null

  function clearHideTimer(): void {
    if (hideTimer !== null) {
      clearTimeout(hideTimer)
      hideTimer = null
    }
  }

  function placeCard(btn: HTMLButtonElement): void {
    if (!card) return
    const r = btn.getBoundingClientRect()
    const pad = 8
    const cw = Math.min(280, window.innerWidth - pad * 2)
    card.style.width = `${cw}px`
    // Measure after content set
    card.hidden = false
    const ch = card.offsetHeight
    let left = r.right + 6
    let top = r.top
    if (left + cw > window.innerWidth - pad) {
      left = Math.max(pad, r.left - cw - 6)
    }
    if (top + ch > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - ch - pad)
    }
    if (top < pad) top = pad
    card.style.left = `${Math.round(left)}px`
    card.style.top = `${Math.round(top)}px`
  }

  function fillCard(id: string): boolean {
    if (!card) return false
    const help = getControlHelp(id)
    if (!help) return false
    card.innerHTML = `
      <div class="ctrl-info-title">${escapeHtml(help.title)}</div>
      <div class="ctrl-info-summary">${escapeHtml(help.summary)}</div>
      <div class="ctrl-info-body">${escapeHtml(help.body)}</div>
    `
    return true
  }

  function show(btn: HTMLButtonElement, pin: boolean): void {
    const id = btn.dataset.help
    if (!id || !card) return
    clearHideTimer()
    if (!fillCard(id)) return
    activeBtn = btn
    if (pin) {
      pinnedBtn = btn
      card.dataset.pinned = '1'
    } else if (pinnedBtn !== btn) {
      card.dataset.pinned = '0'
    }
    for (const b of root.querySelectorAll<HTMLButtonElement>('.ctrl-info')) {
      b.setAttribute('aria-expanded', b === btn ? 'true' : 'false')
    }
    placeCard(btn)
  }

  function hide(force = false): void {
    if (!card) return
    if (!force && pinnedBtn) return
    clearHideTimer()
    card.hidden = true
    card.dataset.pinned = '0'
    activeBtn = null
    pinnedBtn = null
    for (const b of root.querySelectorAll<HTMLButtonElement>('.ctrl-info')) {
      b.setAttribute('aria-expanded', 'false')
    }
  }

  function scheduleHide(): void {
    if (pinnedBtn) return
    clearHideTimer()
    hideTimer = setTimeout(() => hide(false), HIDE_MS)
  }

  function onRootClick(ev: MouseEvent): void {
    const t = ev.target
    if (!(t instanceof Element)) return
    const btn = t.closest<HTMLButtonElement>('.ctrl-info')
    if (!btn || !root.contains(btn)) return
    ev.preventDefault()
    ev.stopPropagation()
    if (pinnedBtn === btn && !card?.hidden) {
      hide(true)
      return
    }
    show(btn, true)
  }

  function onRootPointerOver(ev: PointerEvent): void {
    const t = ev.target
    if (!(t instanceof Element)) return
    const btn = t.closest<HTMLButtonElement>('.ctrl-info')
    if (!btn || !root.contains(btn)) return
    if (pinnedBtn && pinnedBtn !== btn) return
    show(btn, false)
  }

  function onRootPointerOut(ev: PointerEvent): void {
    const t = ev.target
    if (!(t instanceof Element)) return
    const btn = t.closest<HTMLButtonElement>('.ctrl-info')
    if (!btn) return
    const related = ev.relatedTarget
    if (related instanceof Node && btn.contains(related)) return
    if (related instanceof Node && card?.contains(related)) return
    scheduleHide()
  }

  function onCardEnter(): void {
    clearHideTimer()
  }

  function onCardLeave(): void {
    scheduleHide()
  }

  function onDocPointerDown(ev: PointerEvent): void {
    if (!pinnedBtn || !card || card.hidden) return
    const t = ev.target
    if (!(t instanceof Node)) return
    if (card.contains(t)) return
    if (t instanceof Element && t.closest('.ctrl-info')) return
    hide(true)
  }

  function onKey(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') hide(true)
  }

  function onScrollOrResize(): void {
    if (card?.hidden || !activeBtn) return
    placeCard(activeBtn)
  }

  root.addEventListener('click', onRootClick)
  root.addEventListener('pointerover', onRootPointerOver)
  root.addEventListener('pointerout', onRootPointerOut)
  card.addEventListener('pointerenter', onCardEnter)
  card.addEventListener('pointerleave', onCardLeave)
  document.addEventListener('pointerdown', onDocPointerDown, true)
  document.addEventListener('keydown', onKey)
  window.addEventListener('resize', onScrollOrResize)
  // HUD scrolls inside #hud
  root.closest('#hud')?.addEventListener('scroll', onScrollOrResize, { passive: true })

  return {
    destroy: () => {
      clearHideTimer()
      root.removeEventListener('click', onRootClick)
      root.removeEventListener('pointerover', onRootPointerOver)
      root.removeEventListener('pointerout', onRootPointerOut)
      card?.removeEventListener('pointerenter', onCardEnter)
      card?.removeEventListener('pointerleave', onCardLeave)
      document.removeEventListener('pointerdown', onDocPointerDown, true)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onScrollOrResize)
      hide(true)
      card?.remove()
      card = null
    },
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br/>')
}
