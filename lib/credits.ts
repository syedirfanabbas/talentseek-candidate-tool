const FALLBACK_MESSAGE = 'You have used all of your credits. Buy a pack to continue.'

type ErrorBody = { detail?: string | { code?: string; message?: string } } | null

// Returns the message to show when the backend refused an AI request for lack of credits.
export function outOfCreditsMessage(status: number, body: ErrorBody): string | null {
  if (status !== 402) return null
  const detail = body?.detail
  return typeof detail === 'object' && detail?.code === 'insufficient_credits' && detail.message ? detail.message : FALLBACK_MESSAGE
}

// FastAPI returns `detail` as a string for ordinary errors and as an object for structured ones.
export function errorDetail(body: ErrorBody, fallback: string): string {
  const detail = body?.detail
  if (typeof detail === 'string') return detail
  return detail?.message || fallback
}
