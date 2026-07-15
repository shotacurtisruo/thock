import { useEffect, useReducer, useState } from "react"
import { useGame, wpm, accuracy, heightMeters, type GameMode } from "../game/store"
import { audio } from "../audio/AudioEngine"

const MODES: GameMode[] = ["zen", 15, 30]

export default function Hud() {
  const [, tick] = useReducer((n) => n + 1, 0)
  const [muted, setMuted] = useState(false)
  const flow = useGame((s) => s.flow)
  const keycap = useGame((s) => s.keycap)
  const toggleKeycap = useGame((s) => s.toggleKeycap)
  const mode = useGame((s) => s.mode)
  const setMode = useGame((s) => s.setMode)

  // Refresh time-based stats (WPM, countdown) even between keystrokes.
  useEffect(() => {
    const id = setInterval(tick, 200)
    return () => clearInterval(id)
  }, [])

  const s = useGame.getState()
  const timeLeft =
    mode === "zen" || !s.startTime || s.phase !== "running"
      ? mode === "zen"
        ? null
        : (mode as number)
      : Math.max(0, Math.ceil((mode as number) - (Date.now() - s.startTime) / 1000))

  const toggleMute = () => {
    const next = !muted
    setMuted(next)
    audio.setMuted(next)
  }

  return (
    <div className="hud">
      <div className="stats">
        {timeLeft !== null && (
          <div className="stat">
            <span className="num">{timeLeft}</span>
            <span className="unit">time</span>
          </div>
        )}
        <div className="stat">
          <span className="num">{wpm(s)}</span>
          <span className="unit">wpm</span>
        </div>
        <div className="stat">
          <span className="num">{accuracy(s)}%</span>
          <span className="unit">acc</span>
        </div>
        <div className="stat">
          <span className="num">{heightMeters(s)}m</span>
          <span className="unit">height</span>
        </div>
      </div>

      <div className="modes">
        {MODES.map((m) => (
          <button
            key={String(m)}
            className={`mode-pill ${mode === m ? "on" : ""}`}
            onClick={() => setMode(m)}
            title={m === "zen" ? "Endless zen climb" : `${m}-second sprint`}
          >
            {m === "zen" ? "zen" : `${m}s`}
          </button>
        ))}
      </div>

      <div className="flow-wrap">
        <span className="flow-label">flow</span>
        <div className="flow-track">
          <div className="flow-fill" style={{ width: `${Math.round(flow * 100)}%` }} />
        </div>
      </div>

      <button className="cap-toggle" onClick={toggleKeycap} title="Switch keycap + tone">
        cap: <b>{keycap.toUpperCase()}</b> {keycap === "mt3" ? "· thocky" : "· creamy"}
      </button>
      <button className="mute" onClick={toggleMute} title="Mute / unmute">
        {muted ? "🔇" : "🔊"}
      </button>
    </div>
  )
}
