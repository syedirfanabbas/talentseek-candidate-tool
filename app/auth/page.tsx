'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const router = useRouter()

  const handleSubmit = async () => {
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
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } }
        })
        if (error) throw error
        setMessage({ text: 'Account created! Please check your email to confirm your account, then log in.', type: 'success' })
        setMode('login')
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        setMessage({ text: 'Login successful! Redirecting...', type: 'success' })
        setTimeout(() => { window.location.href = '/' }, 1000)
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
              <div>
                <label className='mb-1 block text-sm font-medium text-slate-700'>Full Name</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  placeholder='John Smith'
                  className='w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-500' />
              </div>
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
            {isLoading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Free Account'}
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
