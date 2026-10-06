type ValidationIssue = { loc?: unknown[]; msg?: string }
type ErrorBody = { detail?: unknown } | null | undefined

export function apiErrorMessage(body: ErrorBody, fallback: string): string {
  const detail = body?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const message = (detail as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }
  if (Array.isArray(detail)) {
    const messages = detail.map((issue: ValidationIssue) => {
      const field = Array.isArray(issue?.loc) ? String(issue.loc[issue.loc.length - 1] || '').replace(/_/g, ' ') : ''
      const text = String(issue?.msg || '').replace(/^Value error, /, '')
      return text ? `${field ? field.charAt(0).toUpperCase() + field.slice(1) + ': ' : ''}${text}` : ''
    }).filter(Boolean)
    if (messages.length) return messages.join(' · ')
  }
  return fallback
}
