/**
 * Reject JS holes that stringify into a location path.
 * `window.location.href = undefined` and `<Navigate to={id} />` become "/undefined".
 */
export function isUsableBrowserPath(value) {
    if (typeof value !== 'string') return false
    const path = value.trim()
    if (!path || path === 'undefined' || path === 'null') return false
    const last = path.split('?')[0].split('#')[0].replace(/\/+$/, '').split('/').pop() || ''
    return last !== 'undefined' && last !== 'null'
}

export function isMissingFlowPath(value) {
    return !isUsableBrowserPath(typeof value === 'string' ? value : String(value ?? ''))
}

function pathnameOf(value, fallback = '/') {
    try {
        return new URL(value, 'http://local.invalid' + (fallback.startsWith('/') ? fallback : '/')).pathname
    } catch {
        return typeof value === 'string' && value.startsWith('/') ? value.split('?')[0] : fallback
    }
}

export function assignLocationIfUsable(value, locationRef = typeof window !== 'undefined' ? window.location : null) {
    if (!locationRef || !isUsableBrowserPath(value)) return false
    const current = pathnameOf(locationRef.pathname || '/', '/')
    const next = pathnameOf(value, current)
    if (current === next) return false
    locationRef.href = value
    return true
}

export function replaceMissingFlowPath(
    locationRef = typeof window !== 'undefined' ? window.location : null,
    historyRef = typeof window !== 'undefined' ? window.history : null
) {
    if (!locationRef || !historyRef) return false
    const path = locationRef.pathname || ''
    if (!isMissingFlowPath(path) && path !== '/undefined' && path !== '/null') return false
    const last = path.replace(/\/+$/, '').split('/').pop() || ''
    if (last !== 'undefined' && last !== 'null') return false
    historyRef.replaceState(null, '', '/')
    return true
}
