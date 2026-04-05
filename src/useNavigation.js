import { useCallback, useEffect } from 'react'
import { getNextStation } from './routeGraph'

export function useNavigation({ graphRef, selectedStationRef, currentLine, selectStation }) {
  const navigateDirection = useCallback((arrowKey) => {
    if (!graphRef.current || !selectedStationRef.current) return false
    const result = getNextStation(graphRef.current, selectedStationRef.current.name, arrowKey, currentLine)
    if (!result) return false
    const nextNode = graphRef.current.get(result.name)
    if (!nextNode) return false
    selectStation(result.name, nextNode.coords[0], nextNode.coords[1], result.line)
    return true
  }, [currentLine, selectStation, graphRef, selectedStationRef])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return
      if (navigateDirection(e.key)) e.preventDefault()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigateDirection])

  // Trackpad scroll / mouse wheel navigation
  useEffect(() => {
    const SCROLL_THRESHOLD = 80
    let accumX = 0
    let accumY = 0
    let cooldown = false

    const handleWheel = (e) => {
      if (!selectedStationRef.current) return

      accumX += e.deltaX
      accumY += e.deltaY

      if (cooldown) return

      // Only use horizontal scroll for navigation; vertical scroll is reserved
      // for map zoom and must not trigger station changes.
      let arrowKey = null
      if (Math.abs(accumX) > Math.abs(accumY)) {
        if (accumX < -SCROLL_THRESHOLD) arrowKey = 'ArrowLeft'
        else if (accumX > SCROLL_THRESHOLD) arrowKey = 'ArrowRight'
      }

      if (arrowKey && navigateDirection(arrowKey)) {
        e.preventDefault()
        accumX = 0
        accumY = 0
        cooldown = true
        setTimeout(() => { cooldown = false }, 400)
      }
    }

    window.addEventListener('wheel', handleWheel, { passive: false })
    return () => window.removeEventListener('wheel', handleWheel)
  }, [navigateDirection, selectedStationRef])

  // Touch swipe navigation (mobile)
  useEffect(() => {
    let startX = 0
    let startY = 0
    const SWIPE_THRESHOLD = 50

    const handleTouchStart = (e) => {
      if (!selectedStationRef.current) return
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
    }

    const handleTouchEnd = (e) => {
      if (!selectedStationRef.current) return
      const dx = e.changedTouches[0].clientX - startX
      const dy = e.changedTouches[0].clientY - startY

      if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return

      let arrowKey = null
      if (Math.abs(dy) > Math.abs(dx)) {
        arrowKey = dy < 0 ? 'ArrowDown' : 'ArrowUp'
      } else {
        arrowKey = dx < 0 ? 'ArrowRight' : 'ArrowLeft'
      }

      navigateDirection(arrowKey)
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [navigateDirection, selectedStationRef])
}
