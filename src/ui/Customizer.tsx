import { useGame, type CharacterLook } from "../game/store"
import { charDataURL } from "../three/Character"

const SKINS = ["#f7d9b8", "#f2c79a", "#e0a878", "#c68642", "#8d5524", "#5c3a1e"]
const HAIRS = ["#3a2a20", "#7a4a22", "#1c1c22", "#d9c27a", "#c94f4f", "#6a5acd", "#e88ac0", "#8a8f98"]
const SHIRTS = ["#4fb0e0", "#ff7eb0", "#7ce06a", "#ffcf5e", "#a985ff", "#ff8a5c", "#2b2b30", "#eceaf5"]

function Row({ label, part, colors, current }: { label: string; part: keyof CharacterLook; colors: string[]; current: string }) {
  const setChar = useGame((s) => s.setChar)
  return (
    <div className="cz-row">
      <span className="cz-label">{label}</span>
      <div className="cz-swatches">
        {colors.map((c) => (
          <button
            key={c}
            className={`cz-swatch ${c === current ? "on" : ""}`}
            style={{ background: c }}
            onClick={() => setChar(part, c)}
            aria-label={`${label} ${c}`}
          />
        ))}
      </div>
    </div>
  )
}

export default function Customizer({ onClose }: { onClose: () => void }) {
  const character = useGame((s) => s.character)
  return (
    <div className="cz-backdrop" onClick={onClose}>
      <div className="cz-panel" onClick={(e) => e.stopPropagation()}>
        <div className="cz-head">
          <span>customize</span>
          <button className="cz-close" onClick={onClose}>✕</button>
        </div>
        <div className="cz-body">
          <img className="cz-preview" src={charDataURL(character)} alt="character preview" />
          <div className="cz-rows">
            <Row label="skin" part="skin" colors={SKINS} current={character.skin} />
            <Row label="hair" part="hair" colors={HAIRS} current={character.hair} />
            <Row label="shirt" part="shirt" colors={SHIRTS} current={character.shirt} />
          </div>
        </div>
      </div>
    </div>
  )
}
