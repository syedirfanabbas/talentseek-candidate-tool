'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { PRIVACY_URL, TERMS_URL } from '../../lib/legal'
import { SESSION_BOOKING_PAGES } from '../../lib/booking'

type BillingSummary = {
  entitlement: { plan_key: string; subscription_status: string; subscription_period_end?: string | null }
  available: { resume_optimizations: number | null; interview_prep_packs: number | null }
  unlimited: boolean
  orders: Array<{ id: string; product_key: string; status: string; currency: string; amount_minor: number; created_at: string }>
  checkout_enabled: boolean
}

type RecruiterRequest = {
  id: string; target_role: string; service_type?: 'written_review' | 'recruiter_session' | null
  intake_submitted_at?: string | null; intake?: Record<string, unknown> | null; status?: string
  booking?: { starts_at: string; ends_at?: string | null; team: string; meet_url?: string | null } | null
}

const goalOptions = [
  ['market', 'Resume for a new market'], ['job_title', 'Resume for a job title'],
  ['specific_job', 'Resume for a specific job'], ['interview_prep', 'Interview preparation'], ['other', 'Something else'],
] as const

function RecruiterIntakeCard({ request, apiUrl, onSubmitted }: { request: RecruiterRequest; apiUrl: string; onSubmitted: (request: RecruiterRequest) => void }) {
  const [resume, setResume] = useState('')
  const [resumeLabel, setResumeLabel] = useState('')
  const [saved, setSaved] = useState<{ key: string; label: string; content: string }[]>([])
  const [goal, setGoal] = useState('specific_job')
  const [form, setForm] = useState({ goal_details: '', target_country: '', target_industry: '', current_role: '', biggest_concern: '', achievements: '', linkedin_url: '' })
  const [jobAds, setJobAds] = useState([''])
  const [jobLinks, setJobLinks] = useState([''])
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const authHeaders = async (): Promise<Record<string, string>> => { const { data } = await supabase.auth.getSession(); return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {} }

  useEffect(() => { void (async () => {
    const headers = await authHeaders()
    const [masterResponse, optimizedResponse] = await Promise.all([fetch(`${apiUrl}/resume-library/master`, { headers }), fetch(`${apiUrl}/resume-library/optimized`, { headers })])
    const master = masterResponse.ok ? await masterResponse.json() : null
    const optimized = optimizedResponse.ok ? await optimizedResponse.json() : []
    setSaved([...(master?.content ? [{ key: 'master', label: 'Master resume', content: master.content }] : []), ...optimized.map((item: { id: string; title: string; content: string }) => ({ key: item.id, label: item.title, content: item.content }))])
  })() }, [apiUrl])

  const updateAd = (index: number, value: string) => setJobAds(items => items.map((item, i) => i === index ? value : item))
  const fetchJob = async (index: number) => {
    if (!jobLinks[index]?.trim()) return
    setMessage('')
    const response = await fetch(`${apiUrl}/resumes/fetch-job`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...await authHeaders() }, body: JSON.stringify({ url: jobLinks[index] }) })
    const data = await response.json()
    if (!response.ok || !data.text) { setMessage(data.error || 'Unable to read that job link.'); return }
    updateAd(index, String(data.text).slice(0, 20000))
  }
  const parseResume = async (file: File) => {
    const data = new FormData(); data.append('file', file)
    const response = await fetch(`${apiUrl}/resumes/parse-demo`, { method: 'POST', headers: await authHeaders(), body: data })
    const result = await response.json()
    if (!response.ok || !result.text) { setMessage(result.error || 'Unable to read that file.'); return }
    setResume(result.text); setResumeLabel(file.name)
  }
  const submit = async () => {
    setSaving(true); setMessage('')
    try {
      const response = await fetch(`${apiUrl}/recruiter-requests/${request.id}/intake`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...await authHeaders() }, body: JSON.stringify({ goal, ...form, job_ads: jobAds.filter(Boolean), resume_text: resume, resume_label: resumeLabel }) })
      const data = await response.json()
      if (!response.ok) {
        // FastAPI validation errors arrive as a list: [{loc: [..., field], msg}]
        const detail = Array.isArray(data.detail)
          ? data.detail.map((item: { loc?: unknown[]; msg?: string }) => {
              const field = String(item.loc?.[item.loc.length - 1] ?? '').replace(/_/g, ' ')
              return `${field ? field.charAt(0).toUpperCase() + field.slice(1) + ': ' : ''}${(item.msg || '').replace(/^Value error, /, '')}`
            }).join(' · ')
          : data.detail
        throw new Error(detail || 'Unable to submit your intake.')
      }
      onSubmitted(data); setMessage('Thanks, your recruiter will review this before your session.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to submit your intake.') } finally { setSaving(false) }
  }
  return <article className='mt-8 rounded-2xl border border-teal-200 bg-teal-50 p-6 sm:p-7'>
    <h2 className='text-xl font-bold text-slate-900'>Complete your intake so your recruiter can prepare</h2>
    <p className='mt-2 text-sm text-slate-700'>For your {request.service_type === 'recruiter_session' ? 'strategy session' : 'written review'}: {request.target_role}</p>
    <div className='mt-5 grid gap-4 md:grid-cols-2'>
      <label className='text-sm font-medium text-slate-700'>Use a saved resume<select value='' onChange={event => { const item = saved.find(resume => resume.key === event.target.value); if (item) { setResume(item.content); setResumeLabel(item.label) } }} className='mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900'><option value=''>Choose a saved resume…</option>{saved.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
      <label className='text-sm font-medium text-slate-700'>Upload a resume<input type='file' accept='.pdf,.docx' onChange={event => { const file = event.target.files?.[0]; if (file) void parseResume(file) }} className='mt-1.5 block w-full text-sm text-slate-700' /></label>
    </div>
    <label className='mt-4 block text-sm font-medium text-slate-700'>Or paste your resume<textarea value={resume} onChange={event => setResume(event.target.value)} className='mt-1.5 min-h-36 w-full rounded-xl border border-slate-300 p-3 text-slate-900' placeholder='Paste the version you want the recruiter to review.' /></label>
    <fieldset className='mt-5'><legend className='text-sm font-semibold text-slate-700'>Goal</legend><div className='mt-2 grid gap-2 sm:grid-cols-2'>{goalOptions.map(([value, label]) => <label key={value} className='flex items-center gap-2 text-sm text-slate-700'><input type='radio' checked={goal === value} onChange={() => setGoal(value)} /> {label}</label>)}</div></fieldset>
    <label className='mt-4 block text-sm font-medium text-slate-700'>Tell us more<textarea value={form.goal_details} onChange={event => setForm({ ...form, goal_details: event.target.value })} maxLength={1000} className='mt-1.5 min-h-20 w-full rounded-xl border border-slate-300 p-3 text-slate-900' /></label>
    <div className='mt-4 grid gap-4 md:grid-cols-3'>{[['target_country', 'Target country'], ['target_industry', 'Target industry'], ['current_role', 'Current role']].map(([key, label]) => <label key={key} className='text-sm font-medium text-slate-700'>{label}<input value={form[key as keyof typeof form]} onChange={event => setForm({ ...form, [key]: event.target.value })} className='mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900' /></label>)}</div>
    <div className='mt-5'><p className='text-sm font-semibold text-slate-700'>Job ads <span className='font-normal'>(up to 3)</span></p>{jobAds.map((ad, index) => <div key={index} className='mt-3 rounded-xl border border-slate-200 bg-white p-3'><div className='flex gap-2'><input value={jobLinks[index] || ''} onChange={event => setJobLinks(items => items.map((item, i) => i === index ? event.target.value : item))} placeholder='Paste a job link' className='min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900' /><button type='button' onClick={() => void fetchJob(index)} className='rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700'>Get text</button></div><textarea value={ad} onChange={event => updateAd(index, event.target.value)} maxLength={20000} placeholder='Or paste the job ad text' className='mt-2 min-h-24 w-full rounded-lg border border-slate-300 p-3 text-sm text-slate-900' /></div>)}{jobAds.length < 3 && <button type='button' onClick={() => { setJobAds([...jobAds, '']); setJobLinks([...jobLinks, '']) }} className='mt-3 text-sm font-semibold text-teal-800 underline'>Add another job ad</button>}</div>
    <div className='mt-4 grid gap-4 md:grid-cols-2'><label className='text-sm font-medium text-slate-700'>Biggest concern<textarea value={form.biggest_concern} onChange={event => setForm({ ...form, biggest_concern: event.target.value })} maxLength={2000} className='mt-1.5 min-h-24 w-full rounded-xl border border-slate-300 p-3 text-slate-900' /></label><label className='text-sm font-medium text-slate-700'>Achievements to highlight<textarea value={form.achievements} onChange={event => setForm({ ...form, achievements: event.target.value })} maxLength={3000} className='mt-1.5 min-h-24 w-full rounded-xl border border-slate-300 p-3 text-slate-900' /></label></div>
    <label className='mt-4 block text-sm font-medium text-slate-700'>LinkedIn URL <span className='font-normal text-slate-500'>(optional)</span><input value={form.linkedin_url} onChange={event => setForm({ ...form, linkedin_url: event.target.value })} placeholder='https://www.linkedin.com/in/your-name' className='mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900' /></label>
    <button type='button' onClick={() => void submit()} disabled={saving} className='mt-6 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50'>{saving ? 'Submitting…' : 'Submit intake'}</button>{message && <p role='status' className='mt-3 text-sm text-teal-900'>{message}</p>}
  </article>
}

