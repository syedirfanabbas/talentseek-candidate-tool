'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import { InterviewPack, PackContext, downloadPackPdf, packToText } from '../../lib/interviewPackExport'

type SavedPack = { id: string; job_title: string; company_name: string; interview_type: string; created_at: string; pack: InterviewPack }
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const contextFor = (pack: SavedPack): PackContext => ({ jobTitle: pack.job_title, companyName: pack.company_name, interviewType: pack.interview_type })

export function InterviewPackLibrary() {
  const [packs, setPacks] = useState<Omit<SavedPack, 'pack'>[]>([])
  const [selected, setSelected] = useState<SavedPack | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function request(path = '', method = 'GET') {
    const { data } = await supabase.auth.getSession()
    if (!data.session) throw new Error('Please sign in to access your interview packs.')
    const response = await fetch(`${API_URL}/interview/packs${path}`, { method, headers: { Authorization: `Bearer ${data.session.access_token}` }, cache: 'no-store' })
    if (!response.ok) throw new Error(response.status === 404 ? 'This interview pack is no longer available.' : 'Unable to access your interview packs. Please try again.')
    return response
  }

  async function load() {
    setLoading(true); setError('')
    try { setPacks(await (await request()).json()) }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to load interview packs.') }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  async function open(id: string, pdf = false) {
    setBusy(true); setError('')
    try {
      const pack: SavedPack = await (await request(`/${id}`)).json()
      if (pdf) await downloadPackPdf(pack.pack, contextFor(pack))
      else setSelected(pack)
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to open interview pack.') }
    finally { setBusy(false) }
  }

  async function remove(pack: Omit<SavedPack, 'pack'>) {
    if (!confirm(`Delete the interview pack for ${pack.job_title} at ${pack.company_name}? This cannot be undone.`)) return
    setBusy(true); setError('')
    try {
      await request(`/${pack.id}`, 'DELETE')
      setPacks(items => items.filter(item => item.id !== pack.id))
      if (selected?.id === pack.id) setSelected(null)
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to delete interview pack.') }
    finally { setBusy(false) }
  }

  return <section className='mt-8'>
    <div className='flex flex-wrap items-center justify-between gap-3'><h2 className='text-2xl font-bold text-slate-900'>My interview packs</h2><Link href='/interview-prep' className='text-sm font-semibold text-slate-700 underline'>Prepare for an interview</Link></div>
    <p className='mt-2 text-sm text-slate-600'>Automatically saved to your account. View, download a PDF, or delete a pack.</p>
    {error && <div role='alert' className='mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700'>{error} <button onClick={() => void load()} disabled={busy || loading} className='font-semibold underline'>Retry</button></div>}
    {loading ? <p className='mt-4 text-slate-500'>Loading interview packs…</p> : packs.length === 0 && !error ? <p className='mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-slate-600'>No saved interview packs yet. Packs generated before this feature are not in the library.</p> : <div className='mt-4 space-y-4'>{packs.map(pack => <article key={pack.id} className='rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'>
      <h3 className='text-lg font-bold text-slate-900'>{pack.job_title} at {pack.company_name}</h3>
      <p className='mt-1 text-sm text-slate-500'>{pack.interview_type} · Saved {new Date(pack.created_at).toLocaleDateString()}</p>
      <div className='mt-5 flex flex-wrap gap-3'><button disabled={busy} onClick={() => void open(pack.id)} className='rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50'>View pack</button><button disabled={busy} onClick={() => void open(pack.id, true)} className='rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50'>Download PDF</button><button disabled={busy} onClick={() => void remove(pack)} className='rounded-xl px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50'>Delete</button></div>
    </article>)}</div>}
    {selected && <div role='dialog' aria-modal='true' aria-label='Saved interview pack' className='fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-6'><div className='max-h-[85vh] w-full max-w-4xl overflow-auto rounded-2xl bg-white p-6 shadow-xl'><div className='flex flex-wrap items-center justify-between gap-4'><h2 className='text-xl font-bold text-slate-900'>{selected.job_title} at {selected.company_name}</h2><button onClick={() => setSelected(null)} className='rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100'>Close</button></div><pre className='mt-5 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-800'>{packToText(selected.pack, contextFor(selected))}</pre></div></div>}
  </section>
}
