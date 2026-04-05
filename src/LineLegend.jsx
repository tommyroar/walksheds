const WALKSHED_ITEMS = [
  { minutes: 5, label: '5 min walk' },
  { minutes: 10, label: '10 min walk' },
  { minutes: 15, label: '15 min walk' },
]

const WALKSHED_OPACITIES = { 5: 0.4, 10: 0.25, 15: 0.15 }

const LIGHT = {
  bg: 'rgba(255, 255, 255, 0.95)',
  border: 'rgba(0, 0, 0, 0.1)',
  text: '#333',
  muted: '#555',
  dimmed: '#999',
  divider: 'rgba(0, 0, 0, 0.1)',
  pillBg: '#fff',
  pillBorder: '#333',
  codeBg: '#e8e8e8',
  codeText: '#333',
  toggleColor: 'rgba(0, 0, 0, 0.2)',
  hoverBg: 'rgba(0, 0, 0, 0.04)',
}

const DARK = {
  bg: 'rgba(20, 20, 30, 0.92)',
  border: 'rgba(255, 255, 255, 0.08)',
  text: 'rgba(255, 255, 255, 0.8)',
  muted: 'rgba(255, 255, 255, 0.5)',
  dimmed: 'rgba(255, 255, 255, 0.25)',
  divider: 'rgba(255, 255, 255, 0.1)',
  pillBg: '#2a2a3a',
  pillBorder: 'rgba(255, 255, 255, 0.3)',
  codeBg: 'rgba(255, 255, 255, 0.12)',
  codeText: 'rgba(255, 255, 255, 0.8)',
  toggleColor: 'rgba(255, 255, 255, 0.2)',
  hoverBg: 'rgba(255, 255, 255, 0.05)',
}

export default function LineLegend({ lineColors, enabledWalksheds, walkshedAccent, onWalkshedToggle, darkMode, onDarkModeToggle }) {
  const t = darkMode ? DARK : LIGHT

  return (
    <div className="line-legend" style={{ background: t.bg, borderColor: t.border, color: t.text }}>
      <button
        className="legend-dark-toggle"
        onClick={onDarkModeToggle}
        aria-label="Toggle dark mode"
        style={{ color: t.toggleColor }}
      >
        {darkMode ? (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M14 9.6A6.5 6.5 0 016.4 2 6 6 0 1014 9.6z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>

      <h3 className="legend-title" style={{ color: t.text }}>Link light rail</h3>

      <div className="legend-lines">
        <div className="legend-line-item">
          <span className="legend-line-circle" style={{ background: lineColors['1-line'].color }}>1</span>
          <span className="legend-line-label" style={{ color: t.text }}>{lineColors['1-line'].label}</span>
        </div>
        <div className="legend-line-item">
          <span className="legend-line-circle" style={{ background: lineColors['2-line'].color }}>2</span>
          <span className="legend-line-label" style={{ color: t.text }}>{lineColors['2-line'].label}</span>
        </div>
      </div>

      <div className="legend-station-example">
        <div className="legend-pill" style={{ background: t.pillBg, borderColor: t.pillBorder }}>
          <span className="legend-pill-circle" style={{ background: lineColors['1-line'].color }}>1</span>
          <span className="legend-pill-circle" style={{ background: lineColors['2-line'].color }}>2</span>
          <span className="legend-pill-code" style={{ background: t.codeBg, color: t.codeText }}>50</span>
        </div>
        <span className="legend-station-desc" style={{ color: t.text }}>Station</span>
      </div>

      <div className="legend-divider" style={{ background: t.divider }} />

      <h3 className="legend-title" style={{ color: t.text }}>Walksheds</h3>
      <div className="legend-walkshed-list">
        {WALKSHED_ITEMS.map(({ minutes, label }) => {
          const enabled = enabledWalksheds.has(minutes)
          return (
            <button
              key={minutes}
              className={`legend-walkshed-item ${enabled ? '' : 'dimmed'}`}
              onClick={() => onWalkshedToggle(minutes)}
            >
              <span
                className="legend-swatch legend-swatch-walkshed"
                style={{
                  background: walkshedAccent,
                  opacity: enabled ? WALKSHED_OPACITIES[minutes] : 0.05,
                }}
              />
              <span className="legend-walkshed-label" style={{ color: enabled ? t.muted : t.dimmed }}>{label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
