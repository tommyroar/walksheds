import { themes } from './themes'

export default function LineLegend({ themeId }) {
  const theme = themes[themeId]
  if (!theme) return null

  return (
    <div className="line-legend">
      <h3 className="legend-title">{theme.label}</h3>
      <ul className="legend-list">
        {Object.entries(theme.lines).map(([key, line]) => (
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
