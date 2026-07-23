import { useEffect, useState } from "react"
import { useGame } from "../game/store"
import { audio } from "../audio/AudioEngine"
import { coinURL } from "../three/Character"

/**
 * A brief, non-blocking checkpoint payoff. Fires on every `checkpointNonce`
 * bump: plays the checkpoint chime and slides in a pill naming the biome +
 * coin reward, then auto-dismisses. Never intercepts input (pointer-events:none)
 * and never stops the player from typing.
 */
export default function CheckpointToast() {
  const nonce = useGame((s) => s.checkpointNonce)
  const checkpoint = useGame((s) => s.checkpoint)
  const biome = useGame((s) => s.checkpointBiome)
  const reward = useGame((s) => s.checkpointReward)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (nonce === 0) {
      setShow(false) // a run reset clears any toast still on screen
      return
    }
    audio.playCheckpoint(0)
    setShow(true)
    const t = setTimeout(() => setShow(false), 2000)
    return () => clearTimeout(t)
  }, [nonce])

  if (!show) return null
  return (
    <div className="cp-toast" role="status" aria-live="polite" key={nonce}>
      <span className="cp-star" aria-hidden="true">✦</span>
      <span className="cp-text">
        checkpoint {checkpoint}
        {biome ? <span className="cp-biome"> · {biome}</span> : null}
      </span>
      <span className="cp-reward">
        <img className="coin-px" src={coinURL()} alt="coins" draggable={false} /> +{reward}
      </span>
    </div>
  )
}
