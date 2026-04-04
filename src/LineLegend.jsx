import { themes } from './themes'

const soundTransit = themes['sound-transit']

export default function LineLegend() {
  return (
    <div className="line-legend">
      <h3 className="legend-title">{soundTransit.label}</h3>
      <ul className="legend-list">
        {Object.entries(soundTransit.lines).map(([key, line]) => (
          <li key={key} className="legend-item">
            <span
              className="legend-swatch"
              style={{ background: line.color }}
            />
            <span className="legend-label">{line.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
