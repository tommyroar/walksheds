const WALKSHED_ITEMS = [
  { minutes: 5, label: '5 min walk' },
  { minutes: 10, label: '10 min walk' },
  { minutes: 15, label: '15 min walk' },
]

const WALKSHED_OPACITIES = { 5: 0.4, 10: 0.25, 15: 0.15 }

const ChevronUp = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
    <path d="M4 10l4-4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const ChevronDown = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export default function LineLegend({
  lineColors,
  enabledWalksheds,
  walkshedAccent,
  onWalkshedToggle,
  darkMode,
  onDarkModeToggle,
  collapsed,
  onToggleCollapse,
  position,
}) {
  const posClass = position === 'bottom-right' ? 'bottom-right' : ''

  if (collapsed) {
    return (
      <div className={`line-legend collapsed ${posClass}`}>
        <button className="legend-dark-toggle-inline" onClick={onDarkModeToggle} aria-label="Toggle dark mode">
          {darkMode ? (
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M14 9.6A6.5 6.5 0 016.4 2 6 6 0 1014 9.6z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
        <div className="legend-collapsed-divider" />
        <div className="legend-collapsed-walksheds">
          {WALKSHED_ITEMS.map(({ minutes }) => {
            const enabled = enabledWalksheds.has(minutes)
            return (
              <button
                key={minutes}
                className={`legend-collapsed-dot ${enabled ? '' : 'dimmed'}`}
                onClick={() => onWalkshedToggle(minutes)}
                aria-label={`${minutes} min walkshed`}
              >
                <span
                  className="legend-swatch legend-swatch-walkshed"
                  style={{
                    background: walkshedAccent,
                    opacity: enabled ? WALKSHED_OPACITIES[minutes] : 0.05,
                  }}
                />
              </button>
            )
          })}
        </div>
        <div className="legend-collapsed-divider" />
        <button className="legend-expand-btn" onClick={onToggleCollapse} aria-label="Expand legend">
          <ChevronUp />
        </button>
      </div>
    )
  }

  return (
    <div className={`line-legend ${posClass}`}>
      <button className="legend-collapse-btn" onClick={onToggleCollapse} aria-label="Collapse legend">
        <ChevronDown />
      </button>
      <button className="legend-dark-toggle" onClick={onDarkModeToggle} aria-label="Toggle dark mode">
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
      <h3 className="legend-title">Link light rail</h3>

      <div className="legend-lines">
        <div className="legend-line-item">
          <span className="legend-line-circle" style={{ background: lineColors['1-line'].color }}>1</span>
          <span className="legend-line-label">{lineColors['1-line'].label}</span>
        </div>
        <div className="legend-line-item">
          <span className="legend-line-circle" style={{ background: lineColors['2-line'].color }}>2</span>
          <span className="legend-line-label">{lineColors['2-line'].label}</span>
        </div>
      </div>

      <div className="legend-station-example">
        <div className="legend-pill">
          <span className="legend-pill-circle" style={{ background: lineColors['1-line'].color }}>1</span>
          <span className="legend-pill-circle" style={{ background: lineColors['2-line'].color }}>2</span>
          <span className="legend-pill-code">50</span>
        </div>
        <span className="legend-station-desc">Station</span>
      </div>

      <div className="legend-divider" />

      <h3 className="legend-title">Walksheds</h3>
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
              <span className="legend-walkshed-label">{label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
