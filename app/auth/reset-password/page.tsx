'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [ready, setReady] = useState(false)
  const [checking, setChecking] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    let active = true

    const checkSession = async () => {
      const { data } = await supabase.auth.getSession()
      if (active) {
        setReady(Boolean(data.session))
        setChecking(false)
      }
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return
      if (event === 'PASSWORD_RECOVERY' || session) {
        setReady(true)
        setChecking(false)
      }
    })

    void checkSession()
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  async function updatePassword() {
    if (password.length < 8) {
      setMessage({ text: 'Use at least 8 characters for your new password.', type: 'error' })
      return
    }
    if (password !== confirmation) {
      setMessage({ text: 'The passwords do not match.', type: 'error' })
      return
    }

    setSaving(true)
    setMessage(null)
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)

    if (error) {
      setMessage({ text: error.message || 'The password could not be updated. Please request a new reset link.', type: 'error' })
      return
    }

    setMessage({ text: 'Your password has been updated. You can now continue to your TalentSeek account.', type: 'success' })
  }

  return (
    <main className='flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12'>
      <div className='w-full max-w-md rounded-2xl bg-white p-8 shadow-sm'>
        <h1 className='text-3xl font-bold text-slate-900'>Choose a new password</h1>
        <p className='mt-2 text-sm leading-6 text-slate-500'>Set a new password for your TalentSeek account.</p>

        {checking ? (
          <p className='mt-6 text-sm text-slate-600'>Checking your reset link…</p>
        ) : !ready ? (
          <div className='mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800'>
            This reset link is invalid or has expired. <a href='/auth' className='font-semibold underline'>Request another reset email</a>.
          </div>
        ) : (
          <div className='mt-6 space-y-4'>
            <label className='block text-sm font-medium text-slate-700'>New password
              <input type='password' value={password} onChange={event => setPassword(event.target.value)} autoComplete='new-password' className='mt-1 w-full rounded-xl border border-slate-200 p-3 text-slate-900 outline-none focus:border-slate-500' />
            </label>
            <label className='block text-sm font-medium text-slate-700'>Confirm new password
              <input type='password' value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete='new-password' className='mt-1 w-full rounded-xl border border-slate-200 p-3 text-slate-900 outline-none focus:border-slate-500' />
            </label>
            {message && <div role='status' className={`rounded-xl border p-3 text-sm ${message.type === 'success' ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>{message.text}</div>}
            {message?.type === 'success' ? (
              <a href='/dashboard' className='block w-full rounded-xl bg-slate-900 py-3 text-center text-sm font-semibold text-white'>Continue to TalentSeek</a>
            ) : (
              <button onClick={() => void updatePassword()} disabled={saving} className='w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white disabled:opacity-50'>{saving ? 'Updating…' : 'Update Password'}</button>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
