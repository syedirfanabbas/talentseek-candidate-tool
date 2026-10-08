'use client'

import { useEffect, useState } from 'react'
import { MasterResumeUpdates } from '../components/MasterResumeUpdates'
import { consolidationInputs, MAX_MASTER_INPUTS } from '../../lib/masterResumeInputs'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { AiProcessingNotice } from '../components/AiProcessingNotice'
import { downloadResumePdf, downloadResumeDocx } from '../../lib/resumeLayout'
import { supabase } from '../../lib/supabase'
import { apiErrorMessage } from '../../lib/apiError'
import { withRetryAdvice } from '../../lib/retryAdvice'

const MAX_RESUMES = MAX_MASTER_INPUTS

async function errorMessage(res: Response, fallback: string): Promise<string> { return apiErrorMessage(await res.json().catch(() => null), fallback) }

export default function MasterResume() {
  const [files, setFiles] = useState<{ name: string; text: string }[]>([])
  const [updates, setUpdates] = useState('')
  const [updateFlow, setUpdateFlow] = useState(false)
  const validation = consolidationInputs(files, updates)
  const [masterResume, setMasterResume] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [savedContent, setSavedContent] = useState('') // what's stored in the account; the Save button is disabled while it matches

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  useEffect(() => {
    setUpdateFlow(new URLSearchParams(window.location.search).get('start') === 'update')
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return
      const response = await fetch(`${API_URL}/resume-library/master`, { headers: { Authorization: `Bearer ${data.session.access_token}` } })
      if (response.ok) {
        const saved = await response.json()
        if (saved?.content) { setMasterResume(saved.content); setSavedContent(saved.content); setSaveMessage('Loaded your saved master resume.') }
      }
    })
  }, [])

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token

    return token
      ? { Authorization: `Bearer ${token}` }
      : {}
  }


  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || [])
    if (files.length + selected.length + (updates.trim() ? 1 : 0) > MAX_RESUMES) {
      setError('Use at most 10 inputs in total; your typed update counts as one input.')
      return
    }
    setError('')
    for (let i = 0; i < selected.length; i++) {
      const file = selected[i]
      setUploadingIndex(files.length + i)
      try {
        const formData = new FormData()
        formData.append('file', file)
        const authHeaders = await getAuthHeaders()
        const res = await fetch(`${API_URL}/resumes/parse-demo`, {
          method: 'POST',
          headers: authHeaders,
          body: formData,
        })
        if (!res.ok) throw new Error(await errorMessage(res, 'Failed to parse ' + file.name))
        const data = await res.json()
        if (data.text) {
          setFiles(prev => [...prev, { name: file.name, text: data.text }])
        } else {
          setError(withRetryAdvice(typeof data.error === 'string' ? data.error : apiErrorMessage(data, 'Could not extract text from ' + file.name)))
        }
      } catch (err) {
        setError(withRetryAdvice(err instanceof Error ? err.message : 'Upload failed'))
      }
    }
    setUploadingIndex(null)
    e.target.value = ''
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleConsolidate = async () => {
    if (validation.error) { setError(validation.error); return }
    setIsLoading(true); setError(''); setMasterResume('')
    try {
      const authHeaders = await getAuthHeaders()
      const res = await fetch(`${API_URL}/resumes/consolidate-demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ resumes: validation.inputs }),
      })
      if (!res.ok) throw new Error(await errorMessage(res, 'Consolidation failed'))
      const data = await res.json()
      if (!data.master_resume?.trim()) throw new Error('We could not build your master resume. Please try again.')
      setMasterResume(data.master_resume)
    } catch (err) {
      setError(withRetryAdvice(err instanceof Error ? err.message : 'Something went wrong'))
    } finally { setIsLoading(false) }
  }

  const saveMasterResume = async () => {
    if (!masterResume.trim()) return false
    setIsSaving(true); setSaveMessage(''); setError('')
    try {
      const response = await fetch(`${API_URL}/resume-library/master`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', ...await getAuthHeaders() },
        body: JSON.stringify({ content: masterResume }),
      })
      if (!response.ok) throw new Error('Unable to save your master resume.')
      setSavedContent(masterResume)
      setSaveMessage('Master resume saved securely to your account.')
      return true
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Unable to save your master resume.'); return false }
    finally { setIsSaving(false) }
  }

  const tailorMasterResume = async () => {
    if (masterResume !== savedContent && !await saveMasterResume()) return
    window.location.assign('/')
  }

  const downloadDocx = () => downloadResumeDocx(masterResume, 'master-resume', null)
  const downloadPdf = () => downloadResumePdf(masterResume, 'master-resume', null)

  return (
    <main className='min-h-screen bg-slate-50 px-6 py-10'>
      <div className='mx-auto max-w-6xl'>
        <header className='mb-10 max-w-3xl'><p className='text-sm font-semibold uppercase tracking-widest text-teal-700'>Master resume</p><h1 className='mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl'>Build or update your master resume.</h1><p className='mt-4 text-lg leading-8 text-slate-600'>One complete career record to tailor from. It is not the resume you send to employers.</p></header>


        <div className='grid gap-8 lg:grid-cols-2'>
          <section className='rounded-2xl bg-white p-6 shadow-sm'>
            <h2 className='mb-1 text-xl font-semibold text-slate-900'>Upload Your Resumes</h2>
            <p className='mb-4 text-sm text-slate-500'>A master resume is your complete career record, built from all your old resume versions. It is not the resume you send to employers: use it as the starting point when you tailor a resume to a job. Upload 2 or more versions, or one resume plus what’s new below (up to {MAX_RESUMES} inputs in total).</p>

            {files.length < MAX_RESUMES && (
              <label className='mb-4 flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-6 text-slate-500 hover:border-slate-400'>
                <span className='text-3xl'>📎</span>
                <span className='text-sm font-medium'>Click to upload PDF or Word files</span>
                <span className='text-xs text-slate-400'>{files.length}/{MAX_RESUMES} uploaded</span>
                <input
                  type='file'
                  accept='.pdf,.docx'
                  multiple
                  className='hidden'
                  onChange={handleFileUpload}
                  disabled={uploadingIndex !== null || isLoading}
                />
              </label>
            )}
            <AiProcessingNotice />

            {uploadingIndex !== null && (
              <div className='mb-3 flex items-center gap-2 text-sm text-slate-500'>
                <LoadingSpinner />
                <span>Extracting text from file {uploadingIndex + 1}...</span>
              </div>
            )}

            {files.length > 0 && (
              <div className='mb-4 space-y-2'>
                {files.map((file, i) => (
                  <div key={i} className='flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2'>
                    <div className='flex items-center gap-2'>
                      <span className='text-lg'>📄</span>
                      <div>
                        <p className='text-sm font-medium text-slate-700'>{file.name}</p>
                        <p className='text-xs text-slate-400'>{file.text.split(' ').length} words extracted</p>
                      </div>
                    </div>
                    <button onClick={() => removeFile(i)}
                      aria-label={`Remove ${file.name}`} disabled={isLoading} className='text-slate-400 hover:text-red-500 text-lg leading-none'>×</button>
                  </div>
                ))}
              </div>
            )}

            {files.length >= MAX_RESUMES && (
              <div className='mb-4 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-700'>
                Maximum {MAX_RESUMES} resumes reached
              </div>
            )}

            <MasterResumeUpdates value={updates} onChange={setUpdates} updateFlow={updateFlow} disabled={isLoading} />
            <p className='mb-4 text-sm text-slate-700'>Designed to work from your experience: you review everything before you use it.</p>
            <button
              onClick={handleConsolidate}
              disabled={isLoading || uploadingIndex !== null || Boolean(validation.error)}
              className='w-full rounded-xl bg-slate-900 px-5 py-3 text-white disabled:opacity-40'>
              {isLoading ? 'Working...' : `✨ Build Master Resume (${validation.inputs.length} inputs)`}
            </button>

            {validation.error && <p role='status' aria-live='polite' className='mt-2 text-sm text-slate-600'>{validation.error}</p>}

            {error && <div role='alert' className='mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700'>{error}</div>}
          </section>

          <section className='rounded-2xl bg-white p-6 shadow-sm'>
            <h2 className='mb-4 text-xl font-semibold text-slate-900'>Master Resume</h2>

            {!masterResume && !isLoading && (
              <div className='rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500'>
                <p className='text-4xl mb-3'>📋</p>
                <p className='text-sm'>Upload resume versions, or one resume and your recent updates, then click Build Master Resume. The AI merges them into one complete record of your experience.</p>
              </div>
            )}

            {isLoading && (
              <div className='flex flex-col items-center gap-3 py-12'>
                <LoadingSpinner />
                <p className='text-sm text-slate-500'>Building your master resume…</p>
                <p className='text-xs text-slate-400'>Combining your experience and updates. This may take about a minute.</p>
              </div>
            )}

            {masterResume && (
              <div>
                <p className='mb-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800'>
                  Review it, then use Next to save it and tailor it to a job (choose &quot;Master resume&quot; under &quot;Use a saved resume&quot;) to get a resume you can send.
                </p>
                <button onClick={() => void tailorMasterResume()} disabled={isSaving} className='mb-4 rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50'>Next: tailor it to a job</button>
                <p className='mb-4 text-sm text-slate-600'>This saves your master resume first. In Tailor My Resume, choose Master resume under Use a saved resume.</p>
                <div className='mb-3 flex flex-wrap items-center justify-between gap-3'>
                  <h3 className='font-semibold text-slate-800'>Your Master Resume</h3>
                  <div className='flex gap-2'>
                    <button onClick={saveMasterResume} disabled={isSaving || masterResume === savedContent}
                      className='rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50'>
                      {isSaving ? 'Saving…' : masterResume === savedContent ? 'Saved ✓' : 'Save to account'}
                    </button>
                    <button onClick={downloadDocx}
                      className='rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100'>
                      📥 Word
                    </button>
                    <button onClick={downloadPdf}
                      className='rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100'>
                      📥 PDF
                    </button>
                  </div>
                </div>
                {saveMessage && <p className='mb-3 text-xs text-slate-500'>{saveMessage}</p>}
                <pre className='max-h-[600px] overflow-y-auto whitespace-pre-wrap rounded-xl bg-slate-100 p-4 text-sm text-slate-800'>{masterResume}</pre>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
