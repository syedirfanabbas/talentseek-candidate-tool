'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { GettingStarted } from '../components/GettingStarted'
import { GettingStartedAnswers, GettingStartedRecord, isComplete, isSkipped, recommend } from '../../lib/gettingStarted'

type Application = { id: string; company_name: string; role_title: string; job_url?: string; status: string; notes?: string }
type RecruiterRequest = { id: string; target_role: string; notes?: string; status: string; service_type?: string | null }

const choices = [
  {
    title: 'Tailor My Resume for a Job',
    description: 'Start here. Upload your resume, paste the job link or description, and get a version tailored to that job, ready to send.',
    action: 'Optimize my resume',
    href: '/',
    category: 'Get ready to apply',
  },
  {
    title: 'Build My Master Resume',
    description: 'Optional. Have several old versions of your resume? Combine them into one complete record of your experience to tailor from. It is not the resume you send.',
    action: 'Build my master resume',
    href: '/master-resume',
    category: 'Start with your experience',
  },
  {
    title: 'Get Recruiter Help',
    description: 'Book a written resume review (C$49) or a 30-minute strategy session (C$100) with an experienced recruiter.',
    action: 'Book recruiter support',
    href: '/billing#recruiter-support',
    category: 'Work with an expert',
  },
  {
    title: 'Prepare for an Interview',
    description: 'Create a practical interview plan with likely questions, preparation priorities, and questions to ask.',
    action: 'Prepare for an interview',
    href: '/interview-prep',
    category: 'Get ready to interview',
  },
  {
    title: 'My Resumes',
    description: 'Open and manage your saved master resume and optimized resume versions.',
    action: 'View my resumes',
    href: '/my-resumes',
    category: 'Keep your work organised',
  },
]

