'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type BillingSummary = {
  entitlement: { plan_key: string; subscription_status: string; subscription_period_end?: string | null }
  available: { resume_optimizations: number | null; interview_prep_packs: number | null }
  unlimited: boolean
  orders: Array<{ id: string; product_key: string; status: string; currency: string; amount_minor: number; created_at: string }>
  checkout_enabled: boolean
}

const offers = [
  { name: 'Quick Apply Pack', price: 'C$4.99', detail: '2 resume optimizations + 1 interview-preparation pack' },
  { name: 'Job Search Pack', price: 'C$9.99', detail: '5 resume optimizations + 2 interview-preparation packs' },
  { name: 'Job Search Membership', price: 'C$12.99/month', detail: '12 resume optimizations + 5 interview-preparation packs monthly' },
]

export default function BillingPage() {
  const [summary, setSummary] = useState<BillingSummary | null>(null)
  const [error, setError] = useState('')
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession()
      if (!data.session) return
      const response = await fetch(`${API_URL}/billing/me`, { headers: { Authorization: `Bearer ${data.session.access_token}` } })
      if (!response.ok) { setError('Unable to load your plan and usage.'); return }
      setSummary(await response.json())
    })()
  }, [API_URL])

  return (
    <main className='min-h-screen bg-slate-50 px-6 py-12 sm:py-16'>
      <div className='mx-auto max-w-6xl'>
        <p className='text-sm font-semibold uppercase tracking-widest text-teal-700'>Plan and usage</p>
        <h1 className='mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl'>Choose support for your job search.</h1>
        <p className='mt-4 max-w-3xl text-lg leading-8 text-slate-600'>Start free, buy a small pack when you need it, or use a monthly membership during an active search.</p>

        {error && <p role='alert' className='mt-6 rounded-xl bg-red-50 p-4 text-red-800'>{error}</p>}
        <section className='mt-8 grid gap-4 sm:grid-cols-3' aria-label='Current usage'>
          <div className='rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'><p className='text-sm text-slate-500'>Current plan</p><p className='mt-2 text-2xl font-bold capitalize text-slate-900'>{summary?.unlimited ? 'Founding member' : summary?.entitlement.plan_key || 'Free'}</p></div>
          <div className='rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'><p className='text-sm text-slate-500'>Resume optimizations remaining</p><p className='mt-2 text-3xl font-bold text-slate-900'>{summary ? (summary.unlimited ? 'Unlimited' : summary.available.resume_optimizations) : '—'}</p></div>
          <div className='rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'><p className='text-sm text-slate-500'>Interview packs remaining</p><p className='mt-2 text-3xl font-bold text-slate-900'>{summary ? (summary.unlimited ? 'Unlimited' : summary.available.interview_prep_packs) : '—'}</p></div>
        </section>

        <section className='mt-12'>
          <h2 className='text-2xl font-bold text-slate-900'>Self-service options</h2>
          <div className='mt-5 grid gap-5 md:grid-cols-3'>
            {offers.map(offer => <article key={offer.name} className='flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'><h3 className='text-xl font-bold text-slate-900'>{offer.name}</h3><p className='mt-3 text-3xl font-bold text-slate-900'>{offer.price}</p><p className='mt-4 flex-1 leading-7 text-slate-600'>{offer.detail}</p><button disabled className='mt-6 rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-55'>Checkout coming next</button></article>)}
          </div>
        </section>

        <section className='mt-10 rounded-2xl bg-slate-900 p-7 text-white sm:p-9'>
          <p className='text-sm font-semibold uppercase tracking-widest text-teal-300'>Human support</p>
          <h2 className='mt-3 text-2xl font-bold'>Get guidance from a recruiter.</h2>
          <p className='mt-3 max-w-3xl leading-7 text-slate-300'>Choose a C$49 written resume review or a C$100, 30-minute recruiter strategy session.</p>
          <a href='https://talentseek.ca/contact/' className='mt-6 inline-flex rounded-xl bg-white px-5 py-3 font-semibold text-slate-900'>Choose recruiter support</a>
        </section>

        {summary?.orders.length ? <section className='mt-12'><h2 className='text-2xl font-bold text-slate-900'>Purchase history</h2><div className='mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white'>{summary.orders.map(order => <div key={order.id} className='flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 last:border-0'><div><p className='font-semibold text-slate-900'>{order.product_key.replaceAll('_', ' ')}</p><p className='text-sm text-slate-500'>{new Date(order.created_at).toLocaleDateString()}</p></div><p className='text-sm font-semibold uppercase text-slate-600'>{order.status}</p></div>)}</div></section> : null}
      </div>
    </main>
  )
}
