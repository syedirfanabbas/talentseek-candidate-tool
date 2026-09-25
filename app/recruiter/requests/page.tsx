'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase'

type RecruiterRequest = { id: string; target_role: string; notes?: string; status: string; recruiter_feedback?: string; created_at: string }
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default function RecruiterRequestsPage() {
  const [requests, setRequests] = useState<RecruiterRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  async function headers() {
    const { data } = await supabase.auth.getSession()
    return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}
  }

  async function load() {
    const response = await fetch(`${API_URL}/recruiter-requests/queue`, { headers: await headers() })
    if (response.ok) setRequests(await response.json())
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  async function save(request: RecruiterRequest, change: Partial<RecruiterRequest>) {
    setSaving(request.id)
    const response = await fetch(`${API_URL}/recruiter-requests/${request.id}/queue`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...await headers() }, body: JSON.stringify(change) })
    if (response.ok) {
      const updated = await response.json()
      setRequests(requests.map(item => item.id === request.id ? updated : item))
    }
    setSaving(null)
  }

  return <main className='min-h-screen bg-slate-50 px-6 py-12'><div className='mx-auto max-w-4xl'>
    <div className='flex items-center justify-between gap-4'><div><p className='text-xs font-semibold uppercase tracking-wider text-teal-700'>Recruiter workspace</p><h1 className='mt-2 text-3xl font-bold text-slate-900'>Candidate requests</h1></div><Link href='/recruiter' className='text-sm font-medium text-slate-600 hover:text-slate-900'>Open recruiter tools →</Link></div>
    <div className='mt-8 space-y-4'>{loading && <p className='text-slate-500'>Loading requests…</p>}{!loading && requests.length === 0 && <p className='rounded-xl bg-white p-5 text-slate-500 shadow-sm'>No recruiter requests yet.</p>}{requests.map(request => <article key={request.id} className='rounded-2xl bg-white p-6 shadow-sm'><div className='flex flex-wrap items-start justify-between gap-3'><div><h2 className='text-lg font-semibold text-slate-900'>{request.target_role}</h2><p className='mt-1 text-sm text-slate-500'>Submitted {new Date(request.created_at).toLocaleDateString()}</p></div><select value={request.status} onChange={e => void save(request, { status: e.target.value })} aria-label={`Status for ${request.target_role}`} className='rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-700'><option value='submitted'>Submitted</option><option value='in_review'>In review</option><option value='feedback_ready'>Feedback ready</option><option value='completed'>Completed</option></select></div>{request.notes && <p className='mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700'>{request.notes}</p>}<textarea defaultValue={request.recruiter_feedback || ''} onBlur={e => { if (e.target.value !== (request.recruiter_feedback || '')) void save(request, { recruiter_feedback: e.target.value }) }} placeholder='Add feedback for the candidate…' aria-label={`Feedback for ${request.target_role}`} className='mt-4 min-h-28 w-full rounded-lg border border-slate-300 p-3 text-sm text-slate-900' />{saving === request.id && <p className='mt-2 text-xs text-slate-500'>Saving…</p>}</article>)}</div>
  </div></main>
}
