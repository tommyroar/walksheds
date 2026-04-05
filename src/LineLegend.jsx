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
      <h3 className="legend-title">{soundTransit.label}</h3>
      <ul className="legend-list">
        {Object.entries(soundTransit.lines).map(([key, line]) => (
          <li key={key} className="legend-item">
            <span className="legend-swatch" style={{ background: line.color }} />
            <span className="legend-label">{line.label}</span>
          </li>
        ))}
      </ul>

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
