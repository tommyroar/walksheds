import { themes } from './themes'

const soundTransit = themes['sound-transit']

const WALKSHED_LEGEND = [
  { minutes: 15, label: '15 min walk' },
  { minutes: 10, label: '10 min walk' },
  { minutes: 5, label: '5 min walk' },
]

const WALKSHED_OPACITIES = { 15: 0.15, 10: 0.25, 5: 0.4 }

export default function LineLegend({ enabledWalksheds, themeAccent }) {
  const hasWalksheds = enabledWalksheds && enabledWalksheds.size > 0

  return (
    <div className="line-legend">
      <h3 className="legend-title">Link light rail</h3>

      <div className="legend-lines">
        <div className="legend-line-item">
          <span className="legend-line-circle" style={{ background: soundTransit.lines['1-line'].color }}>1</span>
          <span className="legend-line-label">{soundTransit.lines['1-line'].label}</span>
        </div>
        <div className="legend-line-item">
          <span className="legend-line-circle" style={{ background: soundTransit.lines['2-line'].color }}>2</span>
          <span className="legend-line-label">{soundTransit.lines['2-line'].label}</span>
        </div>
      </div>

      <div className="legend-station-example">
        <div className="legend-pill">
          <span className="legend-pill-circle" style={{ background: soundTransit.lines['1-line'].color }}>1</span>
          <span className="legend-pill-circle" style={{ background: soundTransit.lines['2-line'].color }}>2</span>
          <span className="legend-pill-code">50</span>
        </div>
        <span className="legend-station-desc">Station</span>
      </div>

      <div className="legend-station-parts">
        <div className="legend-part-item">
          <span className="legend-pill-circle small" style={{ background: soundTransit.lines['1-line'].color }}>1</span>
          <span className="legend-part-label">Line number</span>
        </div>
        <div className="legend-part-item">
          <span className="legend-pill-code small">50</span>
          <span className="legend-part-label">Stop code</span>
        </div>
      </div>

      {hasWalksheds && (
        <>
          <div className="legend-divider" />
          <h3 className="legend-title">Walksheds</h3>
          <ul className="legend-list">
            {WALKSHED_LEGEND.filter(w => enabledWalksheds.has(w.minutes)).map(({ minutes, label }) => (
              <li key={minutes} className="legend-item">
                <span
                  className="legend-swatch legend-swatch-walkshed"
                  style={{
                    background: themeAccent,
                    opacity: WALKSHED_OPACITIES[minutes],
                  }}
                />
                <span className="legend-label">{label}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
