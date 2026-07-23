import { describe, it, expect, beforeEach, vi } from "vitest"
import { useGame } from "./store"
import { EMPTY_STATS } from "./stats"
import { DEFAULT_SETTINGS, type GameMode } from "./persist"

// Put the store into a known run over deterministic words.
function setup(words: string[], opts: { mode?: GameMode; strictFalls?: boolean } = {}) {
  useGame.setState({
    words,
    marks: words.map((w) => Array(w.length).fill(0)),
    wi: 0,
    ci: 0,
    baseWord: 0,
    angles: words.map((_, i) => i),
    arcBase: 0,
    seed: 0,
    freshReds: 0,
    stats: { ...EMPTY_STATS },
    streak: 0,
    bestStreak: 0,
    flow: 0,
    startTime: null,
    pausedAt: null,
    phase: "idle",
    results: null,
    mode: opts.mode ?? "zen",
    settings: { ...DEFAULT_SETTINGS, strictFalls: opts.strictFalls ?? false },
    collected: {},
    coinsRun: 0,
    checkpoint: 0,
    checkpointNonce: 0,
    checkpointBiome: "",
    checkpointReward: 0,
    milestone: 0,
    milestoneNonce: 0,
    milestoneHeight: 0,
    milestonePb: false,
  })
}

const type = (str: string) => [...str].forEach((c) => useGame.getState().press(c))
const st = () => useGame.getState()

beforeEach(() => setup(["hello", "world", "there"]))

describe("store — typing transitions", () => {
  it("counts a correct character", () => {
    useGame.getState().press("h")
    expect(st().stats.correctTyped).toBe(1)
    expect(st().stats.incorrectTyped).toBe(0)
    expect(st().marks[0][0]).toBe(1)
    expect(st().ci).toBe(1)
  })

  it("counts an incorrect character (typed through, red)", () => {
    useGame.getState().press("x")
    expect(st().stats.incorrectTyped).toBe(1)
    expect(st().marks[0][0]).toBe(2)
    expect(st().ci).toBe(1)
  })

  it("corrects an error with backspace", () => {
    useGame.getState().press("x") // wrong
    useGame.getState().backspace()
    expect(st().stats.incorrectTyped).toBe(1)
    expect(st().stats.correctedErrors).toBe(1)
    expect(st().marks[0][0]).toBe(0)
    expect(st().ci).toBe(0)
  })

  it("skipping part of a word with space records missed characters", () => {
    type("he")
    useGame.getState().press(" ")
    expect(st().stats.correctTyped).toBe(2)
    expect(st().stats.missedCharacters).toBe(3) // l, l, o
    expect(st().wi).toBe(1)
  })

  it("reaches three errors and falls in a sprint", () => {
    const rnd = vi.spyOn(Math, "random").mockReturnValue(0.9) // fall = 1 word
    setup(["ab", "cdefg", "xyz"], { mode: 15 })
    type("ab")
    useGame.getState().press(" ") // advance to word index 1
    expect(st().wi).toBe(1)
    useGame.getState().press("q")
    useGame.getState().press("q")
    const res = useGame.getState().press("q") // third fresh red → fall
    expect(res?.slip).toBe(true)
    expect(st().wi).toBe(0) // tumbled back
    expect(st().stats.incorrectTyped).toBe(3)
    rnd.mockRestore()
  })

  it("does NOT fall in Zen by default", () => {
    setup(["ab", "cdefg"], { mode: "zen", strictFalls: false })
    type("ab")
    useGame.getState().press(" ")
    useGame.getState().press("q")
    useGame.getState().press("q")
    const res = useGame.getState().press("q")
    expect(res?.slip).toBe(false)
    expect(st().wi).toBe(1) // stayed put
    expect(st().phase).toBe("running")
  })

  it("falls in Zen when strict falls is enabled", () => {
    const rnd = vi.spyOn(Math, "random").mockReturnValue(0.9)
    setup(["ab", "cdefg"], { mode: "zen", strictFalls: true })
    type("ab")
    useGame.getState().press(" ")
    type("qqq")
    expect(st().wi).toBe(0)
    rnd.mockRestore()
  })

  it("keeps error counts after a fall and retype", () => {
    const rnd = vi.spyOn(Math, "random").mockReturnValue(0.9)
    setup(["ab", "cdefg"], { mode: 15 })
    type("ab")
    useGame.getState().press(" ")
    type("qqq") // 3 errors → fall back to word 0
    expect(st().stats.incorrectTyped).toBe(3)
    type("ab") // retype the fallen word correctly
    expect(st().stats.incorrectTyped).toBe(3) // errors are not erased by falling
    expect(st().stats.correctTyped).toBeGreaterThanOrEqual(4)
    rnd.mockRestore()
  })
})

