'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { defaultDestinationForRole, safeReturnTo } from '../../lib/navigation'
import { isEmailNotConfirmed } from '../../lib/authErrors'
import { MARKETING_CONSENT_TEXT, MARKETING_CONSENT_VERSION, PRIVACY_URL, TERMS_URL } from '../../lib/legal'

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [accountType, setAccountType] = useState<'candidate' | 'employer'>('candidate')
  const [marketingOptIn, setMarketingOptIn] = useState(false)
  // Set when the account exists but its email is not confirmed yet, so the user can request a new link.
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const widgetRef = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | number | null>(null)
  const [captchaToken, setCaptchaToken] = useState('')
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  useEffect(() => {
    if (!siteKey || !widgetRef.current) return
    const render = () => { const turnstile = (window as any).turnstile; if (turnstile && widgetRef.current && widgetId.current === null) widgetId.current = turnstile.render(widgetRef.current, { sitekey: siteKey, callback: (token: string) => setCaptchaToken(token), 'error-callback': () => setMessage({ text: 'Security check failed. Please try again.', type: 'error' }) }) }
    const script = document.createElement('script'); script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; script.async = true; script.onload = render; document.head.appendChild(script); render()
    return () => { script.remove() }
  }, [siteKey])
  const resetCaptcha = () => { const turnstile = (window as any).turnstile; if (turnstile && widgetId.current !== null) turnstile.reset(widgetId.current); setCaptchaToken('') }
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const resendConfirmation = async () => {
    if (!unconfirmedEmail) return
    setIsLoading(true)
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: unconfirmedEmail,
      options: { emailRedirectTo: `${window.location.origin}/auth`, ...(captchaToken ? { captchaToken } : {}) },
    })
    setIsLoading(false)
    resetCaptcha()
    setMessage(error
      ? { text: /rate limit|too many requests|seconds/i.test(error.message) ? 'Please wait a minute before requesting another confirmation email.' : error.message, type: 'error' }
      : { text: `A new confirmation link was sent to ${unconfirmedEmail}. It is valid for 24 hours. If you don't see it, check your spam or junk folder.`, type: 'success' })
  }

  const handleSubmit = async () => {
    if (isLoading) return
    const next = new URLSearchParams(window.location.search).get('next')
    const destination = next ? safeReturnTo(next) : '/dashboard'
    if (!email.trim() || (mode !== 'forgot' && !password.trim())) {
      setMessage({ text: mode === 'forgot' ? 'Please enter your email address' : 'Please enter your email and password', type: 'error' })
      return
    }
    if (mode === 'register' && !name.trim()) {
      setMessage({ text: 'Please enter your name', type: 'error' })
      return
    }
    if (mode !== 'forgot' && password.length < 6) {
      setMessage({ text: 'Password must be at least 6 characters', type: 'error' })
      return
    }

    setIsLoading(true)
    setMessage(null)

    try {
      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/auth/reset-password`, ...(captchaToken ? { captchaToken } : {}),
        })
        if (error) throw error
        setMessage({ text: 'If an account exists for this email, a password-reset link is on its way. Please check your inbox and spam folder.', type: 'success' })
      } else if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`, ...(captchaToken ? { captchaToken } : {}),
            data: {
              full_name: name,
              account_type: accountType,
              // Recorded in Supabase's append-only consent ledger at sign-up (migration 014).
              marketing_opt_in: marketingOptIn,
              marketing_consent_version: MARKETING_CONSENT_VERSION,
            },
          },
        })
        if (error) throw error
        if (data.user && data.user.identities?.length === 0) {
          setMessage({ text: 'An account already exists for this email. Sign in or use Forgot password.', type: 'error' })
          setMode('login')
          return
        }
        if (data.session) {
          window.location.replace(defaultDestinationForRole(undefined, accountType))
          return
        }
        setMessage({ text: 'Account created! Please check your email to confirm your account, then log in. No email after a few minutes? Check your spam or junk folder.', type: 'success' })
        setUnconfirmedEmail(email.trim())
        setMode('login')
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password, ...(captchaToken ? { options: { captchaToken } } : {}) })
        if (error) throw error
        setMessage({ text: 'Login successful! Redirecting...', type: 'success' })
        window.location.replace(next ? destination : defaultDestinationForRole(data.user?.app_metadata?.role, data.user?.user_metadata?.account_type))
      }
    } catch (err: any) {
      if (mode === 'login' && isEmailNotConfirmed(err)) {
        setUnconfirmedEmail(email.trim())
        setMessage({ text: 'Please confirm your email before signing in. Check your inbox and spam folder, or send a new confirmation link below.', type: 'error' })
        return
      }
      const errorText = String(err?.message || '')
      const rateLimited = /rate limit|too many requests/i.test(errorText)
      setMessage({
        text: rateLimited
          ? 'TalentSeek’s email service is temporarily at its sending limit. Please wait up to one hour before requesting another email.'
          : errorText || 'Something went wrong',
        type: 'error',
      })
    } finally {
      resetCaptcha()
      setIsLoading(false)
    }
  }

  return (
    <main className='min-h-screen bg-slate-50 flex items-center justify-center px-6 py-12'>
      <div className='w-full max-w-md'>

        {/* Beta banner */}
        <div className='mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center'>
          <span className='inline-block rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold uppercase tracking-widest text-amber-800 mb-1'>Beta</span>
          <p className='text-sm text-amber-700'>This tool is currently free during our beta period. A paid subscription will be required when we launch publicly.</p>
        </div>

        <div className='rounded-2xl bg-white p-8 shadow-sm'>
          {/* Logo */}
          <div className='mb-8 text-center'>
            <h1 className='text-3xl font-bold text-slate-900'>TalentSeek</h1>
            <p className='mt-2 text-slate-500'>AI Resume Optimization Tool</p>
          </div>

          {/* Tabs */}
          {mode === 'forgot' ? (
            <div className='mb-6'>
              <button onClick={() => { setMode('login'); setMessage(null) }} className='text-sm font-medium text-slate-600 hover:text-slate-900'>← Back to sign in</button>
              <h2 className='mt-4 text-xl font-bold text-slate-900'>Reset your password</h2>
              <p className='mt-2 text-sm leading-6 text-slate-500'>Enter your account email and we’ll send you a secure reset link.</p>
            </div>
          ) : (
            <div className='mb-6 flex rounded-xl border border-slate-200 p-1'>
              <button onClick={() => { setMode('login'); setMessage(null) }}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                  mode === 'login' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}>
                Sign In
              </button>
              <button onClick={() => { setMode('register'); setMessage(null) }}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                  mode === 'register' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}>
                Create Account
              </button>
            </div>
          )}

          {/* Form */}
          <div className='space-y-4'>
            {mode === 'register' && (
              <>
                <fieldset>
                  <legend className='mb-2 block text-sm font-medium text-slate-700'>I am creating an account as</legend>
                  <div className='grid grid-cols-2 gap-3'>
                    <button type='button' onClick={() => setAccountType('candidate')} aria-pressed={accountType === 'candidate'}
                      className={`rounded-xl border p-3 text-left transition-colors ${accountType === 'candidate' ? 'border-teal-600 bg-teal-50 text-teal-950' : 'border-slate-200 text-slate-700 hover:border-slate-400'}`}>
                      <span className='block text-sm font-semibold'>Candidate</span>
                      <span className='mt-1 block text-xs leading-5'>Find jobs and improve my resume</span>
                    </button>
                    <button type='button' onClick={() => setAccountType('employer')} aria-pressed={accountType === 'employer'}
                      className={`rounded-xl border p-3 text-left transition-colors ${accountType === 'employer' ? 'border-teal-600 bg-teal-50 text-teal-950' : 'border-slate-200 text-slate-700 hover:border-slate-400'}`}>
                      <span className='block text-sm font-semibold'>Employer</span>
                      <span className='mt-1 block text-xs leading-5'>Post and manage job opportunities</span>
                    </button>
                  </div>
                </fieldset>
                <div>
                  <label className='mb-1 block text-sm font-medium text-slate-700'>Full Name</label>
                  <input value={name} onChange={e => setName(e.target.value)}
                    placeholder='John Smith'
                    className='w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-500' />
                </div>
              </>
            )}
            <div>
              <label className='mb-1 block text-sm font-medium text-slate-700'>Email</label>
              <input type='email' value={email} onChange={e => setEmail(e.target.value)}
                placeholder='you@example.com'
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                className='w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-500' />
            </div>
            {mode !== 'forgot' && <div>
              <label className='mb-1 block text-sm font-medium text-slate-700'>Password</label>
              <input type='password' value={password} onChange={e => setPassword(e.target.value)}
                placeholder='Minimum 6 characters'
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                className='w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-500' />
            </div>}
            {mode === 'register' && (
              <label className='flex items-start gap-3 text-sm leading-6 text-slate-600'>
                <input type='checkbox' checked={marketingOptIn} onChange={e => setMarketingOptIn(e.target.checked)}
                  className='mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-teal-700' />
                <span>{MARKETING_CONSENT_TEXT} <span className='text-slate-400'>(Optional)</span></span>
              </label>
            )}
          </div>

          {siteKey && <div ref={widgetRef} className='mt-4' />}

          {message && (
            <div className={`mt-4 rounded-xl p-3 text-sm ${
              message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              {message.text}
            </div>
          )}

          {mode === 'login' && unconfirmedEmail && (
            <button onClick={() => void resendConfirmation()} disabled={isLoading}
              className='mt-3 w-full rounded-xl border border-slate-300 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50'>
              Resend confirmation email
            </button>
          )}

          <button onClick={handleSubmit} disabled={isLoading}
            className='mt-6 w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50'>
            {isLoading ? 'Please wait...' : mode === 'forgot' ? 'Send Reset Link' : mode === 'login' ? 'Sign In' : accountType === 'employer' ? 'Create Employer Account' : 'Create Candidate Account'}
          </button>

          {mode === 'login' && (
            <button onClick={() => { setMode('forgot'); setMessage(null) }} className='mt-4 w-full text-center text-sm font-medium text-teal-700 hover:text-teal-900'>Forgot password?</button>
          )}

          {mode === 'register' && (
            <><p className='mt-4 text-center text-sm font-medium text-emerald-800'>Free to start: 1 tailored resume + 1 interview-prep pack. No card needed.</p><p className='mt-3 text-center text-xs leading-5 text-slate-500'>
              By creating an account you agree to the <a href={TERMS_URL} target='_blank' rel='noopener noreferrer' className='underline hover:text-slate-700'>Terms of Service</a> and acknowledge the <a href={PRIVACY_URL} target='_blank' rel='noopener noreferrer' className='underline hover:text-slate-700'>Privacy Policy</a>. Start free — no credit card required.
            </p></>
          )}
        </div>

        <p className='mt-6 text-center text-xs text-slate-400'>
          <a href='https://talentseek.ca' className='hover:text-slate-600'>← Back to TalentSeek.ca</a>
        </p>
      </div>
    </main>
  )
}
