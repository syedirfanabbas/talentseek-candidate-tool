'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Application = { id: string; company_name: string; role_title: string; job_url?: string; status: string; notes?: string }
type RecruiterRequest = { id: string; target_role: string; notes?: string; status: string }

const choices = [
  {
    title: 'Build My Master Resume',
    description: 'Bring your experience, skills, and achievements together in one comprehensive resume.',
    action: 'Build my master resume',
    href: '/master-resume',
    category: 'Start with your experience',
  },
  {
    title: 'Tailor My Resume for a Job',
    description: 'Have a role in mind? Match your resume to the job description and highlight the experience that matters.',
    action: 'Optimize my resume',
    href: '/',
    category: 'Get ready to apply',
  },
  {
    title: 'Get Recruiter Help',
    description: 'Work with a TalentSeek recruiter to review and strengthen your resume for your next opportunity.',
    action: 'Contact a recruiter',
    href: 'https://talentseek.ca/contact/',
    category: 'Work with an expert',
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
  const [targetRole, setTargetRole] = useState('')
  const [requestNotes, setRequestNotes] = useState('')
  const [isRequesting, setIsRequesting] = useState(false)
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
  useEffect(() => { void (async () => { const response = await fetch(`${API_URL}/recruiter-requests`, { headers: await authHeaders() }); if (response.ok) setRequests(await response.json()) })() }, [])

  async function submitRecruiterRequest(event: FormEvent) {
    event.preventDefault()
    if (!targetRole.trim()) return
    setIsRequesting(true)
    const response = await fetch(`${API_URL}/recruiter-requests`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...await authHeaders() }, body: JSON.stringify({ target_role: targetRole.trim(), notes: requestNotes.trim() || undefined }) })
    if (response.ok) { setRequests([await response.json(), ...requests]); setTargetRole(''); setRequestNotes('') }
    setIsRequesting(false)
  }

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

        <div className='mt-10 grid gap-6 md:grid-cols-3'>
          {choices.map(choice => (
            <section key={choice.href} className='flex flex-col rounded-2xl border border-slate-200 bg-white p-7 shadow-sm'>
              <p className='text-xs font-semibold uppercase tracking-wider text-teal-700'>{choice.category}</p>
              <h2 className='mt-4 text-2xl font-bold text-slate-900'>{choice.title}</h2>
              <p className='mt-4 flex-1 leading-7 text-slate-600'>{choice.description}</p>
              <Link href={choice.href} className='mt-8 inline-flex items-center justify-between gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700'>
                {choice.action}<span aria-hidden='true'>→</span>
              </Link>
              {choice.href.startsWith('https:') && <p className='mt-3 text-xs text-slate-500'>Opens the contact page on TalentSeek.ca.</p>}
            </section>
          ))}
        </div>

        <p className='mt-8 text-sm leading-6 text-slate-500'>Not sure where to start? Build your master resume first, then tailor it for each job you apply to.</p>

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
          <h2 className='mt-2 text-2xl font-bold text-slate-900'>Request recruiter help</h2>
          <p className='mt-2 text-slate-600'>Tell us which role you are targeting and a recruiter will review your resume.</p>
          <form onSubmit={submitRecruiterRequest} className='mt-6 grid gap-3'>
            <input value={targetRole} onChange={e => setTargetRole(e.target.value)} placeholder='Target role' aria-label='Target role' className='rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900' />
            <textarea value={requestNotes} onChange={e => setRequestNotes(e.target.value)} placeholder='What would you like help with? (optional)' aria-label='Recruiter request notes' className='min-h-24 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900' />
            <button disabled={isRequesting} className='w-fit rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50'>{isRequesting ? 'Submitting…' : 'Request recruiter review'}</button>
          </form>
          <div className='mt-6 space-y-3'>{requests.map(request => <div key={request.id} className='rounded-xl border border-slate-200 p-4'><p className='font-semibold text-slate-900'>{request.target_role}</p><p className='text-sm capitalize text-slate-500'>{request.status.replace('_', ' ')}</p></div>)}</div>
        </section>
      </div>
    </main>
  )
}