describe("store — run lifecycle", () => {
  it("retryRun keeps the same seed + passage, resets progress", () => {
    setup(["alpha", "beta", "gamma"], { mode: 15 })
    const seed = st().seed
    type("alpha")
    useGame.getState().press(" ")
    const words = st().words.slice() // capture after the stream extended
    useGame.getState().retryRun()
    expect(st().seed).toBe(seed)
    expect(st().words).toEqual(words)
    expect(st().wi).toBe(0)
    expect(st().ci).toBe(0)
    expect(st().stats).toEqual(EMPTY_STATS)
    expect(st().marks.flat().every((m) => m === 0)).toBe(true)
  })

  it("newRun resets counters and phase", () => {
    type("hello")
    useGame.getState().newRun()
    expect(st().phase).toBe("idle")
    expect(st().stats).toEqual(EMPTY_STATS)
    expect(st().wi).toBe(0)
    expect(st().words.length).toBeGreaterThan(0)
  })

  it("timed completion produces bounded results", () => {
    setup(["hello", "world"], { mode: 15 })
    type("hello")
    // simulate one minute elapsed
    useGame.setState({ startTime: Date.now() - 60000 })
    useGame.getState().endRun()
    const r = st().results!
    expect(r).not.toBeNull()
    expect(r.acc).toBeGreaterThanOrEqual(0)
    expect(r.acc).toBeLessThanOrEqual(100)
    expect(r.correctTyped).toBe(5)
    expect(r.wpm).toBe(1) // 5 correct chars / 5 / 1 min
    expect(st().phase).toBe("done")
  })

  it("finishSession ends a Zen run into results", () => {
    setup(["hello"], { mode: "zen" })
    type("hel")
    useGame.setState({ startTime: Date.now() - 60000 })
    useGame.getState().finishSession()
    expect(st().phase).toBe("done")
    expect(st().results?.mode).toBe("zen")
  })

  it("crossing a checkpoint awards coins once and persists the best", () => {
    setup(Array(24).fill("a"), { mode: "zen" })
    const coinsBefore = st().coins
    for (let i = 0; i < 22; i++) {
      useGame.getState().press("a")
      useGame.getState().press(" ")
    }
    expect(st().wi).toBe(22)
    expect(st().checkpoint).toBe(1)
    expect(st().checkpointNonce).toBe(1)
    expect(st().checkpointBiome).not.toBe("")
    expect(st().coins).toBe(coinsBefore + 5)
    expect(st().coinsRun).toBeGreaterThanOrEqual(5)
    // one more word must NOT re-award (still checkpoint 1)
    useGame.getState().press("a")
    useGame.getState().press(" ")
    expect(st().checkpoint).toBe(1)
    expect(st().coins).toBe(coinsBefore + 5)
  })

  it("does NOT re-award a checkpoint after falling below it and re-climbing", () => {
    setup(Array(26).fill("a"), { mode: 15 })
    for (let i = 0; i < 22; i++) {
      useGame.getState().press("a")
      useGame.getState().press(" ")
    }
    expect(st().checkpoint).toBe(1)
    const coinsAfterAward = st().coins
    // simulate a fall back below the boundary (doFall rewinds wi, keeps checkpoint)
    useGame.setState({ wi: 20, ci: 0 })
    // re-climb across word 22 again
    for (let i = 0; i < 2; i++) {
      useGame.getState().press("a")
      useGame.getState().press(" ")
    }
    expect(st().wi).toBe(22)
    expect(st().checkpoint).toBe(1)
    expect(st().coins).toBe(coinsAfterAward) // no farming
  })

  it("crossing a milestone awards a bigger reward + records height", () => {
    setup(Array(102).fill("a"), { mode: "zen" })
    // realistic climbed state at word 99: checkpoints 1-4 already awarded
    useGame.setState({ wi: 99, ci: 1, checkpoint: 4, coins: 0, coinsRun: 0 })
    useGame.getState().press(" ") // -> wi 100 crosses milestone 1 (word 100 is NOT a new checkpoint)
    expect(st().wi).toBe(100)
    expect(st().milestone).toBe(1)
    expect(st().milestoneNonce).toBe(1)
    expect(st().milestoneHeight).toBe(Math.round(100 * 1.05))
    expect(st().coins).toBe(25) // milestone only, no double checkpoint
    expect(typeof st().milestonePb).toBe("boolean")
  })

  it("pause/resume shifts the clock so paused time is not counted", () => {
    setup(["hello"], { mode: 15 })
    useGame.getState().press("h")
    const before = st().startTime!
    useGame.getState().pauseClock()
    expect(st().pausedAt).not.toBeNull()
    useGame.getState().resumeClock()
    expect(st().pausedAt).toBeNull()
    expect(st().startTime!).toBeGreaterThanOrEqual(before) // advanced by the paused gap
  })
})
