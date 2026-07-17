/**
 * Mobile-friendly HUD: collapse panels, auto low quality, viewport resize.
 */
import { setQuality } from '../state/quality'

export type MobileHudHandles = {
  dispose: () => void
  isMobile: () => boolean
}

const MQ = '(max-width: 768px), (pointer: coarse) and (max-height: 900px)'

export function mountMobileHud(): MobileHudHandles {
  const hud = document.getElementById('hud')
  const toggle = document.getElementById('hud-toggle') as HTMLButtonElement | null
  const hint = document.getElementById('hud-hint')

  const mq = window.matchMedia(MQ)

  function applyLayout(): void {
    const mobile = mq.matches
    document.documentElement.classList.toggle('is-mobile', mobile)
    if (hint) {
      hint.textContent = mobile
        ? 'Drag canvas to orbit · pinch zoom · tap Panels for controls.'
        : 'Drag to orbit · scroll/pinch zoom · click to probe ray (Debug).'
    }
    if (!mobile && hud) {
      // Desktop: always expanded
      hud.classList.remove('hud-collapsed')
      toggle?.setAttribute('aria-expanded', 'true')
    }
  }

  function onToggle(): void {
    if (!hud || !toggle) return
    const collapsed = hud.classList.toggle('hud-collapsed')
    toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true')
    toggle.textContent = collapsed ? 'Panels' : 'Hide'
  }

  // Prefer low quality on phones for interactive WebGPU
  if (mq.matches) {
    setQuality('low')
    // Start collapsed so the disk is fully visible
    hud?.classList.add('hud-collapsed')
    toggle?.setAttribute('aria-expanded', 'false')
    if (toggle) toggle.textContent = 'Panels'
  }

  applyLayout()
  mq.addEventListener('change', applyLayout)
  toggle?.addEventListener('click', onToggle)

  // visualViewport helps when mobile browser chrome shows/hides
  const vv = window.visualViewport
  const onVv = (): void => {
    const h = vv?.height ?? window.innerHeight
    document.documentElement.style.setProperty('--vv-height', `${h}px`)
  }
  onVv()
  vv?.addEventListener('resize', onVv)
  vv?.addEventListener('scroll', onVv)

  return {
    dispose: () => {
      mq.removeEventListener('change', applyLayout)
      toggle?.removeEventListener('click', onToggle)
      vv?.removeEventListener('resize', onVv)
      vv?.removeEventListener('scroll', onVv)
    },
    isMobile: () => mq.matches,
  }
}
