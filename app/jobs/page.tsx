'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
type Job = { id: string; title: string; company_name: string; location: string; work_mode?: string; employment_type?: string; description: string; application_url: string; salary_text?: string; published_at?: string; source: string }
type PendingJobAction = { job: Job; action: 'save' | 'apply' }

export default function JobsPage() {
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)

  async function track(job: Job, status: 'saved' | 'applied') {
    const { data } = await supabase.auth.getSession()
    if (!data.session) return false
    const response = await fetch(`${API_URL}/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
      body: JSON.stringify({ company_name: job.company_name, role_title: job.title, job_url: job.application_url, status }),
    })
    return response.ok
  }

  useEffect(() => {
    const stored = sessionStorage.getItem('talentseek-pending-job-action')
    if (!stored) return
    sessionStorage.removeItem('talentseek-pending-job-action')
    let pending: PendingJobAction
    try { pending = JSON.parse(stored) as PendingJobAction } catch { return }
    void track(pending.job, pending.action === 'apply' ? 'applied' : 'saved').then(ok => {
      if (!ok) {
        setNotice('We could not add this role to your Application Tracker. Please try again.')
        return
      }
      if (pending.action === 'apply') window.location.assign(pending.job.application_url)
      else setNotice('Saved to your Application Tracker.')
    })
  }, [])

  async function load(search = '', where = '') {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('query', search)
      if (where) params.set('location', where)
      const response = await fetch(`/api/jobs/search?${params}`)
      const data = await response.json().catch(() => ({ jobs: [] }))
      setJobs(data.jobs || [])
      setNotice(data.source_error || (response.ok ? null : 'Jobs are temporarily unavailable. Please try again shortly.'))
    } catch {
      setJobs([])
      setNotice('Jobs are temporarily unavailable. Please try again shortly.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { void load() }, [])

  function continueAfterSignIn(job: Job, action: 'save' | 'apply') {
    sessionStorage.setItem('talentseek-pending-job-action', JSON.stringify({ job, action } satisfies PendingJobAction))
    window.location.assign('/auth?next=%2Fjobs')
  }

  async function save(job: Job) {
    const { data } = await supabase.auth.getSession()
    if (!data.session) {
      continueAfterSignIn(job, 'save')
      return
    }
    setNotice(await track(job, 'saved') ? 'Saved to your Application Tracker.' : 'This role could not be saved. Please try again.')
  }

  async function apply(job: Job) {
    const { data } = await supabase.auth.getSession()
    if (!data.session) {
      continueAfterSignIn(job, 'apply')
      return
    }
    if (await track(job, 'applied')) window.location.assign(job.application_url)
    else setNotice('We could not add this application to your tracker. Please try again.')
  }

  return <main className='min-h-screen bg-slate-50 px-6 py-10'><div className='mx-auto max-w-6xl'>
    <div className='flex flex-wrap items-center justify-between gap-3'><a href='https://talentseek.ca' className='text-sm text-slate-500 hover:text-slate-700'>← TalentSeek.ca</a><Link href='/employer/jobs/new' className='rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700'>Hiring? Post a job</Link></div>
    <header className='mt-7 rounded-3xl bg-slate-900 px-8 py-11 text-white'><p className='text-sm font-semibold uppercase tracking-widest text-teal-300'>TalentSeek Jobs</p><h1 className='mt-3 text-4xl font-bold tracking-tight sm:text-5xl'>Find work that fits.</h1><p className='mt-4 max-w-2xl text-lg leading-8 text-slate-300'>Search Canadian opportunities from TalentSeek employers and connected job-board sources. Save a role when you are ready to tailor your application.</p></header>
    <form onSubmit={event => { event.preventDefault(); void load(query, location) }} className='-mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-lg sm:grid-cols-[1fr_0.65fr_auto]'><input value={query} onChange={event => setQuery(event.target.value)} placeholder='Job title or keyword' className='min-w-0 rounded-xl border border-slate-300 px-4 py-3 text-slate-900' /><input value={location} onChange={event => setLocation(event.target.value)} placeholder='City or province' className='min-w-0 rounded-xl border border-slate-300 px-4 py-3 text-slate-900' /><button className='rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white'>Search</button></form>
    {notice && <p role='status' className='mt-5 rounded-xl bg-teal-50 px-4 py-3 text-sm text-teal-900'>{notice}</p>}
    <section className='mt-9'><div className='flex items-end justify-between'><div><p className='text-sm font-semibold text-teal-700'>{jobs.length} opportunities</p><h2 className='mt-1 text-2xl font-bold text-slate-900'>Open roles</h2></div><button onClick={() => void load(query, location)} className='text-sm font-semibold text-slate-600 underline'>Refresh</button></div>
      <div className='mt-5 space-y-4'>{loading ? <p className='text-slate-600'>Loading jobs…</p> : jobs.length === 0 ? <div className='rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-slate-600'>No jobs are available yet. Please check back shortly.</div> : jobs.map(job => <article key={job.id} className='rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'><div className='flex flex-wrap items-start justify-between gap-4'><div><p className='text-sm font-semibold text-teal-700'>{job.company_name} · {job.source}</p><h3 className='mt-1 text-xl font-bold text-slate-900'>{job.title}</h3><p className='mt-1 text-sm text-slate-500'>{job.location}{job.work_mode && job.work_mode !== 'unspecified' ? ` · ${job.work_mode.replace('_', '-')}` : ''}</p></div><button onClick={() => void save(job)} className='rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700'>Save job</button></div><p className='mt-4 line-clamp-3 leading-7 text-slate-600'>{job.description || 'Open the listing for full role details.'}</p><div className='mt-5 flex flex-wrap items-center justify-between gap-3'><p className='font-semibold text-slate-900'>{job.salary_text || ''}</p><div className='flex flex-wrap gap-2'>{job.source === 'TalentSeek' && <Link href={`/jobs/${job.id}`} className='rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700'>View details</Link>}<button onClick={() => void apply(job)} className='rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white'>Apply on employer site ↗</button></div></div></article>)}</div>
    </section>
  </div></main>
}
