export const RETRY_ADVICE = 'Please try again, or try a different file.'

export function withRetryAdvice(message: string): string {
  return message.includes(RETRY_ADVICE) ? message : `${message.trim().replace(/[.\s]+$/, '')}. ${RETRY_ADVICE}`
}
