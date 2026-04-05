const WALKSHED_ITEMS = [
  { minutes: 5, label: '5 min walk' },
  { minutes: 10, label: '10 min walk' },
  { minutes: 15, label: '15 min walk' },
]

const WALKSHED_OPACITIES = { 5: 0.4, 10: 0.25, 15: 0.15 }

export default function LineLegend({ lineColors, enabledWalksheds, walkshedAccent, onWalkshedToggle }) {
  return (
    <div className="line-legend">
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
