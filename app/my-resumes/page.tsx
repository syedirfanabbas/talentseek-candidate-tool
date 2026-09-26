'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type MasterResume = { id: string; content: string; updated_at: string }
type OptimizedResume = { id: string; title: string; content: string; job_title?: string; company_name?: string; created_at: string }
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

function downloadText(filename: string, content: string) {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([content], { type: 'text/plain' }))
  link.download = `${filename.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}.txt`
  link.click()
  URL.revokeObjectURL(link.href)
}

export default function MyResumesPage() {
  const [master, setMaster] = useState<MasterResume | null>(null)
  const [optimized, setOptimized] = useState<OptimizedResume[]>([])
  const [selected, setSelected] = useState<{ title: string; content: string } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function headers(): Promise<Record<string, string>> {
    const { data } = await supabase.auth.getSession()
    return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}
  }

  async function load() {
    setLoading(true); setError('')
    try {
      const requestHeaders = await headers()
      const [masterResponse, optimizedResponse] = await Promise.all([
        fetch(`${API_URL}/resume-library/master`, { headers: requestHeaders }),
        fetch(`${API_URL}/resume-library/optimized`, { headers: requestHeaders }),
      ])
      if (!masterResponse.ok || !optimizedResponse.ok) throw new Error('Unable to load your saved resumes.')
      setMaster(await masterResponse.json())
      setOptimized(await optimizedResponse.json())
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Unable to load your saved resumes.') }
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  async function rename(resume: OptimizedResume) {
    if (!title.trim()) return
    const response = await fetch(`${API_URL}/resume-library/optimized/${resume.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...await headers() }, body: JSON.stringify({ title: title.trim() }) })
    if (response.ok) {
      const updated = await response.json()
      setOptimized(items => items.map(item => item.id === resume.id ? updated : item))
      setEditingId(null)
    } else setError('Unable to rename this resume.')
  }

  async function deleteOptimized(resume: OptimizedResume) {
    if (!confirm(`Delete “${resume.title}”? This cannot be undone.`)) return
    const response = await fetch(`${API_URL}/resume-library/optimized/${resume.id}`, { method: 'DELETE', headers: await headers() })
    if (response.ok) setOptimized(items => items.filter(item => item.id !== resume.id))
    else setError('Unable to delete this resume.')
  }

  async function deleteMaster() {
    if (!confirm('Delete your saved master resume? This cannot be undone.')) return
    const response = await fetch(`${API_URL}/resume-library/master`, { method: 'DELETE', headers: await headers() })
    if (response.ok) setMaster(null)
    else setError('Unable to delete your master resume.')
  }

  return <main className='min-h-screen bg-slate-50 px-6 py-10'><div className='mx-auto max-w-5xl'>
    <Link href='/dashboard' className='text-sm text-slate-500 hover:text-slate-700'>← Back to What would you like to do?</Link>
    <header className='mt-6 flex flex-wrap items-end justify-between gap-5'><div><p className='text-sm font-semibold uppercase tracking-widest text-teal-700'>Your resume library</p><h1 className='mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl'>My Resumes</h1><p className='mt-4 text-lg text-slate-600'>Your saved master resume and optimized versions are available only to your account.</p></div><Link href='/master-resume' className='rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700'>Build master resume</Link></header>
    {error && <p role='alert' className='mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700'>{error}</p>}
    {loading ? <p className='mt-10 text-slate-500'>Loading saved resumes…</p> : <div className='mt-10 space-y-8'>
      <section><div className='flex items-center justify-between'><h2 className='text-2xl font-bold text-slate-900'>Master Resume</h2>{master && <span className='text-sm text-slate-500'>Updated {new Date(master.updated_at).toLocaleDateString()}</span>}</div>{master ? <article className='mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'><p className='text-slate-600'>Your complete career record, ready to tailor for future roles.</p><div className='mt-5 flex flex-wrap gap-3'><button onClick={() => setSelected({ title: 'Master Resume', content: master.content })} className='rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white'>View resume</button><button onClick={() => downloadText('master-resume', master.content)} className='rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700'>Download text</button><Link href='/master-resume' className='rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700'>Open builder</Link><button onClick={() => void deleteMaster()} className='rounded-xl px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50'>Delete</button></div></article> : <article className='mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-slate-600'>No saved master resume yet. <Link href='/master-resume' className='font-semibold text-slate-900 underline'>Build and save one now.</Link></article>}</section>
      <section><div className='flex items-center justify-between'><h2 className='text-2xl font-bold text-slate-900'>Optimized Resumes</h2><Link href='/' className='text-sm font-semibold text-slate-700 underline'>Optimize a new resume</Link></div>{optimized.length === 0 ? <article className='mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-slate-600'>No optimized resumes saved yet.</article> : <div className='mt-4 space-y-4'>{optimized.map(resume => <article key={resume.id} className='rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'>{editingId === resume.id ? <div className='flex flex-wrap gap-2'><input autoFocus value={title} onChange={event => setTitle(event.target.value)} className='min-w-60 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-slate-900' /><button onClick={() => void rename(resume)} className='rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white'>Save</button><button onClick={() => setEditingId(null)} className='rounded-lg px-3 py-2 text-sm text-slate-600'>Cancel</button></div> : <><div className='flex flex-wrap items-start justify-between gap-3'><div><h3 className='text-lg font-bold text-slate-900'>{resume.title}</h3><p className='mt-1 text-sm text-slate-500'>{[resume.job_title, resume.company_name].filter(Boolean).join(' · ') || 'Optimized resume'} · Saved {new Date(resume.created_at).toLocaleDateString()}</p></div></div><div className='mt-5 flex flex-wrap gap-3'><button onClick={() => setSelected({ title: resume.title, content: resume.content })} className='rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white'>View resume</button><button onClick={() => downloadText(resume.title, resume.content)} className='rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700'>Download text</button><button onClick={() => { setEditingId(resume.id); setTitle(resume.title) }} className='rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700'>Rename</button><button onClick={() => void deleteOptimized(resume)} className='rounded-xl px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50'>Delete</button></div></>}</article>)}</div>}</section>
    </div>}
    {selected && <div role='dialog' aria-modal='true' aria-label={selected.title} className='fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-6'><div className='max-h-[85vh] w-full max-w-4xl overflow-auto rounded-2xl bg-white p-6 shadow-xl'><div className='flex items-center justify-between gap-4'><h2 className='text-xl font-bold text-slate-900'>{selected.title}</h2><button onClick={() => setSelected(null)} className='rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100'>Close</button></div><pre className='mt-5 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-800'>{selected.content}</pre></div></div>}
  </div></main>
}
