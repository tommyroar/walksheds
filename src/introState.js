const STORAGE_KEY = 'walksheds_intro_v1_seen'

function safeStorage() {
  try {
    if (typeof window === 'undefined') return null
    const ls = window.localStorage
    if (!ls || typeof ls.getItem !== 'function') return null
    return ls
  } catch {
    return null
  }
}

export function shouldShowIntro() {
  if (typeof window === 'undefined') return false
  // ?intro forces the intro regardless of storage or deep link
  const params = new URLSearchParams(window.location.search)
  if (params.has('intro')) return true
  const ls = safeStorage()
  if (ls && ls.getItem(STORAGE_KEY)) return false
  // Skip the intro for deep-linked visits — user already knows what they want
  const base = import.meta.env.BASE_URL
  const path = window.location.pathname
  const normalized = path.endsWith('/') ? path : path + '/'
  const baseNormalized = base.endsWith('/') ? base : base + '/'
  if (normalized !== baseNormalized) return false
  return true
}

export function markIntroSeen() {
  const ls = safeStorage()
  if (ls) {
    try { ls.setItem(STORAGE_KEY, '1') } catch { /* private mode */ }
  }
  // Strip ?intro from the URL so a page refresh doesn't replay
  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href)
    if (url.searchParams.has('intro')) {
      url.searchParams.delete('intro')
      window.history.replaceState(null, '', url.pathname + url.search + url.hash)
    }
  }
}
