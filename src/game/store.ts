import { create } from "zustand"
import { generatePassage } from "./passage"
import { objectFor, weatherFor, type ClimbObject, type Weather } from "./config"

export interface PressResult {
  correct: boolean
  jump: boolean // true when a space jumped us to the next word-object
  slip: boolean // true when a miss made us slip and fall back
  worldIndex: number // absolute word index
  object: ClimbObject
  slot: number // letter slot within the word (for pitch/pan)
  flow: number
}

// luck factor: chance a miss makes us slip & fall (?clumsy forces every miss, for testing)
const SLIP_CHANCE =
  typeof window !== "undefined" && new URLSearchParams(window.location.search).has("clumsy") ? 1 : 0.15

interface GameState {
  words: string[] // current passage, split into words
  passage: string // joined, for the typing display
  wi: number // current word index within the passage
  ci: number // char index within the current word (== len means awaiting the space jump)
  baseWord: number // words completed in earlier passages (endless)
  typed: number // absolute char index into `passage` (for the caret)
  errors: number
  keystrokes: number
  streak: number
  flow: number
  startTime: number | null
  weather: Weather
  prevWeather: Weather // for the crossfade
  weatherAt: number // timestamp the weather last changed
  keycap: "mt3" | "xda"
  character: CharacterLook
  slipNonce: number // increments on every slip — visuals sequence the fall off this
  slipAt: number // timestamp of the last slip

  reset: () => void
  press: (char: string) => PressResult | null
  toggleKeycap: () => void
  setChar: (part: keyof CharacterLook, value: string) => void
}

export interface CharacterLook {
  fur: string
  accent: string
}

const DEFAULT_CHAR: CharacterLook = { fur: "#e0561e", accent: "#5ff0d0" }

function loadChar(): CharacterLook {
  try {
    const raw = localStorage.getItem("thock-char-v2")
    if (raw) return { ...DEFAULT_CHAR, ...JSON.parse(raw) }
  } catch {}
  return DEFAULT_CHAR
}

const FLOW_GAIN = 0.045
const FLOW_LOSS = 0.25

function cursorIndex(words: string[], wi: number, ci: number): number {
  let n = 0
  for (let i = 0; i < wi; i++) n += words[i].length + 1 // +1 for the space
  return n + ci
}

function fresh() {
  const passage = generatePassage()
  return { words: passage.split(" "), passage, wi: 0, ci: 0, baseWord: 0, typed: 0 }
}

export const useGame = create<GameState>((set, get) => ({
  ...fresh(),
  errors: 0,
  keystrokes: 0,
  streak: 0,
  flow: 0,
  startTime: null,
  weather: weatherFor(0),
  prevWeather: weatherFor(0),
  weatherAt: 0,
  keycap: "mt3",
  character: loadChar(),
  slipNonce: 0,
  slipAt: 0,

  toggleKeycap: () => set((s) => ({ keycap: s.keycap === "mt3" ? "xda" : "mt3" })),

  setChar: (part, value) =>
    set((s) => {
      const character = { ...s.character, [part]: value }
      try {
        localStorage.setItem("thock-char-v2", JSON.stringify(character))
      } catch {}
      return { character }
    }),

  reset: () =>
    set({ ...fresh(), errors: 0, keystrokes: 0, streak: 0, flow: 0, startTime: null, weather: weatherFor(0), prevWeather: weatherFor(0), weatherAt: 0 }),

  press: (char) => {
    const s = get()
    const word = s.words[s.wi]
    if (word === undefined) return null

    const expected = s.ci < word.length ? word[s.ci] : " "
    const startTime = s.startTime ?? Date.now()
    const keystrokes = s.keystrokes + 1
    const W = s.baseWord + s.wi

    // wrong key: no advance, drop flow, dud — and (rarely) slip & fall back
    if (char !== expected) {
      const base = { errors: s.errors + 1, keystrokes, streak: 0, flow: Math.max(0, s.flow - FLOW_LOSS), startTime }
      // luck factor: only slip if there's somewhere to fall to
      if (s.wi >= 1 && Math.random() < SLIP_CHANCE) {
        const fall = Math.min(s.wi, Math.random() < 0.5 ? 2 : 1)
        const wi = s.wi - fall
        const nextW = s.baseWord + wi
        const changed = weatherFor(nextW).name !== s.weather.name
        set({
          ...base,
          wi,
          ci: 0,
          typed: cursorIndex(s.words, wi, 0),
          weather: weatherFor(nextW),
          prevWeather: changed ? s.weather : s.prevWeather,
          weatherAt: changed ? Date.now() : s.weatherAt,
          slipNonce: s.slipNonce + 1,
          slipAt: Date.now(),
        })
        return { correct: false, jump: false, slip: true, worldIndex: nextW, object: objectFor(nextW), slot: 0, flow: base.flow }
      }
      set(base)
      return { correct: false, jump: false, slip: false, worldIndex: W, object: objectFor(W), slot: s.ci, flow: base.flow }
    }

    const flow = Math.min(1, s.flow + FLOW_GAIN)
    const streak = s.streak + 1

    // running across the current word
    if (s.ci < word.length) {
      const ci = s.ci + 1
      set({ ci, typed: cursorIndex(s.words, s.wi, ci), keystrokes, streak, flow, startTime })
      return { correct: true, jump: false, slip: false, worldIndex: W, object: objectFor(W), slot: s.ci, flow }
    }

    // space -> jump to the next word-object
    let wi = s.wi + 1
    let words = s.words
    let passage = s.passage
    let baseWord = s.baseWord
    if (wi >= words.length) {
      baseWord += words.length
      passage = generatePassage()
      words = passage.split(" ")
      wi = 0
    }
    const nextW = baseWord + wi
    const nextWeather = weatherFor(nextW)
    const changed = nextWeather.name !== s.weather.name
    set({
      words, passage, wi, ci: 0, baseWord,
      typed: cursorIndex(words, wi, 0),
      keystrokes, streak, flow, startTime,
      weather: nextWeather,
      prevWeather: changed ? s.weather : s.prevWeather,
      weatherAt: changed ? Date.now() : s.weatherAt,
    })
    return { correct: true, jump: true, slip: false, worldIndex: nextW, object: objectFor(nextW), slot: 0, flow }
  },
}))

// --- Derived selectors ---
export function wpm(s: GameState): number {
  if (!s.startTime) return 0
  const minutes = (Date.now() - s.startTime) / 60000
  if (minutes <= 0) return 0
  return Math.max(0, Math.round((s.keystrokes - s.errors) / 5 / minutes))
}

export function accuracy(s: GameState): number {
  if (s.keystrokes === 0) return 100
  return Math.round(((s.keystrokes - s.errors) / s.keystrokes) * 100)
}

export function heightMeters(s: GameState): number {
  return Math.round((s.baseWord + s.wi) * 1.5)
}