export default function DashboardPage() {
  const [applications, setApplications] = useState<Application[]>([])
  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('saved')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [requests, setRequests] = useState<RecruiterRequest[]>([])
  const [guide, setGuide] = useState<GettingStartedRecord | null | undefined>(undefined) // undefined = not loaded yet
  const [guideOpen, setGuideOpen] = useState(false)
  const [guideSaving, setGuideSaving] = useState(false)
  const [guideError, setGuideError] = useState('')
  const [guideEligible, setGuideEligible] = useState(false) // candidates only: staff answers would skew the D16 evidence
  const startingPoint = useRef<HTMLHeadingElement>(null)
  const [justAnswered, setJustAnswered] = useState(false)
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  async function authHeaders(): Promise<Record<string, string>> {
    const { data } = await supabase.auth.getSession()
    return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}
  }

  async function loadApplications() {
    const response = await fetch(`${API_URL}/applications`, { headers: await authHeaders() })
    if (response.ok) setApplications(await response.json())
    setIsLoading(false)
  }

  useEffect(() => { void loadApplications() }, [])
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user
      const record = (user?.user_metadata?.getting_started as GettingStartedRecord | undefined) || null
      const eligible = (user?.app_metadata?.role || 'candidate') === 'candidate'
      setGuideEligible(eligible)
      setGuide(record)
      setGuideOpen(eligible && !isComplete(record) && !isSkipped(record))
    })
  }, [])

  async function saveGuide(record: GettingStartedRecord) {
    setGuideSaving(true); setGuideError('')
    const { error } = await supabase.auth.updateUser({ data: { getting_started: record } })
    if (error) setGuideError('We could not save your answers. Please try again.')
    else { setGuide(record); setGuideOpen(false); setJustAnswered(isComplete(record)) }
    setGuideSaving(false)
  }
  const submitGuide = (answers: GettingStartedAnswers) => saveGuide({ ...guide, ...answers, version: 1, answered_at: new Date().toISOString() })
  const skipGuide = () => saveGuide({ ...guide, version: 1, skipped_at: new Date().toISOString() })
  const requestFirstResume = () => guide && saveGuide({ ...guide, first_resume_early_access_at: new Date().toISOString() })
  const recommendation = guideEligible && isComplete(guide) ? recommend(guide) : null
  // After the last answer, move focus to the result so keyboard and screen-reader users land on it.
  useEffect(() => { if (justAnswered) { startingPoint.current?.focus(); setJustAnswered(false) } }, [justAnswered])
  const orderedChoices = recommendation ? [...choices].sort((a, b) => Number(b.href === recommendation.href) - Number(a.href === recommendation.href)) : choices
  useEffect(() => { void (async () => { const response = await fetch(`${API_URL}/recruiter-requests`, { headers: await authHeaders() }); if (response.ok) setRequests(await response.json()) })() }, [])

  async function addApplication(event: FormEvent) {
    event.preventDefault()
    if (!company.trim() || !role.trim()) return
    setIsSaving(true)
    const response = await fetch(`${API_URL}/applications`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...await authHeaders() },
      body: JSON.stringify({ company_name: company.trim(), role_title: role.trim(), status }),
    })
    if (response.ok) { setApplications([await response.json(), ...applications]); setCompany(''); setRole(''); setStatus('saved') }
    setIsSaving(false)
  }

  async function changeStatus(application: Application, nextStatus: string) {
    const response = await fetch(`${API_URL}/applications/${application.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', ...await authHeaders() }, body: JSON.stringify({ status: nextStatus }),
    })
    if (response.ok) setApplications(applications.map(item => item.id === application.id ? { ...item, status: nextStatus } : item))
  }

  async function removeApplication(id: string) {
    const response = await fetch(`${API_URL}/applications/${id}`, { method: 'DELETE', headers: await authHeaders() })
    if (response.ok) setApplications(applications.filter(item => item.id !== id))
  }

  return (
    <main className='min-h-screen bg-slate-50 px-6 py-12 sm:py-20'>
      <div className='mx-auto max-w-6xl'>
        <div className='max-w-2xl'>
          <p className='text-sm font-semibold uppercase tracking-widest text-teal-700'>Your next step</p>
          <h1 className='mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl'>What would you like to do today?</h1>
          <p className='mt-5 text-lg leading-8 text-slate-600'>Start with your experience, prepare for a specific role, or get support from a recruiter.</p>
        </div>

        {guideOpen && guideEligible && guide !== undefined && <GettingStarted initial={isComplete(guide) ? guide : undefined} saving={guideSaving} onSubmit={submitGuide} onSkip={skipGuide} />}
        {guideError && <p role='alert' className='mt-4 text-sm text-red-700'>{guideError} You can still pick any option below.</p>}

        {recommendation && !guideOpen && (() => {
          const start = choices.find(choice => choice.href === recommendation.href)
          return start && (
            <section aria-labelledby='starting-point-title' className='mt-10 animate-[fadeIn_300ms_ease-out] overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-teal-800 p-6 text-white shadow-lg sm:p-9'>
              <p className='text-xs font-semibold uppercase tracking-widest text-teal-200'>✨ Your starting point</p>
              <h2 id='starting-point-title' ref={startingPoint} tabIndex={-1} className='mt-3 text-2xl font-bold outline-none sm:text-4xl'>{start.title}</h2>
              <p className='mt-3 max-w-2xl text-base leading-7 text-slate-200'>{recommendation.reason}</p>
              <div className='mt-6 flex flex-wrap items-center gap-4'>
                <Link href={start.href} className='inline-flex items-center gap-3 rounded-xl bg-teal-400 px-5 py-3 text-sm font-bold text-slate-900 shadow hover:bg-teal-300'>{start.action}<span aria-hidden='true'>→</span></Link>
                <button type='button' onClick={() => setGuideOpen(true)} className='text-sm font-medium text-teal-100 underline-offset-4 hover:underline'>Change my answers</button>
              </div>
            </section>
          )
        })()}

        {recommendation?.firstResume && !guideOpen && (
          <section className='mt-10 rounded-2xl border border-amber-200 bg-amber-50 p-6'>
            <h2 className='text-lg font-bold text-slate-900'>Help me build my first resume <span className='ml-2 rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-900'>Under consideration</span></h2>
            <p className='mt-2 text-sm leading-6 text-slate-700'>We’re considering a guided builder for people writing their first resume. Would you use it? Register your interest.</p>
            {guide?.first_resume_early_access_at
              ? <p role='status' className='mt-4 text-sm font-semibold text-emerald-800'>✓ Thanks, your interest has been recorded.</p>
              : <button type='button' onClick={requestFirstResume} disabled={guideSaving} className='mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50'>Register my interest</button>}
          </section>
        )}

        <div className='mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4'>
          {orderedChoices.map(choice => {
            const recommended = !guideOpen && recommendation?.href === choice.href
            return (
            <section key={choice.href} className={`flex flex-col rounded-2xl border bg-white p-7 shadow-sm ${recommended ? 'border-teal-600 ring-2 ring-teal-600' : 'border-slate-200'}`}>
              {recommended && <p className='mb-3 self-start rounded-full bg-teal-700 px-3 py-1 text-xs font-semibold text-white'>Recommended for you</p>}
              <p className='text-xs font-semibold uppercase tracking-wider text-teal-700'>{choice.category}</p>
              <h2 className='mt-4 text-2xl font-bold text-slate-900'>{choice.title}</h2>
              <p className='mt-4 flex-1 leading-7 text-slate-600'>{choice.description}</p>
              <Link href={choice.href} className='mt-8 inline-flex items-center justify-between gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700'>
                {choice.action}<span aria-hidden='true'>→</span>
              </Link>
            </section>
            )
          })}
        </div>

        {!guideOpen && guideEligible && guide !== undefined && (
          <p className='mt-8 text-sm leading-6 text-slate-500'>
            {recommendation ? 'Want a different suggestion? ' : 'Not sure where to start? '}
            <button type='button' onClick={() => setGuideOpen(true)} className='font-semibold text-teal-800 underline'>{recommendation ? 'Change my answers' : 'Answer 3 quick questions'}</button>
          </p>
        )}

        <section className='mt-12 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm'>
          <div className='flex flex-wrap items-start justify-between gap-4'>
            <div><p className='text-xs font-semibold uppercase tracking-wider text-teal-700'>Stay organised</p><h2 className='mt-2 text-2xl font-bold text-slate-900'>Application Tracker</h2><p className='mt-2 text-slate-600'>Keep your active applications and next steps in one place.</p></div>
          </div>
          <form onSubmit={addApplication} className='mt-6 grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]'>
            <input value={company} onChange={e => setCompany(e.target.value)} placeholder='Company' aria-label='Company' className='rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900' />
            <input value={role} onChange={e => setRole(e.target.value)} placeholder='Role title' aria-label='Role title' className='rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900' />
            <select value={status} onChange={e => setStatus(e.target.value)} aria-label='Application status' className='rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900'><option value='saved'>Saved</option><option value='applied'>Applied</option><option value='interview'>Interview</option><option value='offer'>Offer</option><option value='closed'>Closed</option></select>
            <button disabled={isSaving} className='rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50'>{isSaving ? 'Adding…' : 'Add application'}</button>
          </form>
          <div className='mt-6 space-y-3'>
            {!isLoading && applications.length === 0 && <p className='rounded-xl bg-slate-50 p-4 text-sm text-slate-500'>No applications yet. Add your first one above.</p>}
            {applications.map(application => <div key={application.id} className='flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-4'><div className='min-w-[180px] flex-1'><p className='font-semibold text-slate-900'>{application.role_title}</p><p className='text-sm text-slate-500'>{application.company_name}</p></div><select value={application.status} onChange={e => void changeStatus(application, e.target.value)} aria-label={`Status for ${application.role_title}`} className='rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-700'><option value='saved'>Saved</option><option value='applied'>Applied</option><option value='interview'>Interview</option><option value='offer'>Offer</option><option value='closed'>Closed</option></select><button onClick={() => void removeApplication(application.id)} className='text-sm text-slate-500 hover:text-red-700'>Remove</button></div>)}
          </div>
        </section>

        <section className='mt-8 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm'>
          <p className='text-xs font-semibold uppercase tracking-wider text-teal-700'>Work with an expert</p>
          <h2 className='mt-2 text-2xl font-bold text-slate-900'>Recruiter support</h2>
          <p className='mt-2 text-slate-600'>Book a written review or a strategy session. You tell us your target role at checkout, and your booking appears here.</p>
          <Link href='/billing#recruiter-support' className='mt-6 inline-flex items-center gap-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700'>Book recruiter support<span aria-hidden='true'>→</span></Link>
          {requests.length > 0 && <div className='mt-6 space-y-3'>{requests.map(request => <div key={request.id} className='rounded-xl border border-slate-200 p-4'><p className='font-semibold text-slate-900'>{request.target_role}</p><p className='text-sm text-slate-500'>{request.service_type === 'recruiter_session' ? 'Strategy session' : request.service_type === 'written_review' ? 'Written review' : 'Recruiter request'} · <span className='capitalize'>{request.status.replaceAll('_', ' ')}</span></p></div>)}</div>}
        </section>
      </div>
    </main>
  )
}
