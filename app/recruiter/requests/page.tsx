'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase'

type RecruiterRequest = {
  id: string
  target_role: string
  notes?: string
  status: string
  recruiter_feedback?: string
  created_at: string
  assigned_recruiter_id?: string | null
  service_type?: 'written_review' | 'recruiter_session' | null
}

// Paid bookings (created automatically after Stripe payment) are labelled so recruiters can prioritise them.
const PAID_SERVICE_LABELS: Record<string, string> = {
  written_review: 'Paid · Written review',
  recruiter_session: 'Paid · 30-minute session',
}

type Message = { kind: 'saved' | 'error'; text: string }
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default function RecruiterRequestsPage() {
  const [requests, setRequests] = useState<RecruiterRequest[]>([])
  const [feedback, setFeedback] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [messages, setMessages] = useState<Record<string, Message>>({})

  async function headers(): Promise<Record<string, string>> {
    const { data } = await supabase.auth.getSession()
    return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}
  }

  async function load() {
    const response = await fetch(`${API_URL}/recruiter-requests/queue`, { headers: await headers() })
    if (response.ok) {
      const loaded: RecruiterRequest[] = await response.json()
      setRequests(loaded)
      setFeedback(Object.fromEntries(loaded.map(request => [request.id, request.recruiter_feedback || ''])))
    }
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  function clearMessage(id: string) {
    setMessages(current => { const next = { ...current }; delete next[id]; return next })
  }

  async function save(request: RecruiterRequest, change: Partial<RecruiterRequest>, successMessage: string) {
    setSaving(request.id)
    clearMessage(request.id)
    try {
      const response = await fetch(`${API_URL}/recruiter-requests/${request.id}/queue`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...await headers() },
        body: JSON.stringify(change),
      })
      if (!response.ok) throw new Error('The update could not be saved. Claim the request first, then try again.')
      const updated = await response.json()
      setRequests(current => current.map(item => item.id === request.id ? updated : item))
      setFeedback(current => ({ ...current, [request.id]: updated.recruiter_feedback || '' }))
      setMessages(current => ({ ...current, [request.id]: { kind: 'saved', text: successMessage } }))
    } catch (error) {
      setMessages(current => ({ ...current, [request.id]: { kind: 'error', text: error instanceof Error ? error.message : 'The update could not be saved.' } }))
    } finally {
      setSaving(null)
    }
  }

  async function claim(request: RecruiterRequest) {
    setSaving(request.id)
    clearMessage(request.id)
    try {
      const response = await fetch(`${API_URL}/recruiter-requests/${request.id}/claim`, { method: 'POST', headers: await headers() })
      if (!response.ok) throw new Error('The request could not be claimed. Please try again.')
      const updated = await response.json()
      setRequests(current => current.map(item => item.id === request.id ? updated : item))
      setMessages(current => ({ ...current, [request.id]: { kind: 'saved', text: 'Request claimed. You can now update its status and feedback.' } }))
    } catch (error) {
      setMessages(current => ({ ...current, [request.id]: { kind: 'error', text: error instanceof Error ? error.message : 'The request could not be claimed.' } }))
    } finally {
      setSaving(null)
    }
  }

  return <main className='min-h-screen bg-slate-50 px-6 py-12'><div className='mx-auto max-w-4xl'>
    <div className='flex items-center justify-between gap-4'><div><p className='text-xs font-semibold uppercase tracking-wider text-teal-700'>Recruiter workspace</p><h1 className='mt-2 text-3xl font-bold text-slate-900'>Candidate requests</h1></div><Link href='/recruiter' className='text-sm font-medium text-slate-600 hover:text-slate-900'>Open recruiter tools →</Link></div>
    <div className='mt-8 space-y-4'>
      {loading && <p className='text-slate-500'>Loading requests…</p>}
      {!loading && requests.length === 0 && <p className='rounded-xl bg-white p-5 text-slate-500 shadow-sm'>No recruiter requests yet.</p>}
      {requests.map(request => {
        const busy = saving === request.id
        const message = messages[request.id]
        return <article key={request.id} className='rounded-2xl bg-white p-6 shadow-sm'>
          <div className='flex flex-wrap items-start justify-between gap-3'><div><h2 className='text-lg font-semibold text-slate-900'>{request.target_role}</h2>{request.service_type && <span className='mt-1 inline-block rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-800'>{PAID_SERVICE_LABELS[request.service_type]}</span>}<p className='mt-1 text-sm text-slate-500'>Submitted {new Date(request.created_at).toLocaleDateString()}</p></div><div className='flex gap-2'>{!request.assigned_recruiter_id && <button onClick={() => void claim(request)} disabled={busy} className='rounded-lg bg-slate-900 px-3 py-1 text-sm text-white disabled:opacity-50'>{busy ? 'Saving…' : 'Claim request'}</button>}<select value={request.status} onChange={event => void save(request, { status: event.target.value }, 'Status saved.')} disabled={busy} aria-label={`Status for ${request.target_role}`} className='rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-700 disabled:opacity-50'><option value='submitted'>Submitted</option><option value='in_review'>In review</option><option value='feedback_ready'>Feedback ready</option><option value='completed'>Completed</option></select></div></div>
          {request.notes && <p className='mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700'>{request.notes}</p>}
          <label className='mt-4 block text-sm font-medium text-slate-700' htmlFor={`feedback-${request.id}`}>Feedback for candidate</label>
          <textarea id={`feedback-${request.id}`} value={feedback[request.id] || ''} onChange={event => setFeedback(current => ({ ...current, [request.id]: event.target.value }))} placeholder='Add feedback for the candidate…' aria-label={`Feedback for ${request.target_role}`} className='mt-2 min-h-28 w-full rounded-lg border border-slate-300 p-3 text-sm text-slate-900' />
          <div className='mt-3 flex flex-wrap items-center gap-3'><button onClick={() => void save(request, { recruiter_feedback: feedback[request.id] || '' }, 'Feedback saved.')} disabled={busy} className='rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50'>{busy ? 'Saving…' : 'Save feedback'}</button>{message && <p role='status' className={`text-sm ${message.kind === 'error' ? 'text-red-700' : 'text-emerald-700'}`}>{message.text}</p>}</div>
        </article>
      })}
    </div>
  </div></main>
}
