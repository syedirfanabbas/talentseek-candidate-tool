const APP_ORIGIN = 'https://app.talentseek.ca'
const APP_PATHS = new Set(['/', '/dashboard', '/master-resume', '/my-resumes', '/interview-prep', '/admin', '/admin/dashboard', '/admin/prompts', '/recruiter', '/recruiter/dashboard', '/recruiter/requests'])

export function defaultDestinationForRole(role: string | undefined): string {
  if (role === 'admin') return '/admin/dashboard'
  if (role === 'recruiter') return '/recruiter/dashboard'
  return '/dashboard'
}

// Only return to existing app pages. Never redirect to an external URL or auth itself.
export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020]/.test(value)) return '/dashboard'
  try {
    const url = new URL(value, APP_ORIGIN)
    if (url.origin !== APP_ORIGIN || !APP_PATHS.has(url.pathname)) return '/dashboard'
    return url.pathname + url.search + url.hash
  } catch {
    return '/dashboard'
  }
}

export function signInUrl(destination: string): string {
  return `/auth?${new URLSearchParams({ next: safeReturnTo(destination) })}`
}
