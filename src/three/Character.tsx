import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { CatmullRomCurve3, MathUtils, Vector3, type Group } from "three"
import { useGame } from "../game/store"
import { objectFor, slotWorldPos, panForWord } from "../game/config"
import { audio } from "../audio/AudioEngine"
import { charWorldPos, shake } from "./sceneBus"

const smoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)

const PINK = "#ff9ec2"
const CREAM = "#fff6ee"
const INK = "#1c1c28"

/**
 * A chibi kitten built from primitives — glossy candy style, ~1.1 units tall,
 * facing +Z. Fur + scarf colors are customizable; the tail sways on its own
 * and swings harder while moving. Shared by the game and the customizer.
 */
export function KittenModel({ fur, accent, spin = false }: { fur: string; accent: string; spin?: boolean }) {
  const g = useRef<Group>(null)
  const tail = useRef<Group>(null)
  const prevPos = useRef(new Vector3())
  const swing = useRef(0)

  const tailCurve = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(0, 0.22, -0.26),
        new Vector3(0.06, 0.14, -0.48),
        new Vector3(0.17, 0.34, -0.6),
        new Vector3(0.13, 0.6, -0.54),
        new Vector3(0.02, 0.72, -0.4),
      ]),
    []
  )

  useFrame(({ clock }, dt) => {
    if (spin && g.current) g.current.rotation.y += dt * 0.9
    // tail: idle sway + extra swing while the character is moving
    const speed = charWorldPos.distanceTo(prevPos.current) / Math.max(dt, 1e-3)
    prevPos.current.copy(charWorldPos)
    swing.current = MathUtils.damp(swing.current, Math.min(0.5, speed * 0.06), 5, dt)
    if (tail.current) {
      const t = clock.elapsedTime
      tail.current.rotation.y = Math.sin(t * 1.9) * (0.16 + swing.current)
      tail.current.rotation.x = Math.sin(t * 1.3 + 1) * 0.06 + swing.current * 0.3
    }
  })

  const furMat = <meshPhysicalMaterial color={fur} roughness={0.45} clearcoat={0.6} clearcoatRoughness={0.35} />

  return (
    <group ref={g}>
      {/* body (sitting) */}
      <mesh position={[0, 0.34, 0]} scale={[1, 0.95, 0.9]}>
        <sphereGeometry args={[0.34, 28, 22]} />
        {furMat}
      </mesh>
      {/* belly patch */}
      <mesh position={[0, 0.32, 0.17]} scale={[1, 1.15, 0.55]}>
        <sphereGeometry args={[0.2, 20, 16]} />
        <meshPhysicalMaterial color={CREAM} roughness={0.5} clearcoat={0.4} />
      </mesh>
      {/* front paws */}
      <mesh position={[-0.13, 0.09, 0.22]}>
        <sphereGeometry args={[0.09, 16, 12]} />
        {furMat}
      </mesh>
      <mesh position={[0.13, 0.09, 0.22]}>
        <sphereGeometry args={[0.09, 16, 12]} />
        {furMat}
      </mesh>

      {/* scarf */}
      <mesh position={[0, 0.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.185, 0.055, 10, 24]} />
        <meshStandardMaterial color={accent} roughness={0.6} />
      </mesh>

      {/* head */}
      <mesh position={[0, 0.82, 0.02]}>
        <sphereGeometry args={[0.32, 28, 22]} />
        {furMat}
      </mesh>
      {/* ears (outer + inner) */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.18, 1.08, 0]} rotation={[0, 0, s * -0.3]}>
          <mesh>
            <coneGeometry args={[0.1, 0.2, 4]} />
            {furMat}
          </mesh>
          <mesh position={[0, -0.01, 0.035]} scale={[0.55, 0.6, 0.55]}>
            <coneGeometry args={[0.1, 0.2, 4]} />
            <meshStandardMaterial color={PINK} roughness={0.6} />
          </mesh>
        </group>
      ))}
      {/* muzzle */}
      <mesh position={[0, 0.73, 0.26]} scale={[1.15, 0.75, 0.7]}>
        <sphereGeometry args={[0.13, 20, 16]} />
        <meshPhysicalMaterial color={CREAM} roughness={0.5} clearcoat={0.4} />
      </mesh>
      {/* nose */}
      <mesh position={[0, 0.77, 0.36]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.03, 0.035, 3]} />
        <meshStandardMaterial color={PINK} roughness={0.4} />
      </mesh>
      {/* eyes (kawaii: big dark + glint) */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.13, 0.86, 0.27]}>
          <mesh scale={[1, 1.35, 0.55]}>
            <sphereGeometry args={[0.05, 16, 12]} />
            <meshStandardMaterial color={INK} roughness={0.25} />
          </mesh>
          <mesh position={[0.015, 0.025, 0.03]}>
            <sphereGeometry args={[0.017, 8, 8]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        </group>
      ))}
      {/* blush */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.21, 0.73, 0.23]} scale={[1, 0.7, 0.5]}>
          <sphereGeometry args={[0.05, 12, 10]} />
          <meshBasicMaterial color={PINK} transparent opacity={0.55} />
        </mesh>
      ))}
      {/* whiskers */}
      {[-1, 1].map((s) =>
        [-0.05, 0, 0.05].map((tilt, i) => (
          <mesh
            key={`${s}-${i}`}
            position={[s * 0.24, 0.74 + tilt, 0.27]}
            rotation={[0, s * -0.25, s * (tilt * 3 + 0.06)]}
          >
            <boxGeometry args={[0.16, 0.006, 0.006]} />
            <meshBasicMaterial color="#f5f2ff" />
          </mesh>
        ))
      )}

      {/* tail — curls up behind, sways springy */}
      <group ref={tail} position={[0, 0, 0]}>
        <mesh>
          <tubeGeometry args={[tailCurve, 24, 0.055, 10, false]} />
          {furMat}
        </mesh>
        <mesh position={[0.02, 0.72, -0.4]}>
          <sphereGeometry args={[0.075, 14, 12]} />
          <meshPhysicalMaterial color={CREAM} roughness={0.5} clearcoat={0.4} />
        </mesh>
      </group>
    </group>
  )
}

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
        <KittenModel fur={look.fur} accent={look.accent} />
      </group>
    </group>
  )
}
