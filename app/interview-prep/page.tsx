'use client'

import { FormEvent, useState } from 'react'
import { supabase } from '../../lib/supabase'

type PreparationPack = {
  match_confidence: { score: number; label: string; summary: string }
  role_summary: string
  skills_to_demonstrate: string[]
  likely_questions: { question: string; category: string; answer_points: string[] }[]
  questions_to_ask: string[]
  checklist: string[]
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const interviewTypes = ['Recruiter screen', 'Hiring manager', 'Technical', 'Behavioural', 'Final interview']

export default function InterviewPreparationPage() {
  const [jobTitle, setJobTitle] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [interviewType, setInterviewType] = useState(interviewTypes[0])
  const [jobDescription, setJobDescription] = useState('')
  const [resumeText, setResumeText] = useState('')
  const [pack, setPack] = useState<PreparationPack | null>(null)
  const [checked, setChecked] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function generatePack(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    const { data } = await supabase.auth.getSession()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`
    try {
      const response = await fetch(`${API_URL}/interview/generate-pack`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ job_title: jobTitle.trim(), company_name: companyName.trim(), interview_type: interviewType, job_description: jobDescription.trim(), resume_text: resumeText.trim() || undefined }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.detail || 'Unable to generate your interview preparation pack.')
      setPack(result)
      setChecked([])
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'Unable to generate your interview preparation pack.')
    }
    setLoading(false)
  }

  const toggleChecklist = (item: string) => setChecked(current => current.includes(item) ? current.filter(entry => entry !== item) : [...current, item])

  return <main className='min-h-screen bg-slate-50 px-6 py-10'><div className='mx-auto max-w-5xl'>
    <a href='/dashboard' className='text-sm text-slate-500 hover:text-slate-700'>← Back to What would you like to do?</a>
    <header className='mt-6 max-w-3xl'><p className='text-sm font-semibold uppercase tracking-widest text-teal-700'>Interview preparation</p><h1 className='mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl'>Walk into your interview prepared.</h1><p className='mt-4 text-lg leading-8 text-slate-600'>Get likely questions, preparation priorities, and clear ways to connect your experience to the role.</p></header>

    <form onSubmit={generatePack} className='mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'>
      <div className='flex items-center justify-between gap-4'><div><h2 className='text-xl font-bold text-slate-900'>Interview details</h2><p className='mt-1 text-sm text-slate-500'>Your information stays in this session and is not saved by this feature.</p></div>{pack && <button type='submit' disabled={loading} className='rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50'>{loading ? 'Generating…' : 'Regenerate pack'}</button>}</div>
      <div className='mt-6 grid gap-4 md:grid-cols-2'><label className='text-sm font-medium text-slate-700'>Job title<input required value={jobTitle} onChange={event => setJobTitle(event.target.value)} className='mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900' placeholder='e.g. Senior Project Manager' /></label><label className='text-sm font-medium text-slate-700'>Company<input required value={companyName} onChange={event => setCompanyName(event.target.value)} className='mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900' placeholder='Company name' /></label><label className='text-sm font-medium text-slate-700'>Interview type<select value={interviewType} onChange={event => setInterviewType(event.target.value)} className='mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900'>{interviewTypes.map(type => <option key={type}>{type}</option>)}</select></label></div>
      <label className='mt-4 block text-sm font-medium text-slate-700'>Job description<textarea required minLength={40} value={jobDescription} onChange={event => setJobDescription(event.target.value)} className='mt-1.5 min-h-40 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900' placeholder='Paste the job description here.' /></label>
      <label className='mt-4 block text-sm font-medium text-slate-700'>Resume text <span className='font-normal text-slate-500'>(optional, for personalized guidance)</span><textarea value={resumeText} onChange={event => setResumeText(event.target.value)} className='mt-1.5 min-h-40 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900' placeholder='Paste your resume here.' /></label>
      {!pack && <button disabled={loading} className='mt-6 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50'>{loading ? 'Creating your preparation pack…' : 'Generate interview plan →'}</button>}
      {error && <p role='alert' className='mt-4 text-sm text-red-700'>{error}</p>}
    </form>

    {pack && <section className='mt-8 space-y-6'><div className='grid gap-6 md:grid-cols-[220px_1fr]'><article className='rounded-2xl bg-slate-900 p-6 text-white'><p className='text-xs font-semibold uppercase tracking-wider text-teal-300'>Resume match</p><p className='mt-3 text-5xl font-bold'>{pack.match_confidence.score}%</p><p className='mt-2 font-semibold'>{pack.match_confidence.label}</p><p className='mt-3 text-sm leading-6 text-slate-300'>{pack.match_confidence.summary}</p></article><article className='rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'><h2 className='text-xl font-bold text-slate-900'>What this role needs</h2><p className='mt-3 leading-7 text-slate-600'>{pack.role_summary}</p><h3 className='mt-5 text-sm font-semibold uppercase tracking-wider text-teal-700'>Skills to demonstrate</h3><div className='mt-3 flex flex-wrap gap-2'>{pack.skills_to_demonstrate.map(skill => <span key={skill} className='rounded-full bg-teal-50 px-3 py-1 text-sm text-teal-800'>{skill}</span>)}</div></article></div>
      <article className='rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'><h2 className='text-xl font-bold text-slate-900'>Likely interview questions</h2><div className='mt-5 space-y-4'>{pack.likely_questions.map((item, index) => <details key={`${item.question}-${index}`} className='rounded-xl border border-slate-200 p-4'><summary className='cursor-pointer font-semibold text-slate-900'><span className='mr-2 text-xs font-medium uppercase tracking-wider text-teal-700'>{item.category}</span>{item.question}</summary><ul className='mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600'>{item.answer_points.map(point => <li key={point}>{point}</li>)}</ul></details>)}</div></article>
      <div className='grid gap-6 md:grid-cols-2'><article className='rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'><h2 className='text-xl font-bold text-slate-900'>Questions to ask</h2><ol className='mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-slate-600'>{pack.questions_to_ask.map(question => <li key={question}>{question}</li>)}</ol></article><article className='rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'><h2 className='text-xl font-bold text-slate-900'>Interview checklist</h2><div className='mt-4 space-y-3'>{pack.checklist.map(item => <label key={item} className='flex cursor-pointer items-start gap-3 text-sm leading-6 text-slate-700'><input type='checkbox' checked={checked.includes(item)} onChange={() => toggleChecklist(item)} className='mt-1 h-4 w-4 rounded border-slate-300 text-teal-700' /><span className={checked.includes(item) ? 'text-slate-400 line-through' : ''}>{item}</span></label>)}</div></article></div>
    </section>}
  </div></main>
}
