import {
  CAMERA_LIMITS,
  getCamera,
  setCamera,
  type CameraState,
} from '../state/camera'

export type OrbitHandles = {
  dispose: () => void
  /** True if last pointer gesture moved more than a few pixels (orbit drag). */
  didDrag: () => boolean
}

/**
 * Pointer/touch orbit + wheel zoom on the canvas.
 * Horizontal drag → azimuth, vertical drag → inclination, wheel → distance.
 * Ignores events that start on the HUD (controls keep working).
 */
export function mountOrbitControls(
  canvas: HTMLElement,
  onChange?: (cam: CameraState) => void,
): OrbitHandles {
  let dragging = false
  let lastX = 0
  let lastY = 0
  let pointerId: number | null = null
  let dragDist = 0
  let lastDragDist = 0

  const DRAG_SENS = 0.005
  const WHEEL_SENS = 0.0015
  const PINCH_SENS = 0.01

  let pinchStartDist = 0
  let pinchStartCamDist = 0

  function emit(): void {
    onChange?.(getCamera())
  }

  function onPointerDown(e: PointerEvent): void {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    // Don't steal sliders / HUD
    const t = e.target as HTMLElement | null
    if (t?.closest?.('#hud')) return

    dragging = true
    dragDist = 0
    lastX = e.clientX
    lastY = e.clientY
    pointerId = e.pointerId
    canvas.setPointerCapture(e.pointerId)
    canvas.style.cursor = 'grabbing'
  }

  function onPointerMove(e: PointerEvent): void {
    if (!dragging || pointerId !== e.pointerId) return
    const dx = e.clientX - lastX
    const dy = e.clientY - lastY
    dragDist += Math.hypot(dx, dy)
    lastX = e.clientX
    lastY = e.clientY

    const cam = getCamera()
    setCamera({
      azimuth: cam.azimuth - dx * DRAG_SENS,
      inclination: cam.inclination + dy * DRAG_SENS,
    })
    emit()
  }

  function onPointerUp(e: PointerEvent): void {
    if (pointerId !== e.pointerId) return
    lastDragDist = dragDist
    dragging = false
    pointerId = null
    try {
      canvas.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
    canvas.style.cursor = 'grab'
  }

  function onWheel(e: WheelEvent): void {
    e.preventDefault()
    const cam = getCamera()
    // Exponential zoom feels better across large distance range
    const factor = Math.exp(e.deltaY * WHEEL_SENS)
    setCamera({ distanceM: cam.distanceM * factor })
    emit()
  }

  // Two-finger pinch zoom (touch)
  function touchDist(a: Touch, b: Touch): number {
    const dx = a.clientX - b.clientX
    const dy = a.clientY - b.clientY
    return Math.hypot(dx, dy)
  }

  function onTouchStart(e: TouchEvent): void {
    if (e.touches.length === 2) {
      pinchStartDist = touchDist(e.touches[0], e.touches[1])
      pinchStartCamDist = getCamera().distanceM
      dragging = false
    }
  }

  function onTouchMove(e: TouchEvent): void {
    if (e.touches.length === 2 && pinchStartDist > 0) {
      e.preventDefault()
      const d = touchDist(e.touches[0], e.touches[1])
      const ratio = pinchStartDist / Math.max(d, 1e-3)
      // pinch out → zoom in (smaller distance)
      setCamera({
        distanceM: pinchStartCamDist * Math.pow(ratio, PINCH_SENS * 40),
      })
      emit()
    }
  }

  function onTouchEnd(e: TouchEvent): void {
    if (e.touches.length < 2) {
      pinchStartDist = 0
    }
  }

  canvas.style.cursor = 'grab'
  canvas.style.touchAction = 'none'

  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointercancel', onPointerUp)
  canvas.addEventListener('wheel', onWheel, { passive: false })
  canvas.addEventListener('touchstart', onTouchStart, { passive: true })
  canvas.addEventListener('touchmove', onTouchMove, { passive: false })
  canvas.addEventListener('touchend', onTouchEnd)
  canvas.addEventListener('touchcancel', onTouchEnd)

  return {
    dispose: () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onTouchEnd)
      canvas.removeEventListener('touchcancel', onTouchEnd)
      canvas.style.cursor = ''
      canvas.style.touchAction = ''
    },
    didDrag: () => lastDragDist > 6,
  }
}

export { CAMERA_LIMITS }
