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
  if (!ls) return
  try { ls.setItem(STORAGE_KEY, '1') } catch { /* private mode */ }
}
