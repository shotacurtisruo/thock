import { useGame } from "../game/store"

/** MonkeyType-style end-of-run results card. */
export default function Results() {
  const results = useGame((s) => s.results)
  const reset = useGame((s) => s.reset)
  if (!results) return null

  return (
    <div className="res-backdrop">
      <div className="res-panel">
        <div className="res-big">
          <div className="res-metric">
            <span className="res-num">{results.wpm}</span>
            <span className="res-label">wpm</span>
          </div>
          <div className="res-metric">
            <span className="res-num">{results.acc}%</span>
            <span className="res-label">acc</span>
          </div>
        </div>
        <div className="res-grid">
          <div className="res-cell">
            <span className="res-cell-num">{results.raw}</span>
            <span className="res-cell-label">raw</span>
          </div>
          <div className="res-cell">
            <span className="res-cell-num">
              {results.correct}<span className="res-dim">/</span>
              <span className="res-red">{results.errors}</span>
            </span>
            <span className="res-cell-label">chars</span>
          </div>
          <div className="res-cell">
            <span className="res-cell-num">{results.height}m</span>
            <span className="res-cell-label">height</span>
          </div>
          <div className="res-cell">
            <span className="res-cell-num">{results.bestStreak}</span>
            <span className="res-cell-label">best streak</span>
          </div>
          <div className="res-cell">
            <span className="res-cell-num">{results.mode === "zen" ? "zen" : `${results.mode}s`}</span>
            <span className="res-cell-label">mode</span>
          </div>
        </div>
        <button className="res-again" onClick={reset}>
          next climb
        </button>
        <div className="res-hint">tab · next climb</div>
      </div>
    </div>
  )
}
