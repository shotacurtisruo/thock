import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { CanvasTexture, NearestFilter, DoubleSide, Vector3, MathUtils, type Group, type Mesh } from "three"
import { useGame, type CharacterLook } from "../game/store"
import { objectFor, slotWorldPos } from "../game/config"

const PXW = 16
const PXH = 24
const SCALE = 8
const SPRITE_W = 1.0
const SPRITE_H = 1.5

export function drawChar(look: CharacterLook): HTMLCanvasElement {
  const c = document.createElement("canvas")
  c.width = PXW * SCALE
  c.height = PXH * SCALE
  const ctx = c.getContext("2d")!
  ctx.imageSmoothingEnabled = false
  const px = (color: string, x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = color
    ctx.fillRect(x * SCALE, y * SCALE, w * SCALE, h * SCALE)
  }
  const { skin, hair, shirt } = look
  const pants = "#3b4a6b"
  const shoe = "#2a2a30"
  const dark = "#20161a"
  const blush = "#ff9ec2"

  px(hair, 3, 1, 10, 5)
  px(hair, 3, 4, 2, 5)
  px(hair, 11, 4, 2, 5)
  px(skin, 4, 4, 8, 8)
  px(skin, 3, 7, 1, 2)
  px(skin, 12, 7, 1, 2)
  px(hair, 4, 4, 8, 1)
  px(dark, 6, 7, 1, 2)
  px(dark, 9, 7, 1, 2)
  px(blush, 5, 9, 1, 1)
  px(blush, 10, 9, 1, 1)
  px(dark, 7, 10, 2, 1)
  px(skin, 6, 12, 4, 1)
  px(shirt, 4, 13, 8, 5)
  px(skin, 2, 13, 2, 5)
  px(skin, 12, 13, 2, 5)
  px(pants, 4, 18, 8, 3)
  px(pants, 4, 21, 3, 2)
  px(pants, 9, 21, 3, 2)
  px(shoe, 4, 23, 3, 1)
  px(shoe, 9, 23, 3, 1)
  return c
}

export function charDataURL(look: CharacterLook): string {
  return drawChar(look).toDataURL()
}

export function makeCharTexture(look: CharacterLook): CanvasTexture {
  const tex = new CanvasTexture(drawChar(look))
  tex.magFilter = NearestFilter
  tex.minFilter = NearestFilter
  tex.needsUpdate = true
  return tex
}

const smoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)

/** The player's customizable pixel character — arcs between letters, tumbles on a fall. */
export default function Character() {
  const look = useGame((s) => s.character)
  const tex = useMemo(() => makeCharTexture(look), [look.skin, look.hair, look.shirt])

  const group = useRef<Group>(null)
  const plane = useRef<Mesh>(null)
  const from = useRef(new Vector3())
  const to = useRef(new Vector3())
  const goal = useRef(new Vector3())
  const t = useRef(1)
  const dur = useRef(0.2)
  const arc = useRef(0)
  const falling = useRef(false)
  const spin = useRef(0)
  const inited = useRef(false)

  useFrame(({ clock, camera }, dt) => {
    const g = group.current
    const p = plane.current
    if (!g || !p) return
    const { baseWord, wi, ci, words } = useGame.getState()
    const W = baseWord + wi
    const len = words[wi]?.length ?? 1
    const slot = Math.min(ci, len - 1)
    const [gx, gy, gz] = slotWorldPos(W, slot, len)
    const footY = gy + objectFor(W).halfHeight
    goal.current.set(gx, footY, gz)

    if (!inited.current) {
      g.position.copy(goal.current)
      inited.current = true
    }

    // new destination -> start a tween (hop for up/sideways, tumble-fall for big drops)
    if (goal.current.distanceToSquared(to.current) > 0.0004) {
      from.current.copy(g.position)
      to.current.copy(goal.current)
      t.current = 0
      const horiz = Math.hypot(goal.current.x - from.current.x, goal.current.z - from.current.z)
      const drop = from.current.y - goal.current.y
      falling.current = drop > 0.6
      if (falling.current) {
        dur.current = 0.4 + Math.min(0.4, drop * 0.12)
        arc.current = 0
      } else {
        dur.current = MathUtils.clamp(0.13 + horiz * 0.04, 0.13, 0.4)
        arc.current = Math.min(0.9, horiz * 0.16 + 0.14)
      }
    }

    t.current = Math.min(1, t.current + dt / dur.current)
    const tt = t.current
    if (falling.current) {
      const eXZ = smoother(tt)
      const eY = tt * tt // accelerate downward like gravity
      g.position.x = MathUtils.lerp(from.current.x, to.current.x, eXZ)
      g.position.z = MathUtils.lerp(from.current.z, to.current.z, eXZ)
      const bounce = tt > 0.92 ? Math.sin((tt - 0.92) / 0.08 * Math.PI) * 0.12 : 0
      g.position.y = MathUtils.lerp(from.current.y, to.current.y, eY) + bounce
      spin.current += dt * 12 // tumble
    } else {
      const e = smoother(tt)
      g.position.x = MathUtils.lerp(from.current.x, to.current.x, e)
      g.position.z = MathUtils.lerp(from.current.z, to.current.z, e)
      g.position.y = MathUtils.lerp(from.current.y, to.current.y, e) + Math.sin(Math.PI * tt) * arc.current
      spin.current = MathUtils.damp(spin.current, 0, 8, dt) // settle any tumble
    }

    // squash while airborne + idle breathe
    const air = falling.current ? 0.12 : Math.sin(Math.PI * tt) * 0.18
    const idle = Math.sin(clock.elapsedTime * 3) * 0.02
    p.position.y = SPRITE_H / 2 + idle
    p.scale.set(SPRITE_W * (1 + air * 0.3), SPRITE_H * (1 - air * 0.25), 1)
    p.rotation.z = spin.current

    g.rotation.y = Math.atan2(camera.position.x - g.position.x, camera.position.z - g.position.z)
  })

  return (
    <group ref={group}>
      <mesh ref={plane} position={[0, SPRITE_H / 2, 0]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={tex} transparent alphaTest={0.5} side={DoubleSide} toneMapped={false} />
      </mesh>
    </group>
  )
}
