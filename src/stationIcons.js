/**
 * Generate pill-shaped station marker icons matching Sound Transit's style.
 * Both light and dark variants are registered so the symbol layer can
 * swap between them via the icon-image expression.
 */

const LINE_COLORS = {
  '1-line': '#4CAF50',
  '2-line': '#0082C8',
}

const THEMES = {
  light: { pillBg: '#ffffff', pillBorder: '#333333', codeBg: '#e8e8e8', codeText: '#333333' },
  dark:  { pillBg: '#2a2a3a', pillBorder: 'rgba(255,255,255,0.35)', codeBg: 'rgba(255,255,255,0.12)', codeText: '#dddddd' },
}

const LINE_TEXT = '#ffffff'
const CIRCLE_R = 10

function createPillSVG(lines, stopCode, mode = 'light') {
  const t = THEMES[mode]
  const lineArr = lines.split(',')
  const hasCode = stopCode != null

  const circleWidth = lineArr.length * (CIRCLE_R * 2 + 2)
  const codeWidth = hasCode ? 28 : 0
  const padding = 3
  const gap = hasCode ? 2 : 0
  const totalWidth = padding + circleWidth + gap + codeWidth + padding
  const height = CIRCLE_R * 2 + padding * 2

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}">`
  svg += `<rect x="0.5" y="0.5" width="${totalWidth - 1}" height="${height - 1}" rx="${height / 2}" ry="${height / 2}" fill="${t.pillBg}" stroke="${t.pillBorder}" stroke-width="1.5"/>`

  let cx = padding + CIRCLE_R
  for (const line of lineArr) {
    const color = LINE_COLORS[`${line}-line`] || '#999'
    svg += `<circle cx="${cx}" cy="${height / 2}" r="${CIRCLE_R}" fill="${color}"/>`
    svg += `<text x="${cx}" y="${height / 2 + 4}" text-anchor="middle" fill="${LINE_TEXT}" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-size="12" font-weight="bold">${line}</text>`
    cx += CIRCLE_R * 2 + 2
  }

  if (hasCode) {
    const boxX = padding + circleWidth + gap
    const boxW = codeWidth
    const boxH = height - padding * 2
    const boxY = padding
    svg += `<rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="4" ry="4" fill="${t.codeBg}"/>`
    svg += `<text x="${boxX + boxW / 2}" y="${boxY + boxH / 2 + 4}" text-anchor="middle" fill="${t.codeText}" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-size="10" font-weight="bold">${stopCode}</text>`
  }

  svg += '</svg>'
  return svg
}

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
 * Register both light and dark icon variants for all stations.
 * Icon keys: `station-light-{lines}-{code}` and `station-dark-{lines}-{code}`
 */
export async function registerStationIcons(map, stationsGeoJSON) {
  const iconKeys = new Set()

  for (const feat of stationsGeoJSON.features) {
    const lines = feat.properties.lines || '1'
    const code = feat.properties.stopCode
    const baseKey = `${lines}-${code ?? 'none'}`
    if (iconKeys.has(baseKey)) continue
    iconKeys.add(baseKey)

    for (const mode of ['light', 'dark']) {
      const key = `station-${mode}-${baseKey}`
      if (map.hasImage(key)) continue
      const svg = createPillSVG(lines, code, mode)
      const imageData = await svgToImage(svg)
      map.addImage(key, imageData, { pixelRatio: 2 })
    }
  }
}