const offers = [
  { key: 'quick_apply', name: 'Quick Apply Pack', price: 'C$4.99', detail: '2 resume optimizations + 1 interview-preparation pack' },
  { key: 'job_search_pack', name: 'Job Search Pack', price: 'C$9.99', detail: '5 resume optimizations + 2 interview-preparation packs' },
]

const recruiterOffers = [
  { key: 'written_review', name: 'Written Recruiter Review', price: 'C$49', detail: 'Personalized written feedback and prioritized resume recommendations. You will be asked for your target role at checkout.' },
  { key: 'recruiter_session', name: 'Recruiter Strategy Session', price: 'C$100', detail: 'A 30-minute session for resume, career, or interview guidance. Choose your time right after payment.' },
]

export default function BillingPage() {
  const [summary, setSummary] = useState<BillingSummary | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [checkingOut, setCheckingOut] = useState<string | null>(null)
  const [recruiterRequests, setRecruiterRequests] = useState<RecruiterRequest[]>([])
  const [accountEmail, setAccountEmail] = useState('')
  const [refreshingBooking, setRefreshingBooking] = useState(false)
  const [bookingRefreshMessage, setBookingRefreshMessage] = useState('')
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
  const creditClass = (credits: number | null | undefined) => summary?.unlimited || (credits ?? 0) > 0 ? 'text-emerald-700' : summary ? 'text-red-700' : 'text-slate-900'
  const sessionRequests = recruiterRequests.filter(request => request.service_type === 'recruiter_session' && ['submitted', 'in_review'].includes(request.status || ''))
  const bookableSessions = sessionRequests.filter(request => request.intake_submitted_at && !request.booking)
  const bookedSessions = sessionRequests.filter(request => request.booking)
  const hasReadySession = bookableSessions.length > 0
  const hasPendingSession = sessionRequests.some(request => !request.intake_submitted_at)
  const hasReadyReview = recruiterRequests.some(request => request.service_type === 'written_review' && request.intake_submitted_at && ['submitted', 'in_review'].includes(request.status || ''))

  const intakeSubmitted = (updated: RecruiterRequest) => {
    setRecruiterRequests(items => items.map(item => item.id === updated.id ? updated : item))
    setNotice('Thanks, your recruiter will review this before your session.')
    window.requestAnimationFrame(() => document.getElementById('recruiter-next-step')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  useEffect(() => {
    const checkoutResult = new URLSearchParams(window.location.search).get('checkout')
    if (checkoutResult === 'success') setNotice('Payment received. Your plan and credits will update in a moment. If you booked recruiter support, your request is now with our recruiters. For a strategy session, choose your time below.')
    if (checkoutResult === 'cancelled') setNotice('Checkout was cancelled. No charge was made.')
    void (async () => {
      const { data } = await supabase.auth.getSession()
      if (!data.session) return
      setAccountEmail(data.session.user.email || '')
      const headers = { Authorization: `Bearer ${data.session.access_token}` }
      const response = await fetch(`${API_URL}/billing/me`, { headers })
      if (!response.ok) { setError('Unable to load your plan and usage.'); return }
      setSummary(await response.json())
      const requests = await fetch(`${API_URL}/recruiter-requests`, { headers })
      if (requests.ok) setRecruiterRequests(await requests.json())
    })()
  }, [API_URL])

  const refreshBookings = async () => {
    setRefreshingBooking(true); setBookingRefreshMessage('')
    try {
      const { data } = await supabase.auth.getSession()
      if (!data.session) throw new Error('Please sign in again.')
      const response = await fetch(`${API_URL}/recruiter-requests/refresh-bookings`, { method: 'POST', headers: { Authorization: `Bearer ${data.session.access_token}` } })
      const requests = await response.json()
      if (!response.ok) throw new Error(requests.detail || 'Unable to refresh bookings.')
      setRecruiterRequests(requests)
      if (!requests.some((request: RecruiterRequest) => request.service_type === 'recruiter_session' && request.booking)) setBookingRefreshMessage(`We don't see your booking yet. Please make sure you booked with ${accountEmail || 'your account email'}. It can take a few minutes.`)
    } catch (refreshError) { setBookingRefreshMessage(refreshError instanceof Error ? refreshError.message : 'Unable to refresh bookings.') } finally { setRefreshingBooking(false) }
  }

  const startCheckout = async (productKey: string) => {
    setError('')
    setCheckingOut(productKey)
    try {
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        window.location.href = `/auth?next=${encodeURIComponent('/billing')}`
        return
      }
      const response = await fetch(`${API_URL}/billing/checkout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ product_key: productKey }),
      })
      const result = await response.json()
      if (!response.ok || !result.checkout_url) throw new Error(result.detail || 'Unable to start checkout.')
      window.location.assign(result.checkout_url)
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : 'Unable to start checkout.')
      setCheckingOut(null)
    }
  }

  return (
    <main className='min-h-screen bg-slate-50 px-6 py-12 sm:py-16'>
      <div className='mx-auto max-w-6xl'>
        <p className='text-sm font-semibold uppercase tracking-widest text-teal-700'>Plan and usage</p>
        <h1 className='mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl'>Choose support for your job search.</h1>
        <p className='mt-4 max-w-3xl text-lg leading-8 text-slate-600'>Start free, buy a small pack when you need it, or book time with a recruiter. No subscription.</p>

        {(hasReadySession || hasReadyReview || hasPendingSession || bookedSessions.length > 0) && <section id='recruiter-next-step' className='mt-6 scroll-mt-6'>
          {bookedSessions.map(request => { const booking = request.booking!; const time = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(booking.starts_at)); const team = booking.team === 'middle_east' ? 'Middle East' : 'North America'; return <div key={request.id} className='mb-4 rounded-2xl border border-teal-200 bg-teal-50 p-6'><h2 className='text-xl font-bold text-slate-900'>Your session: {time} with our {team} team</h2>{booking.meet_url && <a href={booking.meet_url} target='_blank' rel='noopener noreferrer' className='mt-3 inline-block font-semibold text-teal-800 underline'>Join Google Meet</a>}<p className='mt-3 text-sm text-slate-700'>To reschedule or cancel, use the link in your Google confirmation email.</p></div> })}
          {hasReadySession && <div className='rounded-2xl border border-teal-200 bg-teal-50 p-6 sm:p-7' aria-label='Book your recruiter session'><h2 className='text-xl font-bold text-slate-900'>Book your 30-minute session</h2><p className='mt-2 max-w-3xl leading-7 text-slate-700'>Choose a time that suits you. Please book with the same email address you used for your purchase, so we can match your booking to your order. A Google Meet link is included in your confirmation.</p><p className='mt-2 text-sm text-slate-700'>One session per purchase. To reschedule or cancel, use the link in your Google confirmation email.</p><div className='mt-4 flex flex-wrap gap-3'>{SESSION_BOOKING_PAGES.map(page => <a key={page.url} href={page.url} target='_blank' rel='noopener noreferrer' className='rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700'>{page.label}</a>)}<button type='button' onClick={() => void refreshBookings()} disabled={refreshingBooking} className='rounded-xl border border-slate-400 px-5 py-3 text-sm font-semibold text-slate-800 disabled:opacity-50'>{refreshingBooking ? 'Refreshing…' : "I've booked — refresh"}</button></div>{bookingRefreshMessage && <p role='status' className='mt-3 text-sm text-slate-700'>{bookingRefreshMessage}</p>}</div>}
          {hasPendingSession && <div className='rounded-2xl border border-slate-200 bg-white p-6'><h2 className='text-xl font-bold text-slate-900'>Session booking</h2><p className='mt-2 text-slate-700'>Complete your intake first, then choose a time (at least 48 hours ahead, so your recruiter can prepare).</p></div>}
          {hasReadyReview && <p className='mt-4 rounded-xl bg-teal-50 p-4 text-sm text-teal-900'>Delivered within 5 business days after your intake.</p>}
        </section>}

        {error && <p role='alert' className='mt-6 rounded-xl bg-red-50 p-4 text-red-800'>{error}</p>}
        {notice && <p role='status' className='mt-6 rounded-xl bg-teal-50 p-4 text-teal-900'>{notice}</p>}
        <section className='mt-8 grid gap-4 sm:grid-cols-3' aria-label='Current usage'>
          <div className='rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'><p className='text-sm text-slate-500'>Current plan</p><p className={`mt-2 text-2xl font-bold capitalize ${summary?.unlimited ? 'text-emerald-700' : 'text-slate-900'}`}>{summary?.unlimited ? 'Founding member' : summary?.entitlement.plan_key || 'Free'}</p></div>
          <div className='rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'><p className='text-sm text-slate-500'>Resume optimizations remaining</p><p className={`mt-2 text-3xl font-bold ${creditClass(summary?.available.resume_optimizations)}`}>{summary ? (summary.unlimited ? 'Unlimited' : summary.available.resume_optimizations) : '—'}</p></div>
          <div className='rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'><p className='text-sm text-slate-500'>Interview packs remaining</p><p className={`mt-2 text-3xl font-bold ${creditClass(summary?.available.interview_prep_packs)}`}>{summary ? (summary.unlimited ? 'Unlimited' : summary.available.interview_prep_packs) : '—'}</p></div>
        </section>

        <section className='mt-12'>
          <h2 className='text-2xl font-bold text-slate-900'>Self-service options</h2>
          <div className='mt-5 grid gap-5 md:grid-cols-2'>
            {offers.map(offer => <article key={offer.name} className='flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'><h3 className='text-xl font-bold text-slate-900'>{offer.name}</h3><p className='mt-3 text-3xl font-bold text-slate-900'>{offer.price}</p><p className='mt-4 flex-1 leading-7 text-slate-600'>{offer.detail}</p><button onClick={() => void startCheckout(offer.key)} disabled={!summary?.checkout_enabled || checkingOut !== null} className='mt-6 rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-55'>{checkingOut === offer.key ? 'Opening secure checkout…' : summary?.checkout_enabled ? 'Buy with Stripe' : 'Checkout setup in progress'}</button></article>)}
          </div>
        </section>

        {recruiterRequests.filter(request => !request.intake_submitted_at && ['submitted', 'in_review'].includes(request.status || '')).map(request => <RecruiterIntakeCard key={request.id} request={request} apiUrl={API_URL} onSubmitted={intakeSubmitted} />)}

        <section id='recruiter-support' className='mt-10 scroll-mt-24 rounded-2xl bg-slate-900 p-7 text-white sm:p-9'>
          <p className='text-sm font-semibold uppercase tracking-widest text-teal-300'>Human support</p>
          <h2 className='mt-3 text-2xl font-bold'>Get guidance from a recruiter.</h2>
          <p className='mt-3 max-w-3xl leading-7 text-slate-300'>Choose focused help for your resume, career direction, or next interview.</p>
          <div className='mt-6 grid gap-4 md:grid-cols-2'>
            {recruiterOffers.map(offer => <article key={offer.key} className='rounded-2xl bg-white/10 p-5'><h3 className='text-lg font-bold'>{offer.name}</h3><p className='mt-2 text-2xl font-bold'>{offer.price}</p><p className='mt-2 min-h-14 text-sm leading-6 text-slate-300'>{offer.detail}</p><button onClick={() => void startCheckout(offer.key)} disabled={!summary?.checkout_enabled || checkingOut !== null} className='mt-4 w-full rounded-xl bg-white px-4 py-3 font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-55'>{checkingOut === offer.key ? 'Opening secure checkout…' : summary?.checkout_enabled ? 'Book and pay' : 'Checkout setup in progress'}</button></article>)}
          </div>
        </section>

        <section className='mt-10 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm'><h2 className='text-2xl font-bold text-slate-900'>What happens after you book</h2><ol className='mt-5 grid gap-3 text-sm leading-6 text-slate-700 sm:grid-cols-2 lg:grid-cols-3'>{['Pay', 'Complete the intake', 'Recruiter reviews your resume', 'Session (or written review)', 'Email summary and delivery within 5 business days', 'One round of revisions within 3 days'].map((step, index) => <li key={step} className='rounded-xl bg-slate-50 p-4'><span className='mr-2 font-bold text-teal-700'>{index + 1}.</span>{step}</li>)}</ol></section>

        <p className='mt-6 text-sm leading-6 text-slate-500'>All prices are in Canadian dollars and are charged securely through Stripe. Purchases are covered by the refund and cancellation terms in our <a href={TERMS_URL} target='_blank' rel='noopener noreferrer' className='underline hover:text-slate-700'>Terms of Service</a> (sections 6.5 and 7). See our <a href={PRIVACY_URL} target='_blank' rel='noopener noreferrer' className='underline hover:text-slate-700'>Privacy Policy</a> for how we handle your information.</p>

        {summary?.orders.length ? <section className='mt-12'><h2 className='text-2xl font-bold text-slate-900'>Purchase history</h2><div className='mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white'>{summary.orders.map(order => <div key={order.id} className='flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 last:border-0'><div><p className='font-semibold text-slate-900'>{order.product_key.replaceAll('_', ' ')}</p><p className='text-sm text-slate-500'>{new Date(order.created_at).toLocaleDateString()}</p></div><p className='text-sm font-semibold uppercase text-slate-600'>{order.status}</p></div>)}</div></section> : null}
      </div>
    </main>
  )
}
