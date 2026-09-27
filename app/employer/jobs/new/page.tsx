'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { supabase } from '../../../../lib/supabase'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default function PostAJobPage() {
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    setSaving(true)
    setMessage(null)
    setIsError(false)
    const form = new FormData(formElement)

    try {
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        window.location.assign('/auth?next=%2Femployer%2Fjobs%2Fnew')
        return
      }

      const response = await fetch(`${API_URL}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
        body: JSON.stringify({
          company_name: form.get('company_name'), title: form.get('title'), location: form.get('location'),
          work_mode: form.get('work_mode'), employment_type: form.get('employment_type'),
          description: form.get('description'), application_url: form.get('application_url'), salary_text: form.get('salary_text') || undefined,
        }),
      })

      if (response.ok) {
        formElement.reset()
        setMessage('Your posting was submitted for review. We will publish it after a quick quality check.')
        return
      }

      const body = await response.json().catch(() => null)
      setIsError(true)
      setMessage(body?.detail || 'We could not submit the posting. Please check each field and try again.')
    } catch {
      setIsError(true)
      setMessage('We could not reach the posting service. Please try again in a moment.')
    } finally {
      setSaving(false)
    }
  }

  return <main className='min-h-screen bg-slate-50 px-6 py-10'><div className='mx-auto max-w-2xl'>
    <Link href='/employer/jobs' className='text-sm text-slate-500 hover:text-slate-700'>← Employer Home</Link>
    <header className='mt-7'><p className='text-sm font-semibold uppercase tracking-widest text-teal-700'>For employers</p><h1 className='mt-2 text-4xl font-bold tracking-tight text-slate-900'>Post an open role.</h1><p className='mt-3 max-w-xl leading-7 text-slate-600'>Submit a role that links candidates to your official application page. We review each posting before it is published.</p></header>
    <form onSubmit={submit} className='mt-8 space-y-5 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm'>
      <div className='grid gap-5 sm:grid-cols-2'><label className='text-sm font-semibold text-slate-700'>Company name<input required name='company_name' className='mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal text-slate-900' /></label><label className='text-sm font-semibold text-slate-700'>Job title<input required name='title' className='mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal text-slate-900' /></label><label className='text-sm font-semibold text-slate-700'>Location<input required name='location' placeholder='Toronto, ON or Canada' className='mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal text-slate-900' /></label><label className='text-sm font-semibold text-slate-700'>Salary range <span className='font-normal text-slate-400'>(optional)</span><input name='salary_text' placeholder='C$80,000–C$100,000' className='mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal text-slate-900' /></label><label className='text-sm font-semibold text-slate-700'>Work style<select name='work_mode' className='mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal text-slate-900'><option value='hybrid'>Hybrid</option><option value='remote'>Remote</option><option value='on_site'>On-site</option></select></label><label className='text-sm font-semibold text-slate-700'>Employment type<select name='employment_type' className='mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal text-slate-900'><option value='full_time'>Full-time</option><option value='part_time'>Part-time</option><option value='contract'>Contract</option><option value='temporary'>Temporary</option><option value='internship'>Internship</option></select></label></div>
      <label className='block text-sm font-semibold text-slate-700'>Official application URL<input required type='url' name='application_url' placeholder='https://company.com/careers/job' className='mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal text-slate-900' /></label>
      <label className='block text-sm font-semibold text-slate-700'>Job description<textarea required name='description' minLength={80} rows={9} className='mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal leading-6 text-slate-900' placeholder='Describe responsibilities, qualifications, and what makes this role a good opportunity.' /></label>
      {message && <p role='status' className={`rounded-xl px-4 py-3 text-sm ${isError ? 'bg-red-50 text-red-800' : 'bg-teal-50 text-teal-900'}`}>{message}</p>}
      <button type='submit' disabled={saving} className='w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white disabled:cursor-wait disabled:opacity-60'>{saving ? 'Submitting…' : 'Submit for review'}</button>
    </form>
  </div></main>
}
