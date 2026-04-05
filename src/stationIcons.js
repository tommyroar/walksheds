/**
 * Generate pill-shaped station marker icons matching Sound Transit's style.
 *
 * Each icon contains:
 * - Line number circles (green "1", blue "2", or both for shared stations)
 * - Stop code number in a rounded rectangle
 *
 * Icons are rendered as SVG → Image for use with Mapbox symbol layers.
 */

const LINE_COLORS = {
  '1-line': '#4CAF50',
  '2-line': '#0082C8',
}

const PILL_BG = '#ffffff'
const PILL_BORDER = '#333333'
const CODE_BG = '#e8e8e8'
const CODE_TEXT = '#333333'
const LINE_TEXT = '#ffffff'
const CIRCLE_R = 10
const FONT = 'bold 11px -apple-system, BlinkMacSystemFont, sans-serif'
const CODE_FONT = 'bold 10px -apple-system, BlinkMacSystemFont, sans-serif'

/**
 * Create an SVG string for a station pill icon.
 * @param {string} lines - "1", "2", or "1,2"
 * @param {number|null} stopCode - stop code number
 * @returns {string} SVG markup
 */
function createPillSVG(lines, stopCode) {
  const lineArr = lines.split(',')
  const hasCode = stopCode != null

  // Layout: [circle(s)] [code box]
  const circleCount = lineArr.length
  const circleWidth = circleCount * (CIRCLE_R * 2 + 2)
  const codeWidth = hasCode ? 28 : 0
  const padding = 3
  const gap = hasCode ? 2 : 0
  const totalWidth = padding + circleWidth + gap + codeWidth + padding
  const height = CIRCLE_R * 2 + padding * 2

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}">`

  // Pill background
  svg += `<rect x="0.5" y="0.5" width="${totalWidth - 1}" height="${height - 1}" rx="${height / 2}" ry="${height / 2}" fill="${PILL_BG}" stroke="${PILL_BORDER}" stroke-width="1.5"/>`

  // Line number circles
  let cx = padding + CIRCLE_R
  for (const line of lineArr) {
    const lineId = `${line}-line`
    const color = LINE_COLORS[lineId] || '#999'
    svg += `<circle cx="${cx}" cy="${height / 2}" r="${CIRCLE_R}" fill="${color}"/>`
    svg += `<text x="${cx}" y="${height / 2 + 4}" text-anchor="middle" fill="${LINE_TEXT}" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-size="12" font-weight="bold">${line}</text>`
    cx += CIRCLE_R * 2 + 2
  }

  // Stop code box
  if (hasCode) {
    const boxX = padding + circleWidth + gap
    const boxW = codeWidth
    const boxH = height - padding * 2
    const boxY = padding
    svg += `<rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="4" ry="4" fill="${CODE_BG}"/>`
    svg += `<text x="${boxX + boxW / 2}" y="${boxY + boxH / 2 + 4}" text-anchor="middle" fill="${CODE_TEXT}" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-size="10" font-weight="bold">${stopCode}</text>`
  }

  svg += '</svg>'
  return svg
}

/**
 * Convert SVG string to an Image suitable for map.addImage().
 * Returns a Promise that resolves to { data, width, height }.
 */
function svgToImage(svgStr, scale = 2) {
  return new Promise((resolve) => {
    const img = new Image()
    const blob = new Blob([svgStr], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)

    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      const ctx = canvas.getContext('2d')
      ctx.scale(scale, scale)
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)

      resolve({
        data: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
        width: canvas.width,
        height: canvas.height,
      })
    }
    img.src = url
  })
}

/**
 * Register all needed station icons with the map.
 * Call this after the map loads, passing the station GeoJSON.
 */
export async function registerStationIcons(map, stationsGeoJSON) {
  const iconKeys = new Set()

  for (const feat of stationsGeoJSON.features) {
    const lines = feat.properties.lines || '1'
    const code = feat.properties.stopCode
    const key = `station-${lines}-${code ?? 'none'}`
    if (iconKeys.has(key)) continue
    iconKeys.add(key)

    const svg = createPillSVG(lines, code)
    const imageData = await svgToImage(svg)

    if (!map.hasImage(key)) {
      map.addImage(key, imageData, { pixelRatio: 2 })
    }
  }
}

/**
 * Get the icon key for a station feature.
 */
export function getIconKey(lines, stopCode) {
  return `station-${lines}-${stopCode ?? 'none'}`
}
