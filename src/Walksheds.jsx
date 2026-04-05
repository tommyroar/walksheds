import { useState, useCallback, useRef, useEffect } from 'react'
import { buildGraph, isJunction, getJunctionHints } from './routeGraph'
import { fetchWalkshed, getLargestEnabledBounds } from './mapbox'
import { WALKSHED_OPTIONS, LINE_COLORS, WALKSHED_ACCENT_LIGHT, WALKSHED_ACCENT_DARK } from './constants'
import { useNavigation } from './useNavigation'
import MapView from './MapView'
import LineLegend from './LineLegend'
import './walksheds.css'

export default function Walksheds() {
  const [popup, setPopup] = useState(null)
  const [walksheds, setWalksheds] = useState({})
  const [enabledWalksheds, setEnabledWalksheds] = useState(new Set([5, 10, 15]))
  const [currentLine, setCurrentLine] = useState(null)
  const [junctionHints, setJunctionHints] = useState([])
  const [darkMode, setDarkMode] = useState(false)
  const [line1Data, setLine1Data] = useState(null)
  const [line2Data, setLine2Data] = useState(null)
  const [stationsData, setStationsData] = useState(null)
  const mapViewRef = useRef(null)
  const selectedStationRef = useRef(null)
  const graphRef = useRef(null)

  useEffect(() => {
    const base = import.meta.env.BASE_URL
    fetch(`${base}line1-alignment.geojson`).then(r => r.json()).then(setLine1Data)
    fetch(`${base}line2-alignment.geojson`).then(r => r.json()).then(setLine2Data)
    fetch(`${base}all-stations.geojson`).then(r => r.json()).then(setStationsData)
  }, [])

  useEffect(() => {
    if (stationsData) graphRef.current = buildGraph(stationsData)
  }, [stationsData])

  const handleWalkshedToggle = useCallback((minutes) => {
    setEnabledWalksheds(prev => {
      const next = new Set(prev)
      if (next.has(minutes)) next.delete(minutes)
      else next.add(minutes)
      return next
    })
  }, [])

  const selectStation = useCallback((name, lng, lat, line) => {
    selectedStationRef.current = { name, lng, lat }
    const feat = stationsData?.features.find(f => f.properties.name === name)
    const stopCode = feat?.properties.stopCode ?? null
    const lines = feat?.properties.lines ?? line.replace('-line', '')
    setPopup({ longitude: lng, latitude: lat, name, line, stopCode, lines })
    setCurrentLine(line)
    setWalksheds({})

    if (graphRef.current && isJunction(graphRef.current, name)) {
      setJunctionHints(getJunctionHints(graphRef.current, name))
    } else {
      setJunctionHints([])
    }

    const results = {}
    Promise.all(
      WALKSHED_OPTIONS.map(async (min) => {
        const data = await fetchWalkshed(lng, lat, min)
        if (data) results[min] = data
      })
    ).then(() => {
      if (selectedStationRef.current?.name !== name) return
      setWalksheds(results)

      const bounds = getLargestEnabledBounds(results, enabledWalksheds)
      if (bounds) {
        mapViewRef.current?.fitBounds(bounds, { padding: 60, duration: 600 })
      }
    })
  }, [stationsData, enabledWalksheds])

  // Re-fit map when walkshed toggles change
  useEffect(() => {
    if (!Object.keys(walksheds).length) return
    const bounds = getLargestEnabledBounds(walksheds, enabledWalksheds)
    if (bounds) {
      mapViewRef.current?.fitBounds(bounds, { padding: 60, duration: 600 })
    }
  }, [enabledWalksheds, walksheds])

  const handleDeselect = useCallback(() => {
    selectedStationRef.current = null
    setPopup(null)
    setWalksheds({})
    setCurrentLine(null)
    setJunctionHints([])
  }, [])

  useNavigation({ graphRef, selectedStationRef, currentLine, selectStation })

  return (
    <div className={`app ${darkMode ? 'dark' : ''}`}>
      <MapView
        ref={mapViewRef}
        darkMode={darkMode}
        walksheds={walksheds}
        enabledWalksheds={enabledWalksheds}
        popup={popup}
        junctionHints={junctionHints}
        line1Data={line1Data}
        line2Data={line2Data}
        stationsData={stationsData}
        onStationClick={selectStation}
        onDeselect={handleDeselect}
      />

      <LineLegend
        lineColors={LINE_COLORS}
        enabledWalksheds={enabledWalksheds}
        walkshedAccent={darkMode ? WALKSHED_ACCENT_DARK : WALKSHED_ACCENT_LIGHT}
        onWalkshedToggle={handleWalkshedToggle}
        darkMode={darkMode}
        onDarkModeToggle={() => setDarkMode(d => !d)}
      />
    </div>
  )
}
