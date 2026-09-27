'use client'

import Link from 'next/link'
import { FormEvent, useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
type Status = 'draft' | 'pending' | 'published' | 'closed' | 'rejected'
type Posting = {
  id: string
  company_name: string
  title: string
  location: string
  work_mode: string
  employment_type: string
  description: string
  application_url: string
  salary_text?: string
  status: Status
  review_feedback?: string
  updated_at: string
}

const statusStyle: Record<Status, string> = {
  draft: 'bg-slate-100 text-slate-700',
  pending: 'bg-amber-100 text-amber-800',
  published: 'bg-emerald-100 text-emerald-800',
  closed: 'bg-slate-200 text-slate-700',
  rejected: 'bg-red-100 text-red-800',
}

export default function EmployerJobsPage() {
  const [postings, setPostings] = useState<Posting[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Posting | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const authHeaders = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    if (!data.session) {
      window.location.assign('/auth?next=%2Femployer%2Fjobs')
      return null
    }
    return { Authorization: `Bearer ${data.session.access_token}` }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const headers = await authHeaders()
    if (!headers) return
    try {
      const response = await fetch(`${API_URL}/jobs/mine`, { headers })
      if (!response.ok) throw new Error()
      setPostings(await response.json())
    } catch {
      setError('We could not load your job postings. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [authHeaders])

  useEffect(() => { void load() }, [load])

  async function closePosting(posting: Posting) {
    setBusyId(posting.id)
    setError(null)
    const headers = await authHeaders()
    if (!headers) return
    const response = await fetch(`${API_URL}/jobs/${posting.id}/close`, { method: 'POST', headers })
    if (response.ok) {
      setPostings(items => items.map(item => item.id === posting.id ? { ...item, status: 'closed' } : item))
      setMessage(`${posting.title} is now closed.`)
    } else setError('The posting could not be closed. Please try again.')
    setBusyId(null)
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing) return
    setBusyId(editing.id)
    setError(null)
    setMessage(null)
    const form = new FormData(event.currentTarget)
    const headers = await authHeaders()
    if (!headers) return
    const response = await fetch(`${API_URL}/jobs/${editing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({
        company_name: form.get('company_name'),
        title: form.get('title'),
        location: form.get('location'),
        salary_text: form.get('salary_text') || null,
        work_mode: form.get('work_mode'),
        employment_type: form.get('employment_type'),
        application_url: form.get('application_url'),
        description: form.get('description'),
        submit_for_review: true,
      }),
    })
    const body = await response.json().catch(() => null)
    if (response.ok) {
      setPostings(items => items.map(item => item.id === editing.id ? body : item))
      setEditing(null)
      setMessage('Your changes were saved and submitted for review.')
    } else setError(body?.detail || 'The posting could not be updated.')
    setBusyId(null)
  }

  return <main className='min-h-screen bg-slate-50 px-6 py-10'><div className='mx-auto max-w-5xl'>
    <header className='flex flex-wrap items-end justify-between gap-5'><div><p className='text-sm font-semibold uppercase tracking-widest text-teal-700'>Employer workspace</p><h1 className='mt-2 text-4xl font-bold tracking-tight text-slate-900'>Your job postings</h1><p className='mt-3 max-w-2xl leading-7 text-slate-600'>Follow each role from submission through publication, respond to review feedback, and close filled positions.</p></div><Link href='/employer/jobs/new' className='rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white'>Post a new job</Link></header>
    {message && <p role='status' className='mt-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800'>{message}</p>}
    {error && <p role='alert' className='mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700'>{error}</p>}
    <section className='mt-8 space-y-4'>
      {loading ? <p className='text-slate-600'>Loading your postings…</p> : postings.length === 0 ? <div className='rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center'><h2 className='text-xl font-bold text-slate-900'>No job postings yet</h2><p className='mt-2 text-slate-600'>Create your first posting and submit it for TalentSeek review.</p><Link href='/employer/jobs/new' className='mt-5 inline-block rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white'>Post your first job</Link></div> : postings.map(posting => <article key={posting.id} className='rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'><div className='flex flex-wrap items-start justify-between gap-4'><div><p className='text-sm font-semibold text-teal-700'>{posting.company_name}</p><h2 className='mt-1 text-xl font-bold text-slate-900'>{posting.title}</h2><p className='mt-1 text-sm text-slate-500'>{posting.location} · {posting.work_mode.replace('_', '-')} · {posting.employment_type.replace('_', '-')}</p></div><span className={`rounded-full px-3 py-1 text-sm font-semibold capitalize ${statusStyle[posting.status]}`}>{posting.status}</span></div>
        {posting.review_feedback && <div className='mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3'><p className='text-sm font-semibold text-red-800'>Reviewer feedback</p><p className='mt-1 whitespace-pre-wrap text-sm leading-6 text-red-700'>{posting.review_feedback}</p></div>}
        <p className='mt-4 line-clamp-3 whitespace-pre-wrap leading-7 text-slate-600'>{posting.description}</p><p className='mt-3 text-xs text-slate-400'>Updated {new Date(posting.updated_at).toLocaleDateString()}</p>
        <div className='mt-5 flex flex-wrap gap-3'>{(['draft', 'pending', 'rejected'] as Status[]).includes(posting.status) && <button onClick={() => { setEditing(posting); setMessage(null) }} className='rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white'>Edit & resubmit</button>}{posting.status === 'published' && <><a href={posting.application_url} target='_blank' rel='noreferrer' className='rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700'>View application page ↗</a><button disabled={busyId === posting.id} onClick={() => void closePosting(posting)} className='rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50'>{busyId === posting.id ? 'Closing…' : 'Close posting'}</button></>}</div>
      </article>)}
    </section>
    {editing && <div className='fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 px-4 py-8'><form onSubmit={saveEdit} className='mx-auto max-w-2xl space-y-5 rounded-2xl bg-white p-7 shadow-xl'><div className='flex items-start justify-between gap-4'><div><p className='text-sm font-semibold uppercase tracking-wider text-teal-700'>Edit posting</p><h2 className='mt-1 text-2xl font-bold text-slate-900'>{editing.title}</h2></div><button type='button' onClick={() => setEditing(null)} className='rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600'>Cancel</button></div>
      <div className='grid gap-5 sm:grid-cols-2'><label className='text-sm font-semibold text-slate-700'>Company name<input required name='company_name' defaultValue={editing.company_name} className='mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal text-slate-900' /></label><label className='text-sm font-semibold text-slate-700'>Job title<input required name='title' defaultValue={editing.title} className='mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal text-slate-900' /></label><label className='text-sm font-semibold text-slate-700'>Location<input required name='location' defaultValue={editing.location} className='mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal text-slate-900' /></label><label className='text-sm font-semibold text-slate-700'>Salary range<input name='salary_text' defaultValue={editing.salary_text || ''} className='mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal text-slate-900' /></label><label className='text-sm font-semibold text-slate-700'>Work style<select name='work_mode' defaultValue={editing.work_mode} className='mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal text-slate-900'><option value='hybrid'>Hybrid</option><option value='remote'>Remote</option><option value='on_site'>On-site</option></select></label><label className='text-sm font-semibold text-slate-700'>Employment type<select name='employment_type' defaultValue={editing.employment_type} className='mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal text-slate-900'><option value='full_time'>Full-time</option><option value='part_time'>Part-time</option><option value='contract'>Contract</option><option value='temporary'>Temporary</option><option value='internship'>Internship</option></select></label></div>
      <label className='block text-sm font-semibold text-slate-700'>Official application URL<input required type='url' name='application_url' defaultValue={editing.application_url} className='mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal text-slate-900' /></label><label className='block text-sm font-semibold text-slate-700'>Job description<textarea required minLength={80} rows={9} name='description' defaultValue={editing.description} className='mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal leading-6 text-slate-900' /></label><button disabled={busyId === editing.id} className='w-full rounded-xl bg-teal-700 px-4 py-3 font-semibold text-white disabled:opacity-50'>{busyId === editing.id ? 'Saving…' : 'Save & submit for review'}</button>
    </form></div>}
  </div></main>
}
