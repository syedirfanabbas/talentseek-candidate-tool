import { apiErrorMessage } from './apiError'
const FALLBACK_MESSAGE = 'You have used all of your credits. Buy a pack to continue.'
type ErrorBody = { detail?: unknown } | null
export function outOfCreditsMessage(status: number, body: ErrorBody): string | null {
  if (status !== 402) return null
  const detail = body?.detail
  return detail && typeof detail === 'object' && !Array.isArray(detail) && (detail as { code?: string }).code === 'insufficient_credits' && typeof (detail as { message?: unknown }).message === 'string' ? (detail as { message: string }).message : FALLBACK_MESSAGE
}
export function errorDetail(body: ErrorBody, fallback: string): string { return apiErrorMessage(body, fallback) }
