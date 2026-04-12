import { useState, useCallback, useMemo, useRef, useEffect } from 'react'

export default function POISearch({ availableTags, activeFilters, poiFeatures, expandedTag, onExpandTag, onAddFilter, onRemoveFilter, onClearFilters, onPoiSelect }) {
  const [query, setQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [highlightIdx, setHighlightIdx] = useState(0)
  const [poiHighlightIdx, setPoiHighlightIdx] = useState(0)
  const inputRef = useRef(null)
  const containerRef = useRef(null)
  const poiListRef = useRef(null)

  // Build tag → color and tag → count lookups from availableTags
  const { tagColors, tagCounts } = useMemo(() => {
    const colors = {}
    const counts = {}
    for (const { tag, color, count } of availableTags) {
      if (color) colors[tag] = color
      counts[tag] = count
    }
    return { tagColors: colors, tagCounts: counts }
  }, [availableTags])

  // Features matching the expanded tag
  const poisForTag = useMemo(() => {
    if (!expandedTag || !poiFeatures) return []
    return poiFeatures.filter(f => {
      const tags = f.properties?.tags
      return Array.isArray(tags) && tags.includes(expandedTag)
    }).sort((a, b) => (a.properties.name || '').localeCompare(b.properties.name || ''))
  }, [expandedTag, poiFeatures])

  // Scroll highlighted POI into view
  useEffect(() => {
    if (!poiListRef.current) return
    const items = poiListRef.current.querySelectorAll('[data-poi-item]')
    items[poiHighlightIdx]?.scrollIntoView({ block: 'nearest' })
  }, [poiHighlightIdx])

  // Filter available tags by search query, excluding already-active filters
  // When query is empty, show top tags so arrow-key browsing works on focus
  const matches = useMemo(() => {
    const filtered = availableTags.filter(({ tag }) => !activeFilters.has(tag))
    if (!query.trim()) return filtered.slice(0, 8)
    return filtered
      .filter(({ tag }) => tag.includes(query.trim().toLowerCase()))
      .slice(0, 8)
  }, [query, availableTags, activeFilters])

  const handleSelect = useCallback((tag) => {
    onAddFilter(tag)
    setQuery('')
    setShowDropdown(false)
    setHighlightIdx(0)
    inputRef.current?.focus()
  }, [onAddFilter])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      setShowDropdown(false)
      setQuery('')
      inputRef.current?.blur()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      e.stopPropagation()
      if (!showDropdown) setShowDropdown(true)
      setHighlightIdx(i => Math.min(i + 1, matches.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      e.stopPropagation()
      if (!showDropdown) setShowDropdown(true)
      setHighlightIdx(i => Math.max(i - 1, 0))
      return
    }
    if (e.key === 'Enter' && matches.length > 0) {
      e.preventDefault()
      handleSelect(matches[highlightIdx]?.tag || matches[0].tag)
      return
    }
  }, [matches, highlightIdx, handleSelect, showDropdown])

  const handleInput = useCallback((e) => {
    setQuery(e.target.value)
    setShowDropdown(true)
    setHighlightIdx(0)
  }, [])

  const handleTagTextClick = useCallback((tag, e) => {
    e.stopPropagation()
    const next = expandedTag === tag ? null : tag
    onExpandTag(next)
    setPoiHighlightIdx(0)
    if (next) {
      requestAnimationFrame(() => poiListRef.current?.focus())
    }
  }, [expandedTag, onExpandTag])

  const handleRemoveTag = useCallback((tag, e) => {
    e.stopPropagation()
    if (expandedTag === tag) onExpandTag(null)
    onRemoveFilter(tag)
  }, [expandedTag, onExpandTag, onRemoveFilter])

  const handlePoiListKeyDown = useCallback((e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      e.stopPropagation()
      setPoiHighlightIdx(i => Math.min(i + 1, poisForTag.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      e.stopPropagation()
      setPoiHighlightIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && poisForTag.length > 0) {
      e.preventDefault()
      onPoiSelect?.(poisForTag[poiHighlightIdx])
    } else if (e.key === 'Escape') {
      onExpandTag(null)
    }
  }, [poisForTag, poiHighlightIdx, onPoiSelect, onExpandTag])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false)
        onExpandTag(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onExpandTag])

  return (
    <div className="poi-search" ref={containerRef}>
      <div className="poi-search-input-row">
        <svg className="poi-search-icon" width="14" height="14" viewBox="0 0 16 16" fill="none">
          <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M10.5 10.5L14.5 14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <input
          ref={inputRef}
          className="poi-search-input"
          type="text"
          placeholder="Search places..."
          value={query}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowDropdown(true)}
        />
      </div>

      {showDropdown && matches.length > 0 && (
        <div className="poi-search-dropdown">
          {matches.map(({ tag, count, color }, i) => (
            <button
              key={tag}
              className={`poi-search-option ${i === highlightIdx ? 'highlighted' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(tag) }}
              onMouseEnter={() => setHighlightIdx(i)}
            >
              {color && <span className="poi-search-option-dot" style={{ background: color }} />}
              <span className="poi-search-option-tag">{tag}</span>
              <span className="poi-search-option-count">{count}</span>
            </button>
          ))}
        </div>
      )}

      {activeFilters.size > 0 && (
        <div className="poi-chips">
          {[...activeFilters].map(tag => (
            <div key={tag} className="poi-chip"
              style={tagColors[tag] ? { borderColor: tagColors[tag] + '40', color: tagColors[tag] } : undefined}
            >
              <span className="poi-chip-text" onClick={(e) => handleTagTextClick(tag, e)}>{tag}</span>
              {tagCounts[tag] != null && <span className="poi-chip-count" onClick={(e) => handleTagTextClick(tag, e)}>{tagCounts[tag]}</span>}
              <span className="legend-filter-remove" onClick={(e) => handleRemoveTag(tag, e)}>
                <svg width="8" height="8" viewBox="0 0 8 8">
                  <path d="M1.5 1.5l5 5M6.5 1.5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </span>
            </div>
          ))}
          {activeFilters.size >= 2 && (
            <button className="poi-chip poi-chip-clear" onClick={onClearFilters}>
              clear all
            </button>
          )}
        </div>
      )}

      {expandedTag && poisForTag.length > 0 && (
        <div className="poi-chip-poi-list" ref={poiListRef} tabIndex={-1} onKeyDown={handlePoiListKeyDown}>
          {poisForTag.map((f, i) => (
            <button
              key={f.properties.id}
              data-poi-item
              className={`poi-chip-poi-item ${i === poiHighlightIdx ? 'highlighted' : ''}`}
              onClick={() => onPoiSelect?.(f)}
              onMouseEnter={() => setPoiHighlightIdx(i)}
            >
              <span className="poi-chip-poi-dot" style={{ background: tagColors[expandedTag] || '#999' }} />
              <span className="poi-chip-poi-name">{f.properties.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
