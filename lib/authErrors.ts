// Supabase returns error code "email_not_confirmed" when signing in before confirming the email.
export function isEmailNotConfirmed(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  return error.code === 'email_not_confirmed' || /email not confirmed/i.test(error.message || '')
}
