import { deriveGeometry } from '../physics/derive'
import type { BlackHoleParams, DerivedGeometry } from '../physics/types'
import { normalizeParams, type ParamsInput } from '../physics/validate'

type Listener = (params: BlackHoleParams, derived: DerivedGeometry) => void

let params: BlackHoleParams = normalizeParams({})
let derived: DerivedGeometry = deriveGeometry(params)
const listeners = new Set<Listener>()

export function getParams(): BlackHoleParams {
  return params
}

export function getDerived(): DerivedGeometry {
  return derived
}

export function setParams(input: ParamsInput): BlackHoleParams {
  params = normalizeParams({ ...params, ...input })
  derived = deriveGeometry(params)
  for (const listener of listeners) {
    listener(params, derived)
  }
  return params
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  listener(params, derived)
  return () => {
    listeners.delete(listener)
  }
}
