'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const COUNTRIES = [
  { code: 'ca', label: 'Canada', location: 'City or province, e.g. Vancouver' },
  { code: 'ae', label: 'UAE', location: 'City, e.g. Dubai' },
  { code: 'sa', label: 'Saudi Arabia', location: 'City, e.g. Riyadh' },
  { code: 'qa', label: 'Qatar', location: 'City, e.g. Doha' },
  { code: 'kw', label: 'Kuwait', location: 'City, e.g. Kuwait City' },
  { code: 'bh', label: 'Bahrain', location: 'City, e.g. Manama' },
  { code: 'om', label: 'Oman', location: 'City, e.g. Muscat' },
] as const
type CountryCode = typeof COUNTRIES[number]['code']
type Job = { id: string; title: string; company_name: string; location: string; work_mode?: string; employment_type?: string; description: string; application_url: string; salary_text?: string; published_at?: string; source: string }
type PendingJobAction = { job: Job; action: 'save' | 'apply' }

function countryFromUrl(): CountryCode {
  if (typeof window === 'undefined') return 'ca'
  const code = new URLSearchParams(window.location.search).get('country')?.toLowerCase()
  return COUNTRIES.some(country => country.code === code) ? code as CountryCode : 'ca'
}

export default function JobsPage() {
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')
  const [country, setCountry] = useState<CountryCode>('ca')
  const [jobs, setJobs] = useState<Job[]>([])
  const [sources, setSources] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [hasSearched, setHasSearched] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const selectedCountry = COUNTRIES.find(item => item.code === country) || COUNTRIES[0]

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
    const initialCountry = countryFromUrl()
    setCountry(initialCountry)
    // Canada retains its existing opening search. Gulf API requests happen only after Submit.
    if (initialCountry === 'ca') void load('', '', 'ca')
    else setLoading(false)
  }, [])

  useEffect(() => {
    const stored = sessionStorage.getItem('talentseek-pending-job-action')
    if (!stored) return
    sessionStorage.removeItem('talentseek-pending-job-action')
    let pending: PendingJobAction
    try { pending = JSON.parse(stored) as PendingJobAction } catch { return }
    void track(pending.job, pending.action === 'apply' ? 'applied' : 'saved').then(ok => {
      if (!ok) { setNotice('We could not add this role to your Application Tracker. Please try again.'); return }
      if (pending.action === 'apply') window.location.assign(pending.job.application_url)
      else setNotice('Saved to your Application Tracker.')
    })
  }, [])

  async function load(search = '', where = '', selected = country) {
    setLoading(true)
    try {
      const params = new URLSearchParams({ country: selected })
      if (search) params.set('query', search)
      if (where) params.set('location', where)
      const response = await fetch(`/api/jobs/search?${params}`)
      const data = await response.json().catch(() => ({ jobs: [] }))
      setJobs(data.jobs || [])
      setSources(data.sources || [])
      setNotice(data.source_error || (response.ok ? null : 'Jobs are temporarily unavailable. Please try again shortly.'))
    } catch {
      setJobs([]); setSources([]); setNotice('Jobs are temporarily unavailable. Please try again shortly.')
    } finally {
      setLoading(false); setHasSearched(true)
    }
  }

  function selectCountry(next: CountryCode) {
    setCountry(next); setJobs([]); setSources([]); setNotice(null); setHasSearched(false)
    const url = new URL(window.location.href)
    if (next === 'ca') url.searchParams.delete('country')
    else url.searchParams.set('country', next)
    window.history.replaceState({}, '', `${url.pathname}${url.search}`)
  }

  function continueAfterSignIn(job: Job, action: 'save' | 'apply') {
    sessionStorage.setItem('talentseek-pending-job-action', JSON.stringify({ job, action } satisfies PendingJobAction))
    window.location.assign('/auth?next=%2Fjobs')
  }
  async function save(job: Job) {
    const { data } = await supabase.auth.getSession()
    if (!data.session) { continueAfterSignIn(job, 'save'); return }
    setNotice(await track(job, 'saved') ? 'Saved to your Application Tracker.' : 'This role could not be saved. Please try again.')
  }
  async function apply(job: Job) {
    const { data } = await supabase.auth.getSession()
    if (!data.session) { continueAfterSignIn(job, 'apply'); return }
    if (await track(job, 'applied')) window.location.assign(job.application_url)
    else setNotice('We could not add this application to your tracker. Please try again.')
  }
  function tailor(job: Job) {
    sessionStorage.setItem('talentseek-job-description', `${job.title} at ${job.company_name}\n${job.description}`)
    window.location.assign('/')
  }

  return <main className='min-h-screen bg-slate-50 px-6 py-10'><div className='mx-auto max-w-6xl'>
    <div className='flex flex-wrap items-center justify-between gap-3'><a href='https://talentseek.ca' className='text-sm text-slate-500 hover:text-slate-700'>← TalentSeek.ca</a><Link href='/employer/jobs/new' className='rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700'>Hiring? Post a job</Link></div>
    <header className='mt-7 rounded-3xl bg-slate-900 px-8 py-11 text-white'><p className='text-sm font-semibold uppercase tracking-widest text-teal-300'>TalentSeek Jobs</p><h1 className='mt-3 text-4xl font-bold tracking-tight sm:text-5xl'>Find work that fits.</h1><p className='mt-4 max-w-2xl text-lg leading-8 text-slate-300'>Search opportunities from TalentSeek employers and connected job-board sources. Save a role when you are ready to tailor your application.</p></header>
    <form onSubmit={event => { event.preventDefault(); void load(query, location, country) }} className='-mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-lg sm:grid-cols-[0.55fr_1fr_0.8fr_auto]'>
      <select aria-label='Country' value={country} onChange={event => selectCountry(event.target.value as CountryCode)} className='rounded-xl border border-slate-300 px-4 py-3 text-slate-900'>{COUNTRIES.map(item => <option key={item.code} value={item.code}>{item.label}</option>)}</select>
      <input value={query} onChange={event => setQuery(event.target.value)} placeholder='Job title or keyword' className='min-w-0 rounded-xl border border-slate-300 px-4 py-3 text-slate-900' />
      <input value={location} onChange={event => setLocation(event.target.value)} placeholder={selectedCountry.location} className='min-w-0 rounded-xl border border-slate-300 px-4 py-3 text-slate-900' />
      <button className='rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white'>Search</button>
    </form>
    {notice && <p role='status' className='mt-5 rounded-xl bg-teal-50 px-4 py-3 text-sm text-teal-900'>{notice}</p>}
    <section className='mt-9'><div className='flex items-end justify-between'><div><p className='text-sm font-semibold text-teal-700'>{jobs.length} opportunities</p><h2 className='mt-1 text-2xl font-bold text-slate-900'>Open roles in {selectedCountry.label}</h2></div><button onClick={() => void load(query, location, country)} className='text-sm font-semibold text-slate-600 underline'>Refresh</button></div>
      {sources.includes('Jooble') && <p className='mt-3 text-sm text-slate-500'>Jobs in the Gulf provided by Jooble.</p>}
      <div className='mt-5 space-y-4'>{loading ? <p className='text-slate-600'>Loading jobs…</p> : jobs.length === 0 ? <div className='rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-slate-600'>{hasSearched ? `No jobs found in ${selectedCountry.label} for this search. Try a broader keyword.` : `Choose a keyword or location to search jobs in ${selectedCountry.label}.`}<button type='button' onClick={() => void load(query.trim(), location.trim(), country)} className='ml-3 font-semibold text-teal-800 underline'>Try again</button></div> : jobs.map(job => <article key={job.id} className='rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'><div className='flex flex-wrap items-start justify-between gap-4'><div><p className='text-sm font-semibold text-teal-700'>{job.company_name} · {job.source === 'Jooble' ? 'via Jooble' : job.source}</p><h3 className='mt-1 text-xl font-bold text-slate-900'>{job.title}</h3><p className='mt-1 text-sm text-slate-500'>{job.location}{job.work_mode && job.work_mode !== 'unspecified' ? ` · ${job.work_mode.replace('_', '-')}` : ''}</p></div><button onClick={() => void save(job)} className='rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700'>Save job</button></div><p className='mt-4 line-clamp-3 leading-7 text-slate-600'>{job.description || 'Open the listing for full role details.'}</p><div className='mt-5 flex flex-wrap items-center justify-between gap-3'><p className='font-semibold text-slate-900'>{job.salary_text || ''}</p><div className='flex flex-wrap gap-2'>{job.source === 'TalentSeek' && <Link href={`/jobs/${job.id}`} className='rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700'>View details</Link>}<button onClick={() => tailor(job)} className='rounded-xl border border-teal-300 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-800'>Tailor for this job</button>{job.source === 'Jooble' ? <a href={job.application_url} target='_blank' rel='noopener noreferrer nofollow' className='rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white'>Open on Jooble ↗</a> : <button onClick={() => void apply(job)} className='rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white'>Apply on employer site ↗</button>}</div></div></article>)}</div>
    </section>
  </div></main>
}
