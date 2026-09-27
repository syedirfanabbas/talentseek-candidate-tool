'use client'

import Link from 'next/link'
import { use, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
type Job = { id: string; title: string; company_name: string; location: string; work_mode: string; employment_type: string; description: string; application_url: string; salary_text?: string; published_at?: string; expires_at?: string; source: string }
type PendingAction = { job: Job; action: 'save' | 'apply' }

export default function JobDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)

  async function track(target: Job, status: 'saved' | 'applied') {
    const { data } = await supabase.auth.getSession()
    if (!data.session) return false
    const response = await fetch(`${API_URL}/applications`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({ company_name: target.company_name, role_title: target.title, job_url: target.application_url, status }) })
    return response.ok
  }

  useEffect(() => {
    void fetch(`/api/jobs/${encodeURIComponent(id)}`).then(async response => {
      if (!response.ok) throw new Error()
      setJob(await response.json())
    }).catch(() => setNotice('This job is no longer available.')).finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!job) return
    const stored = sessionStorage.getItem('talentseek-pending-job-action')
    if (!stored) return
    sessionStorage.removeItem('talentseek-pending-job-action')
    let pending: PendingAction
    try { pending = JSON.parse(stored) as PendingAction } catch { return }
    if (pending.job.id !== job.id) return
    void track(job, pending.action === 'apply' ? 'applied' : 'saved').then(ok => {
      if (!ok) setNotice('We could not add this role to your Application Tracker.')
      else if (pending.action === 'apply') window.location.assign(job.application_url)
      else setNotice('Saved to your Application Tracker.')
    })
  }, [job])

  async function act(action: 'save' | 'apply') {
    if (!job) return
    const { data } = await supabase.auth.getSession()
    if (!data.session) {
      sessionStorage.setItem('talentseek-pending-job-action', JSON.stringify({ job, action } satisfies PendingAction))
      window.location.assign(`/auth?next=${encodeURIComponent(`/jobs/${job.id}`)}`)
      return
    }
    const ok = await track(job, action === 'apply' ? 'applied' : 'saved')
    if (!ok) setNotice('We could not update your Application Tracker. Please try again.')
    else if (action === 'apply') window.location.assign(job.application_url)
    else setNotice('Saved to your Application Tracker.')
  }

  function optimize() {
    if (!job) return
    sessionStorage.setItem('talentseek-job-description', `${job.title} at ${job.company_name}\n${job.description}`)
    window.location.assign('/')
  }

  return <main className='min-h-screen bg-slate-50 px-6 py-10'><div className='mx-auto max-w-4xl'>
    <Link href='/jobs' className='text-sm font-semibold text-slate-600'>← Back to jobs</Link>
    {loading ? <p className='mt-8 text-slate-600'>Loading job…</p> : !job ? <div className='mt-8 rounded-2xl border border-slate-200 bg-white p-8'><h1 className='text-2xl font-bold text-slate-900'>Job unavailable</h1><p className='mt-3 text-slate-600'>{notice}</p></div> : <article className='mt-7 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm'>
      <header className='bg-slate-900 px-8 py-10 text-white'><p className='text-sm font-semibold uppercase tracking-widest text-teal-300'>{job.company_name}</p><h1 className='mt-3 text-4xl font-bold tracking-tight'>{job.title}</h1><p className='mt-4 text-slate-300'>{job.location} · {job.work_mode.replace('_', '-')} · {job.employment_type.replace('_', '-')}</p>{job.salary_text && <p className='mt-2 font-semibold text-white'>{job.salary_text}</p>}</header>
      <div className='p-8'><div className='flex flex-wrap gap-3'><button onClick={() => void act('save')} className='rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700'>Save job</button><button onClick={optimize} className='rounded-xl border border-teal-300 bg-teal-50 px-5 py-3 font-semibold text-teal-800'>Optimize my resume</button><button onClick={() => void act('apply')} className='rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white'>Apply on employer site ↗</button></div>
        {notice && <p role='status' className='mt-5 rounded-xl bg-teal-50 px-4 py-3 text-sm text-teal-900'>{notice}</p>}
        <div className='mt-8 border-t border-slate-200 pt-8'><h2 className='text-2xl font-bold text-slate-900'>About the role</h2><p className='mt-4 whitespace-pre-wrap leading-8 text-slate-700'>{job.description}</p>{job.expires_at && <p className='mt-7 text-sm font-semibold text-slate-500'>Applications close {new Date(job.expires_at).toLocaleDateString()}</p>}</div>
      </div>
    </article>}
  </div></main>
}
