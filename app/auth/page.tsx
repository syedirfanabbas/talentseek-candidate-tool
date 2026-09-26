'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { defaultDestinationForRole, safeReturnTo } from '../../lib/navigation'

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [accountType, setAccountType] = useState<'candidate' | 'employer'>('candidate')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const handleSubmit = async () => {
    if (isLoading) return
    const next = new URLSearchParams(window.location.search).get('next')
    const destination = next ? safeReturnTo(next) : '/dashboard'
    if (!email.trim() || !password.trim()) {
      setMessage({ text: 'Please enter your email and password', type: 'error' })
      return
    }
    if (mode === 'register' && !name.trim()) {
      setMessage({ text: 'Please enter your name', type: 'error' })
      return
    }
    if (password.length < 6) {
      setMessage({ text: 'Password must be at least 6 characters', type: 'error' })
      return
    }

    setIsLoading(true)
    setMessage(null)

    try {
      if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name, account_type: accountType } }
        })
        if (error) throw error
        if (data.session) {
          window.location.replace(defaultDestinationForRole(undefined, accountType))
          return
        }
        setMessage({ text: 'Account created! Please check your email to confirm your account, then log in.', type: 'success' })
        setMode('login')
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        setMessage({ text: 'Login successful! Redirecting...', type: 'success' })
        window.location.replace(next ? destination : defaultDestinationForRole(data.user?.app_metadata?.role, data.user?.user_metadata?.account_type))
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Something went wrong', type: 'error' })
    } finally {
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
            <div>
              <label className='mb-1 block text-sm font-medium text-slate-700'>Password</label>
              <input type='password' value={password} onChange={e => setPassword(e.target.value)}
                placeholder='Minimum 6 characters'
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                className='w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-500' />
            </div>
          </div>

          {message && (
            <div className={`mt-4 rounded-xl p-3 text-sm ${
              message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              {message.text}
            </div>
          )}

          <button onClick={handleSubmit} disabled={isLoading}
            className='mt-6 w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50'>
            {isLoading ? 'Please wait...' : mode === 'login' ? 'Sign In' : accountType === 'employer' ? 'Create Employer Account' : 'Create Candidate Account'}
          </button>

          {mode === 'register' && (
            <p className='mt-4 text-center text-xs text-slate-400'>
              By creating an account you agree to our terms of service. This is a free beta — no credit card required.
            </p>
          )}
        </div>

        <p className='mt-6 text-center text-xs text-slate-400'>
          <a href='https://talentseek.ca' className='hover:text-slate-600'>← Back to TalentSeek.ca</a>
        </p>
      </div>
    </main>
  )
}
