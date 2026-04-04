import { themes, themeIds } from './themes'

export default function ThemeSwitcher({ activeThemeId, onSwitch }) {
  return (
    <div className="theme-switcher">
      {themeIds.map((id) => {
        const t = themes[id]
        const isActive = id === activeThemeId
        return (
          <button
            key={id}
            className={`theme-btn ${isActive ? 'active' : ''}`}
            onClick={() => onSwitch(id)}
            style={{
              '--accent': t.ui.accent,
              '--accent-alt': t.ui.accentAlt,
            }}
          >
            <span className="theme-lines">
              <span className="theme-line" style={{ background: t.ui.accent }} />
              <span className="theme-line" style={{ background: t.ui.accentAlt }} />
            </span>
            <span className="theme-label">{t.label}</span>
          </button>
        )
      })}
    </div>
  )
}
