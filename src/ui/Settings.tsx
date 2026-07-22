import { useGame } from "../game/store"
import Dialog from "./Dialog"
import type { Settings as S } from "../game/persist"

function Slider({ label, value, onChange, min = 0, max = 1, step = 0.05 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <label className="set-row">
      <span className="set-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <span className="set-val">{Math.round(value * 100)}</span>
    </label>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      className={`set-toggle tactile ${value ? "on" : ""}`}
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
    >
      <span className="set-label">{label}</span>
      <span className="set-knob" aria-hidden="true" />
    </button>
  )
}

export default function Settings({ onClose, onReplayTutorial }: { onClose: () => void; onReplayTutorial: () => void }) {
  const settings = useGame((s) => s.settings)
  const setSettings = useGame((s) => s.setSettings)
  const set = <K extends keyof S>(k: K, v: S[K]) => setSettings({ [k]: v } as Partial<S>)
  const showStats = settings.showWpm || settings.showAcc || settings.showHeight

  return (
    <Dialog title="Settings" onClose={onClose} className="cz-shop set-panel" labelId="set-title" restoreFocus={false}>
      <div className="cz-head">
        <span id="set-title">settings</span>
        <button className="cz-close tactile" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="set-section">
        <h3 className="set-h">audio</h3>
        <Slider label="master" value={settings.masterVolume} onChange={(v) => set("masterVolume", v)} />
        <Slider label="switches" value={settings.mechVolume} onChange={(v) => set("mechVolume", v)} />
        <Slider label="materials" value={settings.materialVolume} onChange={(v) => set("materialVolume", v)} />
        <Slider label="ambience" value={settings.ambienceVolume} onChange={(v) => set("ambienceVolume", v)} />
        <Toggle label="mute" value={settings.muted} onChange={(v) => set("muted", v)} />
      </div>

      <div className="set-section">
        <h3 className="set-h">gameplay</h3>
        <Toggle label="zen strict falls" value={settings.strictFalls} onChange={(v) => set("strictFalls", v)} />
        <Toggle
          label="show stats"
          value={showStats}
          onChange={(v) => setSettings({ showWpm: v, showAcc: v, showHeight: v })}
        />
        <Toggle label="show flow" value={settings.showFlow} onChange={(v) => set("showFlow", v)} />
        <div className="set-btnrow">
          <button className="set-btn tactile" onClick={() => { onClose(); onReplayTutorial() }}>replay tutorial</button>
        </div>
      </div>
    </Dialog>
  )
}
