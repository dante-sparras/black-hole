// @ts-nocheck
/**
 * WebGPU RenderPipeline: supersampled scene → bloom → SMAA → tone map.
 *
 * AA strategy (no dens/physics changes):
 *  1. Render the full-screen geodesic at resolutionScale > 1 (spatial supersample)
 *  2. Optional SSAA multi-jitter (2–4 samples) for quality tiers
 *  3. SMAA morphological clean-up on the linear composite
 */
import * as THREE from 'three/webgpu'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'
import { smaa } from 'three/addons/tsl/display/SMAANode.js'
import { ssaaPass } from 'three/addons/tsl/display/SSAAPassNode.js'
import { pass } from 'three/tsl'
import type { LookState } from '../state/look'
import type { QualityLevel } from '../state/quality'

export type BloomPipeline = {
  render: () => void
  applyLook: (look: LookState) => void
  setSize: (width: number, height: number) => void
  /** Match AA cost/quality to render tier (resolution scale + SSAA samples). */
  setQualityLevel: (level: QualityLevel) => void
}

/** Spatial supersample scale per quality (1 = native). */
const AA_RES: Record<QualityLevel, number> = {
  low: 1.35,
  med: 1.65,
  high: 2.0,
}

/**
 * SSAA sampleLevel n → 2^n samples. 0 = single pass (no SSAA re-renders).
 * Low stays single-pass + res scale (mobile-friendly).
 */
const AA_SSAA_LEVEL: Record<QualityLevel, number> = {
  low: 0,
  med: 1, // 2 samples
  high: 2, // 4 samples
}

/**
 * Create post stack: scene (SSAA/supersampled) → bloom → SMAA → ACES.
 */
export function createBloomPipeline(
  renderer: THREE.WebGPURenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  initial: LookState,
  initialQuality: QualityLevel = 'med',
): BloomPipeline {
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = initial.exposure

  // Dual path: cheap single pass vs SSAA multi-jitter (shared rebuild)
  const singlePass = pass(scene, camera)
  const multiPass = ssaaPass(scene, camera)
  multiPass.sampleLevel = 1
  multiPass.unbiased = true

  let level: QualityLevel = initialQuality
  let useSsaa = AA_SSAA_LEVEL[level] > 0
  let activePass = useSsaa ? multiPass : singlePass
  applyPassAa(activePass, level)

  let sceneColor = activePass.getTextureNode('output')
  let bloomPass = bloom(
    sceneColor,
    initial.bloomStrength,
    initial.bloomRadius,
    initial.bloomThreshold,
  )

  const pipeline = new THREE.RenderPipeline(renderer)
  let bloomOn = initial.bloomEnabled

  function applyPassAa(p, qLevel: QualityLevel) {
    const scale = AA_RES[qLevel]
    if (typeof p.setResolutionScale === 'function') {
      p.setResolutionScale(scale)
    }
    if (p.isSSAAPassNode || p.sampleLevel !== undefined) {
      p.sampleLevel = Math.max(1, AA_SSAA_LEVEL[qLevel])
    }
  }

  function composite(on: boolean) {
    const base = on ? sceneColor.add(bloomPass) : sceneColor
    return smaa(base)
  }

  function rebuildGraph() {
    useSsaa = AA_SSAA_LEVEL[level] > 0
    activePass = useSsaa ? multiPass : singlePass
    applyPassAa(activePass, level)
    sceneColor = activePass.getTextureNode('output')
    // Rebuild bloom so it samples the active scene texture
    bloomPass = bloom(
      sceneColor,
      bloomPass.strength?.value ?? initial.bloomStrength,
      bloomPass.radius?.value ?? initial.bloomRadius,
      bloomPass.threshold?.value ?? initial.bloomThreshold,
    )
    pipeline.outputNode = composite(bloomOn)
    pipeline.needsUpdate = true
  }

  pipeline.outputNode = composite(bloomOn)
  pipeline.needsUpdate = true

  function setUniform(node: { value?: number }, v: number): void {
    if (node && typeof node === 'object' && 'value' in node) {
      node.value = v
    }
  }

  return {
    render: () => {
      pipeline.render()
    },
    applyLook: (look: LookState) => {
      renderer.toneMappingExposure = look.exposure
      setUniform(bloomPass.strength, look.bloomStrength)
      setUniform(bloomPass.radius, look.bloomRadius)
      setUniform(bloomPass.threshold, look.bloomThreshold)
      if (look.bloomEnabled !== bloomOn) {
        bloomOn = look.bloomEnabled
        pipeline.outputNode = composite(bloomOn)
        pipeline.needsUpdate = true
      }
    },
    setSize: (_w: number, _h: number) => {
      // PassNode / SMAA / SSAA track renderer size in updateBefore
    },
    setQualityLevel: (qLevel: QualityLevel) => {
      if (qLevel === level) {
        applyPassAa(activePass, qLevel)
        return
      }
      level = qLevel
      rebuildGraph()
    },
  }
}
