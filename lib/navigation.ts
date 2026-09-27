const APP_ORIGIN = 'https://app.talentseek.ca'
const APP_PATHS = new Set(['/', '/dashboard', '/master-resume', '/my-resumes', '/interview-prep', '/job-search-demo', '/jobs', '/employer/jobs', '/employer/jobs/new', '/admin', '/admin/dashboard', '/admin/prompts', '/admin/jobs', '/recruiter', '/recruiter/dashboard', '/recruiter/requests'])
const APP_PATH_PATTERNS = [/^\/jobs\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i]

export function defaultDestinationForRole(role: string | undefined, accountType?: string): string {
  if (role === 'admin') return '/admin/dashboard'
  if (role === 'recruiter') return '/recruiter/dashboard'
  if (role === 'employer' || accountType === 'employer') return '/employer/jobs'
  return '/dashboard'
}

// Only return to existing app pages. Never redirect to an external URL or auth itself.
export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020]/.test(value)) return '/dashboard'
  try {
    const url = new URL(value, APP_ORIGIN)
    if (url.origin !== APP_ORIGIN || (!APP_PATHS.has(url.pathname) && !APP_PATH_PATTERNS.some(pattern => pattern.test(url.pathname)))) return '/dashboard'
    return url.pathname + url.search + url.hash
  } catch {
    return '/dashboard'
  }
}

export function signInUrl(destination: string): string {
  return `/auth?${new URLSearchParams({ next: safeReturnTo(destination) })}`
}
