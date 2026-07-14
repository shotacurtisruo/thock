import { useEffect, useRef } from "react"
import { useGame } from "../game/store"

/** MonkeyType-style passage: typed (bright), caret, untyped (dim); scrolls line-by-line. */
export default function TypingBar() {
  const passage = useGame((s) => s.passage)
  const typed = useGame((s) => s.typed)
  const inner = useRef<HTMLDivElement>(null)
  const caret = useRef<HTMLSpanElement>(null)

  // Keep the caret line in view. Measured on the next frame so layout is settled
  // (avoids capturing a mid-reflow value), and clamped so it never scrolls past the end.
  useEffect(() => {
    let raf = requestAnimationFrame(() => {
      const c = caret.current
      const el = inner.current
      const box = el?.parentElement
      if (!c || !el || !box) return
      const maxScroll = Math.max(0, el.scrollHeight - box.clientHeight)
      const offset = Math.min(Math.max(0, c.offsetTop), maxScroll)
      el.style.transform = `translateY(${-offset}px)`
    })
    return () => cancelAnimationFrame(raf)
  }, [typed, passage])

  return (
    <div className="passage">
      <div className="passage-inner" ref={inner}>
        {passage.split("").map((ch, i) => {
          const state = i < typed ? "done" : i === typed ? "current" : "todo"
          return (
            <span key={i} ref={i === typed ? caret : undefined} className={`ch ${state}`}>
              {ch === " " ? " " : ch}
            </span>
          )
        })}
      </div>
    </div>
  )
}
