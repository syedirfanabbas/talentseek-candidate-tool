'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useJobLink } from '../../lib/useJobLink'
import { supabase } from '../../lib/supabase'
import { AiProcessingNotice } from '../components/AiProcessingNotice'
import { errorDetail, outOfCreditsMessage } from '../../lib/credits'
import { runAiJob } from '../../lib/aiJobs'
import { withRetryAdvice } from '../../lib/retryAdvice'
import { InterviewPack as PreparationPack, downloadPackPdf, packToText } from '../../lib/interviewPackExport'
import { takeInterviewPrefill } from '../../lib/interviewPrefill'

type SavedResume = { key: string; label: string; content: string; jobTitle?: string; companyName?: string }

const LEAVE_WARNING = 'Your interview pack is not saved to your account. Download or copy it before you leave, or it will be lost.'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const interviewTypes = ['Recruiter screen', 'Hiring manager', 'Technical', 'Behavioural', 'Final interview']

export default function InterviewPreparationPage() {
  const [jobTitle, setJobTitle] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [jobTitleEdited, setJobTitleEdited] = useState(false)
  const [companyEdited, setCompanyEdited] = useState(false)
  const [interviewType, setInterviewType] = useState(interviewTypes[0])
  const [jobDescription, setJobDescription] = useState('')
  const [resumeText, setResumeText] = useState('')
  const [pack, setPack] = useState<PreparationPack | null>(null)
  const [checked, setChecked] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [needsCredits, setNeedsCredits] = useState(false)
  const [freeAllowanceGranted, setFreeAllowanceGranted] = useState<boolean | null>(null)
  const [kept, setKept] = useState(false)
  const [exportMessage, setExportMessage] = useState('')
  const [savedResumes, setSavedResumes] = useState<SavedResume[]>([])
  const [resumeSource, setResumeSource] = useState('')
  const [uploading, setUploading] = useState<'' | 'resume' | 'job'>('')

  async function authHeaders(): Promise<Record<string, string>> {
    const { data } = await supabase.auth.getSession()
    return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}
  }

  const { jobLink, setJobLink, isFetchingJob, jobLinkError, fetchJobText } = useJobLink({ apiUrl: API_URL, authHeaders, onSuccess: data => { setJobDescription(data.text); if (data.job_title && !jobTitleEdited) setJobTitle(data.job_title); if (data.company_name && !companyEdited) setCompanyName(data.company_name) } })

  // Offer the user's saved resumes, and pick up one sent from My Resumes.
  useEffect(() => {
    void (async () => { const { data } = await supabase.auth.getSession(); if (data.session) { const r = await fetch(`${API_URL}/billing/me`, { headers: { Authorization: `Bearer ${data.session.access_token}` } }); if (r.ok) setFreeAllowanceGranted((await r.json()).free_allowance_granted) } })()
    const prefill = takeInterviewPrefill()
    if (prefill) {
      setResumeText(prefill.resumeText)
      setResumeSource(prefill.resumeLabel)
      if (prefill.jobTitle) setJobTitle(prefill.jobTitle)
      if (prefill.companyName) setCompanyName(prefill.companyName)
    }
    void (async () => {
      try {
        const headers = await authHeaders()
        const [masterResponse, optimizedResponse] = await Promise.all([
          fetch(`${API_URL}/resume-library/master`, { headers }),
          fetch(`${API_URL}/resume-library/optimized`, { headers }),
        ])
        const master = masterResponse.ok ? await masterResponse.json() : null
        const optimized: { id: string; title: string; content: string; job_title?: string; company_name?: string }[] = optimizedResponse.ok ? await optimizedResponse.json() : []
        setSavedResumes([
          ...(master?.content ? [{ key: 'master', label: 'Master resume', content: master.content }] : []),
          ...optimized.map(item => ({ key: item.id, label: item.title, content: item.content, jobTitle: item.job_title || undefined, companyName: item.company_name || undefined })),
        ])
      } catch { /* the picker simply stays hidden */ }
    })()
  }, [])

  function chooseSavedResume(key: string) {
    const resume = savedResumes.find(item => item.key === key)
    if (!resume) return
    setResumeText(resume.content)
    setResumeSource(resume.label)
    if (!jobTitle.trim() && resume.jobTitle) setJobTitle(resume.jobTitle)
    if (!companyName.trim() && resume.companyName) setCompanyName(resume.companyName)
  }

  async function uploadFile(file: File, target: 'resume' | 'job') {
    setUploading(target); setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch(`${API_URL}/resumes/parse-demo`, { method: 'POST', headers: await authHeaders(), body: formData })
      const data = response.ok ? await response.json() : null
      if (!data?.text) throw new Error(data?.error || errorDetail(data, 'We could not read that file. Please upload a PDF or Word file, or paste the text.'))
      if (target === 'resume') { setResumeText(data.text); setResumeSource(file.name) } else setJobDescription(data.text)
    } catch (uploadError) {
      setError(withRetryAdvice(uploadError instanceof Error ? uploadError.message : 'Upload failed. Please paste the text instead.'))
    }
    setUploading('')
  }

  // Packs are not stored, so warn before the tab closes until the candidate has kept a copy.
  useEffect(() => {
    if (!pack || kept) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [pack, kept])

  async function generatePack(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setNeedsCredits(false)
    const { data } = await supabase.auth.getSession()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`
    try {
      // Runs as a background job: interview packs can take over a minute, longer than phones wait.
      const outcome = await runAiJob<PreparationPack>(API_URL, '/interview/generate-pack/jobs',
        { job_title: jobTitle.trim(), company_name: companyName.trim(), interview_type: interviewType, job_description: jobDescription.trim(), resume_text: resumeText.trim() || undefined },
        headers)
      if (!outcome.ok) {
        const creditMessage = (freeAllowanceGranted === false && outcome.status === 402 ? 'The free allowance is one per person. Buy a pack to continue.' : outOfCreditsMessage(outcome.status, outcome.body))
        if (creditMessage) { setNeedsCredits(true); throw Object.assign(new Error(creditMessage), { noRetryAdvice: true }) }
        throw new Error(errorDetail(outcome.body, 'Unable to generate your interview preparation pack.'))
      }
      setPack(outcome.result)
      setChecked([])
      setKept(false)
      setExportMessage('')
    } catch (generationError) {
      setError(generationError instanceof Error && (generationError as Error & { noRetryAdvice?: boolean }).noRetryAdvice ? generationError.message : withRetryAdvice(generationError instanceof Error ? generationError.message : 'Unable to generate your interview preparation pack.'))
    }
    setLoading(false)
  }

  const packContext = { jobTitle: jobTitle.trim(), companyName: companyName.trim(), interviewType }
  async function keepPack(action: 'copy' | 'pdf') {
    if (!pack) return
    try {
      if (action === 'copy') { await navigator.clipboard.writeText(packToText(pack, packContext)); setExportMessage('Copied. Paste it into your notes or email it to yourself.') }
      else { await downloadPackPdf(pack, packContext); setExportMessage('Downloaded as a PDF.') }
      setKept(true)
    } catch { setExportMessage(action === 'copy' ? 'Copying was blocked by your browser. Please use Download instead.' : 'The download did not start. Please try again.') }
  }
  const confirmLeave = (event: React.MouseEvent) => { if (pack && !kept && !window.confirm(LEAVE_WARNING)) event.preventDefault() }

  const toggleChecklist = (item: string) => setChecked(current => current.includes(item) ? current.filter(entry => entry !== item) : [...current, item])

  return <main className='min-h-screen bg-slate-50 px-6 py-10'><div className='mx-auto max-w-5xl'>
    <a href='/dashboard' onClick={confirmLeave} className='text-sm text-slate-500 hover:text-slate-700'>← Back to What would you like to do?</a>
    <header className='mt-6 max-w-3xl'><p className='text-sm font-semibold uppercase tracking-widest text-teal-700'>Interview preparation</p><h1 className='mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl'>Walk into your interview prepared.</h1><p className='mt-4 text-lg leading-8 text-slate-600'>Get likely questions, preparation priorities, and clear ways to connect your experience to the role.</p></header>

    <form onSubmit={generatePack} className='mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'>
      <div className='flex items-center justify-between gap-4'><div><h2 className='text-xl font-bold text-slate-900'>Interview details</h2><p className='mt-1 text-sm text-slate-500'>Your information stays in this session and is not saved to your account. Download or copy your pack to keep it.</p></div>{pack && <button type='submit' disabled={loading} className='rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50'>{loading ? 'Generating…' : 'Regenerate pack'}</button>}</div>
      <div className='mt-6 grid gap-4 md:grid-cols-2'><label className='text-sm font-medium text-slate-700'>Job title<input required value={jobTitle} onChange={event => { setJobTitleEdited(true); setJobTitle(event.target.value) }} className='mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900' placeholder='e.g. Senior Project Manager' /></label><label className='text-sm font-medium text-slate-700'>Company<input required value={companyName} onChange={event => { setCompanyEdited(true); setCompanyName(event.target.value) }} className='mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900' placeholder='Company name' /></label><label className='text-sm font-medium text-slate-700'>Interview type<select value={interviewType} onChange={event => setInterviewType(event.target.value)} className='mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900'>{interviewTypes.map(type => <option key={type}>{type}</option>)}</select></label></div>
      <div className='mt-4'><div className='flex gap-2'><input value={jobLink} onChange={event => setJobLink(event.target.value)} placeholder='Paste a job link' className='min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900' /><button type='button' onClick={() => void fetchJobText()} disabled={isFetchingJob} className='rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700'>{isFetchingJob ? 'Getting…' : 'Get job text'}</button></div>{jobLinkError && <p className='mt-2 text-sm text-red-700'>{jobLinkError}</p>}<div className='mt-3 flex flex-wrap items-center justify-between gap-2'><span className='text-sm font-medium text-slate-700'>Job description</span><label className='cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50'>{uploading === 'job' ? 'Reading file…' : '📄 Upload PDF or Word'}<input type='file' accept='.pdf,.docx' className='hidden' disabled={uploading !== ''} onChange={event => { const file = event.target.files?.[0]; if (file) void uploadFile(file, 'job'); event.target.value = '' }} /></label></div><textarea required minLength={40} value={jobDescription} onChange={event => setJobDescription(event.target.value)} aria-label='Job description' className='mt-1.5 min-h-40 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900' placeholder='Paste the job description here.' /></div>
      <div className='mt-4'><div className='flex flex-wrap items-center justify-between gap-2'><span className='text-sm font-medium text-slate-700'>Your resume <span className='font-normal text-slate-500'>(recommended: makes the pack about your own experience)</span></span><div className='flex flex-wrap gap-2'>{savedResumes.length > 0 && <select value='' onChange={event => chooseSavedResume(event.target.value)} aria-label='Use a saved resume' className='rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700'><option value=''>Use a saved resume…</option>{savedResumes.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select>}<label className='cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50'>{uploading === 'resume' ? 'Reading file…' : '📄 Upload PDF or Word'}<input type='file' accept='.pdf,.docx' className='hidden' disabled={uploading !== ''} onChange={event => { const file = event.target.files?.[0]; if (file) void uploadFile(file, 'resume'); event.target.value = '' }} /></label></div></div>{resumeSource && resumeText && <p className='mt-1.5 text-xs text-teal-700'>Using: {resumeSource}</p>}<textarea value={resumeText} onChange={event => { setResumeText(event.target.value); if (!event.target.value) setResumeSource('') }} aria-label='Your resume' className='mt-1.5 min-h-40 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900' placeholder='Paste your resume, upload a file, or choose a saved resume.' /></div>
      <AiProcessingNotice />
      {!pack && <button disabled={loading} className='mt-6 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50'>{loading ? 'Creating your preparation pack…' : 'Generate interview plan →'}</button>}
      {error && <p role='alert' className='mt-4 text-sm text-red-700'>{error}{needsCredits && <a href='/billing' className='ml-2 font-semibold underline'>View plans →</a>}</p>}
    </form>

    {pack && <section className='mt-8 space-y-6'><div className='flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4'><p className='flex-1 text-sm text-amber-900'>{exportMessage || 'Keep this pack: it is not saved to your account.'}</p><button type='button' onClick={() => void keepPack('pdf')} className='rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50'>📥 PDF</button><button type='button' onClick={() => void keepPack('copy')} className='rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50'>Copy text</button></div><div className='grid gap-6 md:grid-cols-[220px_1fr]'><article className='rounded-2xl bg-slate-900 p-6 text-white'><p className='text-xs font-semibold uppercase tracking-wider text-teal-300'>Resume match</p><p className='mt-3 text-5xl font-bold'>{pack.match_confidence.score}%</p><p className='mt-2 font-semibold'>{pack.match_confidence.label}</p><p className='mt-3 text-sm leading-6 text-slate-300'>{pack.match_confidence.summary}</p></article><article className='rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'><h2 className='text-xl font-bold text-slate-900'>What this role needs</h2><p className='mt-3 leading-7 text-slate-600'>{pack.role_summary}</p><h3 className='mt-5 text-sm font-semibold uppercase tracking-wider text-teal-700'>Skills to demonstrate</h3><div className='mt-3 flex flex-wrap gap-2'>{pack.skills_to_demonstrate.map(skill => <span key={skill} className='rounded-full bg-teal-50 px-3 py-1 text-sm text-teal-800'>{skill}</span>)}</div></article></div>
      <article className='rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'><h2 className='text-xl font-bold text-slate-900'>Likely interview questions</h2><p className='mt-2 text-sm text-slate-600'>Each question includes talking points from your own resume. Click a question to show or hide them.</p><div className='mt-5 space-y-4'>{pack.likely_questions.map((item, index) => <details key={`${item.question}-${index}`} open={index === 0} className='group rounded-xl border border-slate-200 p-4'><summary className='cursor-pointer font-semibold text-slate-900'><span className='mr-2 text-xs font-medium uppercase tracking-wider text-teal-700'>{item.category}</span>{item.question}<span className='ml-2 whitespace-nowrap text-xs font-medium text-teal-700 group-open:hidden'>Show how to answer ▸</span></summary><ul className='mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600'>{item.answer_points.map(point => <li key={point}>{point}</li>)}</ul></details>)}</div></article>
      <div className='grid gap-6 md:grid-cols-2'><article className='rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'><h2 className='text-xl font-bold text-slate-900'>Questions to ask</h2><ol className='mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-slate-600'>{pack.questions_to_ask.map(question => <li key={question}>{question}</li>)}</ol></article><article className='rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'><h2 className='text-xl font-bold text-slate-900'>Interview checklist</h2><div className='mt-4 space-y-3'>{pack.checklist.map(item => <label key={item} className='flex cursor-pointer items-start gap-3 text-sm leading-6 text-slate-700'><input type='checkbox' checked={checked.includes(item)} onChange={() => toggleChecklist(item)} className='mt-1 h-4 w-4 rounded border-slate-300 text-teal-700' /><span className={checked.includes(item) ? 'text-slate-400 line-through' : ''}>{item}</span></label>)}</div></article></div>
    </section>}
  </div></main>
}
