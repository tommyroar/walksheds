import { useState, useRef, useEffect } from 'react'
import { themes, themeIds } from './themes'

export default function Menu({ activeThemeId, darkMode, onThemeSwitch, onDarkModeToggle }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div className={`menu ${open ? 'open' : ''}`} ref={menuRef}>
      <button
        className="menu-toggle"
        onClick={() => setOpen(!open)}
        aria-label="Menu"
      >
        <span className="menu-bar" />
        <span className="menu-bar" />
        <span className="menu-bar" />
      </button>

      <div className="menu-panel">
        <div className="menu-section">
          <h4 className="menu-section-title">Style</h4>
          <div className="menu-theme-list">
            {themeIds.map((id) => {
              const t = themes[id]
              const isActive = id === activeThemeId
              return (
                <button
                  key={id}
                  className={`menu-theme-btn ${isActive ? 'active' : ''}`}
                  onClick={() => onThemeSwitch(id)}
                >
                  <span className="menu-theme-lines">
                    <span className="menu-theme-line" style={{ background: t.ui.accent }} />
                    <span className="menu-theme-line" style={{ background: t.ui.accentAlt }} />
                  </span>
                  <span className="menu-theme-label">{t.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="menu-divider" />

        <button className="menu-dark-toggle" onClick={onDarkModeToggle} aria-label="Toggle dark mode">
          {darkMode ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M14 9.6A6.5 6.5 0 016.4 2 6 6 0 1014 9.6z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
