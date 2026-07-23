import { useEffect, useState } from "react"
import { useGame } from "../game/store"
import { audio } from "../audio/AudioEngine"

/**
 * The 100-word milestone payoff: a bigger, centered banner announcing the height
 * (with a personal-best marker) + a resolving musical cadence. Pairs with the
 * camera pull-back in Scene. Non-blocking (pointer-events:none) and
 * auto-dismissing — the climb never stops.
 */
export default function MilestoneBanner() {
  const nonce = useGame((s) => s.milestoneNonce)
  const height = useGame((s) => s.milestoneHeight)
  const pb = useGame((s) => s.milestonePb)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (nonce === 0) {
      setShow(false) // a run reset clears any banner still on screen
      return
    }
    audio.playMilestone(0)
    setShow(true)
    const t = setTimeout(() => setShow(false), 2600)
    return () => clearTimeout(t)
  }, [nonce])

  if (!show) return null
  return (
    <div className={`ms-banner ${pb ? "pb" : ""}`} role="status" aria-live="polite" key={nonce}>
      <span className="ms-star" aria-hidden="true">✦</span>
      <span className="ms-height">{height}m</span>
      <span className="ms-label">{pb ? "new best" : "milestone"}</span>
    </div>
  )
}
