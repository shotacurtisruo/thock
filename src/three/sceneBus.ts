import { Vector3 } from "three"

/** Character's live world position — written by Character each frame, read by the camera. */
export const charWorldPos = new Vector3(0, 0, 0)

/** Decaying camera-shake impulse (0..1). Camera consumes + decays it. */
export const shakeBus = { v: 0 }

export function shake(intensity: number) {
  shakeBus.v = Math.max(shakeBus.v, intensity)
}
