import { useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { useGLTF } from "@react-three/drei"
import {
  Box3,
  Color,
  MathUtils,
  MeshStandardMaterial,
  Vector3,
  type Group,
  type Mesh,
} from "three"
import { useGame } from "../game/store"
import { objectFor, slotWorldPos, panForWord } from "../game/config"
import { audio } from "../audio/AudioEngine"
import { charWorldPos, shake } from "./sceneBus"

const MODEL_URL = "/models/squirrel.glb"
const HEIGHT = 1.15 // normalized standing height in world units

const smoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)

/**
 * The squirrel model ("Squirrel" by Poly by Google, CC-BY, via poly.pizza),
 * normalized to HEIGHT with feet at y=0, tinted with the player's fur color,
 * plus an accent scarf. Shared by the game and the customizer preview.
 */
export function SquirrelModel({ fur, accent, spin = false }: { fur: string; accent: string; spin?: boolean }) {
  const { scene } = useGLTF(MODEL_URL)

  const { model, dims } = useMemo(() => {
    const s = scene.clone(true)
    // the asset is authored Z-up — stand it upright in our Y-up world
    s.rotation.x = -Math.PI / 2
    s.updateMatrixWorld(true)
    const box = new Box3().setFromObject(s)
    const size = box.getSize(new Vector3())
    const scale = HEIGHT / size.y
    s.scale.setScalar(scale)
    s.updateMatrixWorld(true)
    const box2 = new Box3().setFromObject(s)
    const c = box2.getCenter(new Vector3())
    s.position.set(-c.x, -box2.min.y, -c.z)
    const d = box2.getSize(new Vector3())
    return { model: s, dims: d }
  }, [scene])

  useEffect(() => {
    model.traverse((o) => {
      const m = o as Mesh
      if (m.isMesh) {
        m.material = new MeshStandardMaterial({ color: new Color(fur), roughness: 0.55, metalness: 0 })
        m.castShadow = true
      }
    })
  }, [model, fur])

  const g = useRef<Group>(null)
  useFrame((_, dt) => {
    if (spin && g.current) g.current.rotation.y += dt * 0.9
  })

  return (
    <group ref={g}>
      <primitive object={model} />
      {/* accent scarf — a snug ring around the neck */}
      <mesh position={[0, dims.y * 0.56, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[dims.z * 0.55, dims.z * 0.16, 10, 22]} />
        <meshStandardMaterial color={accent} roughness={0.6} />
      </mesh>
    </group>
  )
}

useGLTF.preload(MODEL_URL)

type Mode = "move" | "stagger" | "drop" | "recover"

/** The player character: hops the words, staggers + drops + recovers on a slip. */
export default function Character() {
  const look = useGame((s) => s.character)

  const root = useRef<Group>(null) // world position
  const body = useRef<Group>(null) // squash/tilt/tumble
  const from = useRef(new Vector3())
  const to = useRef(new Vector3())
  const goal = useRef(new Vector3())
  const dropEnd = useRef(new Vector3())
  const mode = useRef<Mode>("move")
  const t = useRef(1)
  const dur = useRef(0.2)
  const arc = useRef(0)
  const yaw = useRef(0)
  const tumble = useRef(0)
  const lastSlip = useRef(useGame.getState().slipNonce)
  const inited = useRef(false)

  useFrame(({ camera, clock }, dt) => {
    const g = root.current
    const b = body.current
    if (!g || !b) return
    const st = useGame.getState()
    const { baseWord, wi, ci, words } = st
    const W = baseWord + wi
    const len = words[wi]?.length ?? 1
    const slot = Math.min(ci, len - 1)
    const [gx, gy, gz] = slotWorldPos(W, slot, len)
    goal.current.set(gx, gy + objectFor(W).halfHeight, gz)

    if (!inited.current) {
      g.position.copy(goal.current)
      to.current.copy(goal.current)
      inited.current = true
    }

    // --- slip! begin the stagger -> drop -> recover sequence ---
    if (st.slipNonce !== lastSlip.current) {
      lastSlip.current = st.slipNonce
      mode.current = "stagger"
      t.current = 0
      dur.current = 0.22
      from.current.copy(g.position)
      to.current.copy(goal.current)
      // drop lands mostly straight down: only ~35% horizontal drift during the fall
      dropEnd.current.set(
        from.current.x + (to.current.x - from.current.x) * 0.35,
        to.current.y,
        from.current.z + (to.current.z - from.current.z) * 0.35
      )
    }

    // normal typing continues to move the target; track it while moving
    if (mode.current === "move" && goal.current.distanceToSquared(to.current) > 0.0004) {
      from.current.copy(g.position)
      to.current.copy(goal.current)
      t.current = 0
      const horiz = Math.hypot(to.current.x - from.current.x, to.current.z - from.current.z)
      dur.current = MathUtils.clamp(0.13 + horiz * 0.04, 0.13, 0.4)
      arc.current = Math.min(0.9, horiz * 0.16 + 0.14)
    }

    t.current = Math.min(1, t.current + dt / dur.current)
    const tt = t.current
    let airStretch = 0

    if (mode.current === "stagger") {
      // wobble in place — the "!" moment
      g.position.copy(from.current)
      b.rotation.z = Math.sin(tt * 26) * 0.24 * (1 - tt * 0.5)
      if (tt >= 1) {
        mode.current = "drop"
        t.current = 0
        const dropH = Math.max(0.5, from.current.y - dropEnd.current.y)
        dur.current = 0.35 + Math.min(0.35, dropH * 0.08)
      }
    } else if (mode.current === "drop") {
      // gravity-accelerated, nearly-straight-down fall with a slow tumble
      const eY = tt * tt
      g.position.x = MathUtils.lerp(from.current.x, dropEnd.current.x, smoother(tt))
      g.position.z = MathUtils.lerp(from.current.z, dropEnd.current.z, smoother(tt))
      g.position.y = MathUtils.lerp(from.current.y, dropEnd.current.y, eY)
      tumble.current += dt * 7
      airStretch = 0.15
      if (tt >= 1) {
        mode.current = "recover"
        t.current = 0
        dur.current = 0.28
        from.current.copy(g.position)
        to.current.copy(goal.current) // land on the live target (player may have typed)
        audio.playThud(panForWord(W))
        shake(0.55)
      }
    } else if (mode.current === "recover") {
      // sheepish little hop from where we crashed onto our key
      const e = smoother(tt)
      g.position.lerpVectors(from.current, to.current, e)
      g.position.y += Math.sin(Math.PI * tt) * 0.4
      tumble.current = MathUtils.damp(tumble.current % (Math.PI * 2), 0, 10, dt)
      airStretch = Math.sin(Math.PI * tt) * 0.12
      if (tt >= 1) {
        mode.current = "move"
        to.current.copy(goal.current)
      }
    } else {
      // normal hop between letters/words
      const e = smoother(tt)
      g.position.lerpVectors(from.current, to.current, e)
      g.position.y += Math.sin(Math.PI * tt) * arc.current
      airStretch = Math.sin(Math.PI * tt) * 0.16
      tumble.current = MathUtils.damp(tumble.current, 0, 10, dt)
      b.rotation.z = MathUtils.damp(b.rotation.z, 0, 8, dt)
    }

    // facing: travel direction while moving, drift toward camera when idle
    const dx = to.current.x - from.current.x
    const dz = to.current.z - from.current.z
    const moving = tt < 1 && Math.hypot(dx, dz) > 0.05 && mode.current !== "stagger"
    const targetYaw = moving
      ? Math.atan2(dx, dz)
      : Math.atan2(camera.position.x - g.position.x, camera.position.z - g.position.z)
    yaw.current = MathUtils.damp(yaw.current, targetYaw, 6, dt)
    b.rotation.y = yaw.current
    b.rotation.x = tumble.current

    // squash & stretch + idle breathe
    const breathe = mode.current === "move" && tt >= 1 ? Math.sin(clock.elapsedTime * 3) * 0.02 : 0
    b.scale.set(1 - airStretch * 0.4 + breathe, 1 + airStretch - breathe, 1 - airStretch * 0.4 + breathe)

    charWorldPos.copy(g.position)
  })

  return (
    <group ref={root}>
      <group ref={body}>
        <SquirrelModel fur={look.fur} accent={look.accent} />
      </group>
    </group>
  )
}
