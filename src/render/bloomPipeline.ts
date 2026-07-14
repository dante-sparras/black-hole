// @ts-nocheck
/**
 * WebGPU RenderPipeline: scene pass + Unreal-style bloom + tone map.
 * Import bloom from three addons TSL display nodes.
 */
import * as THREE from 'three/webgpu'
import { pass } from 'three/tsl'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'
import type { LookState } from '../state/look'

export type BloomPipeline = {
  render: () => void
  applyLook: (look: LookState) => void
  setSize: (width: number, height: number) => void
}

/**
 * Create post stack: scene → bloom (additive) → ACES via RenderPipeline.
 * Scene materials should output linear HDR (no in-shader tonemap).
 */
export function createBloomPipeline(
  renderer: THREE.WebGPURenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  initial: LookState,
): BloomPipeline {
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = initial.exposure

  const scenePass = pass(scene, camera)
  const sceneColor = scenePass.getTextureNode('output')

  const bloomPass = bloom(
    sceneColor,
    initial.bloomStrength,
    initial.bloomRadius,
    initial.bloomThreshold,
  )

  const pipeline = new THREE.RenderPipeline(renderer)
  // Soft filmic composite: base + bloom (pipeline applies tone mapping)
  let enabled = initial.bloomEnabled
  pipeline.outputNode = enabled ? sceneColor.add(bloomPass) : sceneColor
  pipeline.needsUpdate = true

  function rebuildOutput(on: boolean): void {
    enabled = on
    pipeline.outputNode = on ? sceneColor.add(bloomPass) : sceneColor
    pipeline.needsUpdate = true
  }

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
      if (look.bloomEnabled !== enabled) {
        rebuildOutput(look.bloomEnabled)
      }
    },
    setSize: (_w: number, _h: number) => {
      // PassNode tracks renderer size; no-op for API symmetry
    },
  }
}
