import { useState, useCallback, useMemo, useRef, useEffect } from 'react'

export default function POISearch({ availableTags, activeFilters, onAddFilter, onRemoveFilter, onClearFilters }) {
  const [query, setQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [highlightIdx, setHighlightIdx] = useState(0)
  const inputRef = useRef(null)
  const containerRef = useRef(null)

  // Filter available tags by search query, excluding already-active filters
  const matches = useMemo(() => query.trim()
    ? availableTags
        .filter(({ tag }) => !activeFilters.has(tag) && tag.includes(query.trim().toLowerCase()))
        .slice(0, 8)
    : [], [query, availableTags, activeFilters])

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
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIdx(i => Math.min(i + 1, matches.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIdx(i => Math.max(i - 1, 0))
      return
    }
    if (e.key === 'Enter' && matches.length > 0) {
      e.preventDefault()
      handleSelect(matches[highlightIdx]?.tag || matches[0].tag)
      return
    }
  }, [matches, highlightIdx, handleSelect])

  const handleInput = useCallback((e) => {
    setQuery(e.target.value)
    setShowDropdown(true)
    setHighlightIdx(0)
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

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
          onFocus={() => query.trim() && setShowDropdown(true)}
        />
      </div>

      {showDropdown && matches.length > 0 && (
        <div className="poi-search-dropdown">
          {matches.map(({ tag, count }, i) => (
            <button
              key={tag}
              className={`poi-search-option ${i === highlightIdx ? 'highlighted' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(tag) }}
              onMouseEnter={() => setHighlightIdx(i)}
            >
              <span className="poi-search-option-tag">{tag}</span>
              <span className="poi-search-option-count">{count}</span>
            </button>
          ))}
        </div>
      )}

      {activeFilters.size > 0 && (
        <div className="poi-chips">
          {[...activeFilters].map(tag => (
            <button key={tag} className="poi-chip" onClick={() => onRemoveFilter(tag)}>
              <span className="poi-chip-text">{tag}</span>
              <svg className="poi-chip-x" width="10" height="10" viewBox="0 0 10 10">
                <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          ))}
          {activeFilters.size >= 2 && (
            <button className="poi-chip poi-chip-clear" onClick={onClearFilters}>
              clear all
            </button>
          )}
        </div>
      )}
    </div>
  )
}
