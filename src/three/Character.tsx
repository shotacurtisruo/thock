import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { CanvasTexture, NearestFilter, DoubleSide, Vector3, type Group, type Mesh } from "three"
import { useGame, type CharacterLook } from "../game/store"
import { objectFor, slotWorldPos } from "../game/config"

const PXW = 16
const PXH = 24
const SCALE = 8
const SPRITE_W = 1.0
const SPRITE_H = 1.5

/** Paint the little pixel human onto a canvas. */
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

  px(hair, 3, 1, 10, 5) // hair back/top
  px(hair, 3, 4, 2, 5) // left sideburn
  px(hair, 11, 4, 2, 5) // right sideburn
  px(skin, 4, 4, 8, 8) // face
  px(skin, 3, 7, 1, 2) // ears
  px(skin, 12, 7, 1, 2)
  px(hair, 4, 4, 8, 1) // fringe
  px(dark, 6, 7, 1, 2) // eyes
  px(dark, 9, 7, 1, 2)
  px(blush, 5, 9, 1, 1) // blush
  px(blush, 10, 9, 1, 1)
  px(dark, 7, 10, 2, 1) // mouth
  px(skin, 6, 12, 4, 1) // neck
  px(shirt, 4, 13, 8, 5) // shirt
  px(skin, 2, 13, 2, 5) // arms
  px(skin, 12, 13, 2, 5)
  px(pants, 4, 18, 8, 3) // pants
  px(pants, 4, 21, 3, 2) // legs
  px(pants, 9, 21, 3, 2)
  px(shoe, 4, 23, 3, 1) // shoes
  px(shoe, 9, 23, 3, 1)
  return c
}

export function charDataURL(look: CharacterLook): string {
  return drawChar(look).toDataURL()
}

/** Crisp (nearest-filter) texture of the character for use in the 3D scene. */
export function makeCharTexture(look: CharacterLook): CanvasTexture {
  const tex = new CanvasTexture(drawChar(look))
  tex.magFilter = NearestFilter
  tex.minFilter = NearestFilter
  tex.needsUpdate = true
  return tex
}

/** The player's customizable pixel character, running the words as a billboard sprite. */
export default function Character() {
  const look = useGame((s) => s.character)
  const tex = useMemo(() => makeCharTexture(look), [look.skin, look.hair, look.shirt])

  const group = useRef<Group>(null)
  const plane = useRef<Mesh>(null)
  const target = useRef(new Vector3())
  const prev = useRef(new Vector3())

  useFrame(({ camera, clock }, dt) => {
    const g = group.current
    const p = plane.current
    if (!g || !p) return
    const { baseWord, wi, ci, words } = useGame.getState()
    const W = baseWord + wi
    const len = words[wi]?.length ?? 1
    const slot = Math.min(ci, len - 1)
    const [tx, ty, tz] = slotWorldPos(W, slot, len)
    const footY = ty + objectFor(W).halfHeight
    target.current.set(tx, footY, tz)

    prev.current.copy(g.position)
    g.position.lerp(target.current, Math.min(1, dt * 9))
    const speed = g.position.distanceTo(prev.current) / Math.max(dt, 1e-3)
    const moving = Math.min(1, speed * 0.14)

    const hop = Math.abs(Math.sin(clock.elapsedTime * 16)) * 0.14 * moving
    const idle = Math.sin(clock.elapsedTime * 3) * 0.02
    p.position.y = SPRITE_H / 2 + hop + idle
    const squash = 1 - moving * 0.1
    p.scale.set(SPRITE_W * (1 + moving * 0.05), SPRITE_H * squash, 1)

    // yaw toward camera only, so the sprite stays upright
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
