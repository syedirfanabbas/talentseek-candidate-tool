'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
type Posting = { id: string; company_name: string; title: string; location: string; work_mode: string; employment_type: string; description: string; application_url: string; salary_text?: string; status: 'draft' | 'pending' | 'published' | 'closed' | 'rejected'; created_at: string }

export default function AdminJobPostingsPage() {
  const [postings, setPostings] = useState<Posting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Record<string, string>>({})

  const headers = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${data.session?.access_token || ''}` }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const response = await fetch(`${API_URL}/jobs/admin`, { headers: await headers() })
    if (response.ok) setPostings(await response.json())
    else setError('Could not load employer postings.')
    setLoading(false)
  }, [headers])

  useEffect(() => { void load() }, [load])

  async function changeStatus(posting: Posting, status: Posting['status']) {
    const response = await fetch(`${API_URL}/jobs/admin/${posting.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...await headers() }, body: JSON.stringify({ status, review_feedback: status === 'rejected' ? feedback[posting.id]?.trim() || 'Please review the posting details and resubmit.' : undefined }) })
    if (response.ok) setPostings(items => items.map(item => item.id === posting.id ? { ...item, status } : item))
    else setError('The posting status could not be updated.')
  }

  async function deletePosting(posting: Posting) {
    if (!window.confirm(`Permanently delete “${posting.title}” from ${posting.company_name}? This cannot be undone.`)) return
    setError(null)
    const response = await fetch(`${API_URL}/jobs/admin/${posting.id}`, { method: 'DELETE', headers: await headers() })
    if (response.ok) setPostings(items => items.filter(item => item.id !== posting.id))
    else setError('The posting could not be deleted.')
  }

  return <main className='min-h-screen bg-slate-50 px-6 py-10'><div className='mx-auto max-w-5xl'>
    <div className='flex flex-wrap items-center justify-between gap-4'><div><Link href='/admin/dashboard' className='text-sm text-slate-500 hover:text-slate-700'>← Admin Home</Link><h1 className='mt-3 text-4xl font-bold tracking-tight text-slate-900'>Employer job postings</h1><p className='mt-2 text-slate-600'>Review a posting before it appears in TalentSeek Jobs.</p></div><button onClick={() => void load()} className='rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700'>Refresh</button></div>
    {error && <p role='alert' className='mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700'>{error}</p>}
    <div className='mt-8 space-y-4'>{loading ? <p className='text-slate-600'>Loading postings…</p> : postings.length === 0 ? <div className='rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-slate-600'>No employer postings have been submitted yet.</div> : postings.map(posting => <article key={posting.id} className='rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'><div className='flex flex-wrap items-start justify-between gap-4'><div><p className='text-sm font-semibold text-teal-700'>{posting.company_name}</p><h2 className='mt-1 text-xl font-bold text-slate-900'>{posting.title}</h2><p className='mt-1 text-sm text-slate-500'>{posting.location} · {posting.work_mode.replace('_', '-')} · {posting.employment_type.replace('_', '-')}</p><p className='mt-2 text-xs text-slate-400'>Submitted {new Date(posting.created_at).toLocaleString()} · Job ID <code className='select-all rounded bg-slate-100 px-1.5 py-0.5 text-slate-600'>{posting.id}</code></p></div><span className='rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold capitalize text-slate-700'>{posting.status}</span></div><p className='mt-4 whitespace-pre-wrap leading-7 text-slate-600'>{posting.description}</p>{posting.status !== 'published' && posting.status !== 'closed' && <label className='mt-4 block text-sm font-semibold text-slate-700'>Feedback for employer<textarea value={feedback[posting.id] || ''} onChange={event => setFeedback(items => ({ ...items, [posting.id]: event.target.value }))} rows={2} maxLength={2000} placeholder='Explain what should be changed before resubmission.' className='mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal text-slate-900' /></label>}<div className='mt-5 flex flex-wrap items-center justify-between gap-4'><a href={posting.application_url} target='_blank' rel='noreferrer' className='text-sm font-semibold text-teal-700 underline'>Open official application page ↗</a><div className='flex flex-wrap gap-2'>{(['draft', 'pending', 'rejected'] as Posting['status'][]).includes(posting.status) && <button onClick={() => void changeStatus(posting, 'published')} className='rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white'>Approve & publish</button>}{(['draft', 'pending'] as Posting['status'][]).includes(posting.status) && <button onClick={() => void changeStatus(posting, 'rejected')} className='rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700'>Reject with feedback</button>}{posting.status === 'published' && <button onClick={() => void changeStatus(posting, 'closed')} className='rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-800'>Close job</button>}<button onClick={() => void deletePosting(posting)} className='rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700'>Delete permanently</button></div></div></article>)}</div>
  </div></main>
}
