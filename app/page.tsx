'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { errorDetail, outOfCreditsMessage } from '../lib/credits'
import { runAiJob } from '../lib/aiJobs'
import { LoadingSpinner } from './components/LoadingSpinner'
import { AiProcessingNotice } from './components/AiProcessingNotice'
import { downloadResumeDocx, downloadResumePdf } from '../lib/resumeLayout'
import { downloadJobMatchReport, downloadProfileReport } from '../lib/reportPdf'

const RETRY_ADVICE = 'Please try again, or try a different file.'

function withRetryAdvice(message: string): string {
  return message.includes(RETRY_ADVICE) ? message : `${message.trim().replace(/[.\s]+$/, '')}. ${RETRY_ADVICE}`
}

function getInitials(name: string): string {
  return name.trim().split(/\s+/).map(w => w[0]?.toUpperCase() || '').join('')
}

function parseJobInfo(jd: string): { title: string; company: string } {
  const lines = jd.split('\n').map(l => l.trim()).filter(Boolean)
  const useful = lines.filter(line => line.length <= 80 && !/(apply|save|back to jobs|\$|€|£|¥|currency)/i.test(line))
  const atPattern = useful.map(line => line.match(/^(.{2,70}?)\s+at\s+(.{2,70}?)$/i)).find(Boolean)
  const companyPattern = useful.map(line => line.match(/^company\s*:\s*(.{2,70})$/i)).find(Boolean)
  const title = atPattern?.[1].trim() || useful.find(line => !/^company\s*:/i.test(line)) || 'Role'
  const company = atPattern?.[2].trim() || companyPattern?.[1].trim() || 'Company'
  return { title, company }
}

function buildFilename(resumeText: string, jdText: string, role = '', company = ''): string {
  const nameMatch = resumeText.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/m)
  const name = nameMatch?.[1] || 'Resume'
  const initials = getInitials(name)
  const parsed = parseJobInfo(jdText)
  const titleAbbr = (role || parsed.title).split(/\s+/).map(w => w[0]?.toUpperCase() || '').join('')
  const companyClean = (company || parsed.company).replace(/\s+/g, '')
  return `${initials}-${titleAbbr}-${companyClean}`
}

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'role'
}

type AnalysisResult = {
  match_rate: number
  industry_score: number
  experience_score: number
  skills_score: number
  competency_score: number
  industry_weight: number
  experience_weight: number
  skills_weight: number
  competency_weight: number
  strong_matches: string[]
  moderate_matches: string[]
  gaps: string[]
  error?: string
}

export default function CandidateTool() {
  const [resume, setResume] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [jobLink, setJobLink] = useState('')
  const [isFetchingJob, setIsFetchingJob] = useState(false)
  const [jobLinkError, setJobLinkError] = useState('')
  const [role, setRole] = useState('')
  const [company, setCompany] = useState('')
  const [optimizedResume, setOptimizedResume] = useState('')
  const [profileImprovements, setProfileImprovements] = useState('')
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const [needsCredits, setNeedsCredits] = useState(false)
  const [uploadingResume, setUploadingResume] = useState(false)
  const [uploadingJD, setUploadingJD] = useState(false)
  const [resumeLength, setResumeLength] = useState('2')
  const [savedResumes, setSavedResumes] = useState<{ key: string; label: string; content: string }[]>([])
  const [resumeSource, setResumeSource] = useState('')
  // The length chosen for the result on screen (the buttons may change afterwards).
  const [optimizedLength, setOptimizedLength] = useState(2)
  const [isSavingOptimized, setIsSavingOptimized] = useState(false)
  const [optimizedSaveMessage, setOptimizedSaveMessage] = useState('')
  const [optimizedSaved, setOptimizedSaved] = useState(false)

  const [user, setUser] = useState<any>(null)
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const storedJobDescription = sessionStorage.getItem('talentseek-job-description')
    if (storedJobDescription) {
      setJobDescription(storedJobDescription)
      sessionStorage.removeItem('talentseek-job-description')
    }
    // Saved master and optimized resumes for the "Use a saved resume" picker (same as interview prep).
    void (async () => {
      try {
        const headers = await getAuthHeaders()
        const [masterResponse, optimizedResponse] = await Promise.all([
          fetch(`${API_URL}/resume-library/master`, { headers }),
          fetch(`${API_URL}/resume-library/optimized`, { headers }),
        ])
        const master = masterResponse.ok ? await masterResponse.json() : null
        const optimized: { id: string; title: string; content: string }[] = optimizedResponse.ok ? await optimizedResponse.json() : []
        setSavedResumes([
          ...(master?.content ? [{ key: 'master', label: 'Master resume', content: master.content }] : []),
          ...optimized.map(item => ({ key: item.id, label: item.title, content: item.content })),
        ])
      } catch { /* the picker simply stays hidden */ }
    })()
  }, [])

  useEffect(() => {
    if (!jobDescription.trim()) return
    const guessed = parseJobInfo(jobDescription)
    if (!role.trim() && guessed.title !== 'Role') setRole(guessed.title)
    if (!company.trim() && guessed.company !== 'Company') setCompany(guessed.company)
  }, [jobDescription, role, company])

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token

    return token
      ? { Authorization: `Bearer ${token}` }
      : {}
  }

  const parseFile = async (file: File, setter: (t: string) => void, setUploading: (b: boolean) => void) => {
    setUploading(true); setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const authHeaders = await getAuthHeaders()
      const res = await fetch(`${API_URL}/resumes/parse-demo`, {
        method: 'POST',
        headers: authHeaders,
        body: formData,
      })
      if (!res.ok) throw new Error('Failed to parse file')
      const data = await res.json()
      if (data.text) { setter(data.text) } else { setError(withRetryAdvice(data.error || 'Could not extract text')) }
    } catch (err) { setError(withRetryAdvice(err instanceof Error ? err.message : 'Upload failed')) }
    finally { setUploading(false) }
  }

  const fetchJobText = async () => {
    if (!jobLink.trim()) { setJobLinkError('Paste a job link first.'); return }
    setIsFetchingJob(true); setJobLinkError(''); setError('')
    try {
      const response = await fetch(`${API_URL}/resumes/fetch-job`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...await getAuthHeaders() },
        body: JSON.stringify({ url: jobLink.trim() }),
      })
      const data = await response.json()
      if (!response.ok || !data.text) throw new Error(data.error || 'We could not read that job page. Please paste the description instead.')
      setJobDescription(data.text)
      if (!role.trim() && data.job_title) setRole(data.job_title)
      if (!company.trim() && data.company_name) setCompany(data.company_name)
    } catch (fetchError) {
      setJobLinkError(fetchError instanceof Error ? fetchError.message : 'We could not read that job page. Please paste the description instead.')
    } finally { setIsFetchingJob(false) }
  }

  const handleResumeFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (file) { setResumeSource(''); parseFile(file, setResume, setUploadingResume) }
  }
  const handleJDFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (file) parseFile(file, setJobDescription, setUploadingJD)
  }

  const handleOptimize = async () => {
    if (!resume.trim() || !jobDescription.trim()) { setError('Please fill in both fields'); return }
    setIsLoading(true); setError(''); setNeedsCredits(false); setOptimizedResume(''); setProfileImprovements(''); setAnalysis(null)
    setOptimizedSaved(false); setOptimizedSaveMessage('')
    try {
      const authHeaders = await getAuthHeaders()
      const outcome = await runAiJob<{ optimized_content?: string; profile_improvements?: string }>(
        API_URL, '/resumes/optimize-demo/jobs',
        { content: resume, job_description: jobDescription, length_pages: Number(resumeLength) },
        authHeaders,
      )
      if (!outcome.ok) {
        const creditMessage = outOfCreditsMessage(outcome.status, outcome.body)
        if (creditMessage) { setNeedsCredits(true); throw Object.assign(new Error(creditMessage), { noRetryAdvice: true }) }
        throw new Error(errorDetail(outcome.body, 'Optimization failed'))
      }
      const data = outcome.result
      setOptimizedResume(data.optimized_content || '')
      setOptimizedLength(Number(resumeLength))
      setProfileImprovements(data.profile_improvements || '')
      // Save automatically: the user spent a credit on this result and may leave the page.
      if (data.optimized_content && role.trim() && company.trim()) void saveOptimizedResume(data.optimized_content)

      setIsAnalyzing(true)
      try {
        const authHeaders = await getAuthHeaders()
        const aRes = await fetch(`${API_URL}/resumes/analyze-demo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ resume_content: data.optimized_content, job_description: jobDescription }),
        })
        if (aRes.ok) setAnalysis(await aRes.json())
      } catch (_) {}
      finally { setIsAnalyzing(false) }

    } catch (err) { setError(err instanceof Error && (err as Error & { noRetryAdvice?: boolean }).noRetryAdvice ? err.message : withRetryAdvice(err instanceof Error ? err.message : 'Something went wrong')) }
    finally { setIsLoading(false) }
  }

  const saveOptimizedResume = async (content: string = optimizedResume) => {
    if (!content.trim()) return
    if (!role.trim() || !company.trim()) {
      setOptimizedSaveMessage('Add the Role and Company before saving this resume.')
      return
    }
    setIsSavingOptimized(true); setOptimizedSaveMessage('')
    try {
      const response = await fetch(`${API_URL}/resume-library/optimized`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...await getAuthHeaders() },
        body: JSON.stringify({ title: `${role.trim()} – ${company.trim()}`, content, job_title: role.trim(), company_name: company.trim() }),
      })
      if (!response.ok) throw new Error(withRetryAdvice('This resume was not saved to your account.'))
      setOptimizedSaved(true)
      setOptimizedSaveMessage('Saved to My Resumes. You can open it any time from your dashboard.')
    } catch (saveError) { setOptimizedSaveMessage(withRetryAdvice(saveError instanceof Error ? saveError.message : 'This resume was not saved to your account.')) }
    setIsSavingOptimized(false)
  }

  // '3' means "Detailed": no page limit, only avoid a nearly empty last page.
  const targetPages = () => (optimizedLength >= 3 ? null : optimizedLength)

  const downloadDocx = async () => {
    await downloadResumeDocx(optimizedResume, buildFilename(optimizedResume, jobDescription, role, company), targetPages())
  }

  const reportDate = () => new Date().toISOString().slice(0, 10)

  const reportMeta = () => ({ jobTitle: role.trim() || undefined, company: company.trim() || undefined })

  const downloadProfileImprovements = async () => {
    if (!profileImprovements.trim()) return
    await downloadProfileReport({ title: 'Profile improvement report', ...reportMeta() }, profileImprovements, `TalentSeek-profile-report-${slugify(role)}-${slugify(company)}-${reportDate()}.pdf`)
  }

  const downloadAnalysisPdf = async () => {
    if (!analysis || analysis.error) return
    await downloadJobMatchReport(
      { title: 'Job match analysis', ...reportMeta() },
      analysis.match_rate,
      [
        { label: 'Industry', score: analysis.industry_score },
        { label: 'Experience', score: analysis.experience_score },
        { label: 'Skills', score: analysis.skills_score },
        { label: 'Competencies', score: analysis.competency_score },
      ],
      [
        { title: 'Strong matches', items: analysis.strong_matches },
        { title: 'Moderate matches', items: analysis.moderate_matches },
        { title: 'Gaps to address', items: analysis.gaps },
      ],
      `TalentSeek-job-match-${slugify(role)}-${slugify(company)}-${reportDate()}.pdf`,
    )
  }

  const downloadPdf = () => {
    downloadResumePdf(optimizedResume, buildFilename(optimizedResume, jobDescription, role, company), targetPages())
  }

  const getMatchColor = (score: number) =>
    score >= 80 ? 'text-green-700 bg-green-50 border-green-200'
    : score >= 60 ? 'text-yellow-700 bg-yellow-50 border-yellow-200'
    : 'text-red-700 bg-red-50 border-red-200'

  const getMatchLabel = (score: number) =>
    score >= 80 ? 'Strong Match' : score >= 60 ? 'Good Match' : score >= 40 ? 'Partial Match' : 'Weak Match'

  return (
    <main className='min-h-screen bg-slate-50 px-6 py-10'>
      <div className='mx-auto max-w-6xl'>
        <div className='mb-10 text-center'>
          <h1 className='text-4xl font-bold text-slate-900'>TalentSeek</h1>
          <p className='mt-3 text-slate-600'>AI Resume Optimization Tool</p>
          <div className='mt-2 flex items-center justify-center gap-4 text-xs text-slate-400'>
            {user && <span>{user.email}</span>}
          </div>
          <a href={user?.app_metadata?.role === 'admin' ? '/admin/dashboard' : user?.app_metadata?.role === 'recruiter' ? '/recruiter/dashboard' : '/dashboard'} className='mt-3 inline-block rounded-lg border border-slate-300 px-4 py-1.5 text-sm text-slate-600 hover:border-slate-500 hover:text-slate-900'>
            ← {user?.app_metadata?.role === 'admin' ? 'Admin Home' : user?.app_metadata?.role === 'recruiter' ? 'Recruiter Home' : 'What would you like to do today?'}
          </a>
          <a href='/master-resume' className='mt-3 ml-3 inline-block rounded-lg border border-slate-300 px-4 py-1.5 text-sm text-slate-600 hover:border-slate-500 hover:text-slate-900'>
            📋 Build Master Resume
          </a>
        </div>

        <div className='grid gap-8 lg:grid-cols-2'>
          <section className='rounded-2xl bg-white p-6 shadow-sm'>
            <div className='mb-3 flex flex-wrap items-center justify-between gap-2'>
              <h2 className='text-xl font-semibold text-slate-900'>Your Resume</h2>
              {savedResumes.length > 0 && (
                <select value='' aria-label='Use a saved resume'
                  onChange={(e) => { const saved = savedResumes.find(item => item.key === e.target.value); if (saved) { setResume(saved.content); setResumeSource(saved.label) } }}
                  className='rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700'>
                  <option value=''>Use a saved resume…</option>
                  {savedResumes.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
                </select>
              )}
            </div>
            <label className='mb-3 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 hover:border-slate-400'>
              <input type='file' accept='.pdf,.docx' className='hidden' onChange={handleResumeFile} disabled={uploadingResume} />
              {uploadingResume ? 'Extracting...' : '📎 Upload PDF or Word'}
            </label>
            {resumeSource && resume && <p className='mb-2 text-xs text-teal-700'>Using: {resumeSource}</p>}
            <textarea value={resume} onChange={(e) => { setResume(e.target.value); if (!e.target.value) setResumeSource('') }}
              placeholder='Or paste your resume here, or choose a saved resume above...'
              className='min-h-[160px] w-full rounded-xl border border-slate-300 p-4 text-sm text-slate-900 outline-none focus:border-slate-500' />
            <AiProcessingNotice />

            <h2 className='mb-3 mt-5 text-xl font-semibold text-slate-900'>Job Description</h2>
            <div className='mb-3 flex flex-col gap-2 sm:flex-row'>
              <input value={jobLink} onChange={(e) => setJobLink(e.target.value)} type='url' placeholder='Paste a job link' aria-label='Job link'
                className='min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500' />
              <button type='button' onClick={() => void fetchJobText()} disabled={isFetchingJob}
                className='rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-50'>
                {isFetchingJob ? 'Getting text…' : 'Get job text'}
              </button>
            </div>
            {jobLinkError && <p className='mb-3 text-sm text-red-700'>{jobLinkError}</p>}
            <label className='mb-3 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 hover:border-slate-400'>
              <input type='file' accept='.pdf,.docx' className='hidden' onChange={handleJDFile} disabled={uploadingJD} />
              {uploadingJD ? 'Extracting...' : '📎 Upload PDF or Word'}
            </label>
            <textarea value={jobDescription} onChange={(e) => setJobDescription(e.target.value)}
              placeholder='Or paste the job description here...'
              className='min-h-[130px] w-full rounded-xl border border-slate-300 p-4 text-sm text-slate-900 outline-none focus:border-slate-500' />

            <div className='mt-5 grid gap-4 sm:grid-cols-2'>
              <label className='text-sm font-medium text-slate-700'>Role <span className='text-slate-400'>(required to save)</span>
                <input value={role} onChange={(e) => setRole(e.target.value)} placeholder='e.g. Product Manager'
                  className='mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500' />
              </label>
              <label className='text-sm font-medium text-slate-700'>Company <span className='text-slate-400'>(required to save)</span>
                <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder='Company name'
                  className='mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500' />
              </label>
            </div>

            <div className='mt-5'>
              <label className='mb-2 block text-sm font-medium text-slate-700'>Resume Length</label>
              <div className='flex gap-2'>
                {[['1', '1 Page'], ['2', '2 Pages'], ['3', 'Detailed']].map(([val, label]) => (
                  <button key={val} onClick={() => setResumeLength(val)}
                    className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                      resumeLength === val
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className='mt-5'>
              <button onClick={handleOptimize} disabled={isLoading}
                className='w-full rounded-xl bg-slate-900 px-5 py-3 text-white disabled:opacity-50'>
                {isLoading ? 'Working...' : '✨ Optimize Resume'}
              </button>
            </div>
            {error && <div className='mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700'>{error}{needsCredits && <a href='/billing' className='ml-2 font-semibold underline'>View plans →</a>}</div>}
          </section>

          <section className='rounded-2xl bg-white p-6 shadow-sm'>
            <h2 className='mb-4 text-xl font-semibold text-slate-900'>Results</h2>

            {!optimizedResume && !isLoading && (
              <div className='rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500'>
                Upload your resume and job description, then click Optimize Resume.
              </div>
            )}

            {isLoading && (
              <div className='flex flex-col items-center gap-3 py-12'>
                <LoadingSpinner />
                <p className='text-sm text-slate-500'>World-leading AI is tailoring your resume for this role...</p>
              </div>
            )}

            {optimizedResume && (
              <div className='space-y-5'>
                <div>
                  <div className='mb-3 flex items-center justify-between'>
                    <h3 className='font-semibold text-slate-800'>Optimized Resume</h3>
                    <div className='flex gap-2'>
                      <button onClick={() => void saveOptimizedResume()} disabled={isSavingOptimized || optimizedSaved || !role.trim() || !company.trim()}
                        className='rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-60'>
                        {isSavingOptimized ? 'Saving…' : optimizedSaved ? 'Saved ✓' : 'Save to account'}
                      </button>
                      <button onClick={downloadDocx}
                        className='rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100'>
                        📥 Word (.docx)
                      </button>
                      <button onClick={downloadPdf}
                        className='rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100'>
                        📥 PDF
                      </button>
                    </div>
                  </div>
                  {optimizedSaveMessage && <p className={`mb-3 rounded-xl p-3 text-sm ${optimizedSaved ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>{optimizedSaved && '✓ '}{optimizedSaveMessage}{optimizedSaved && <> <a href='/my-resumes' className='font-semibold underline'>Open My Resumes</a></>}</p>}
                  <pre className='max-h-56 overflow-y-auto whitespace-pre-wrap rounded-xl bg-slate-100 p-4 text-sm text-slate-800'>{optimizedResume}</pre>
                </div>

                {profileImprovements && (
                  <div className='rounded-xl border border-amber-200 bg-amber-50 p-4'>
                    <div className='mb-3 flex items-center justify-between gap-3'>
                      <div>
                        <h3 className='font-semibold text-amber-900'>Profile Improvement Report</h3>
                        <p className='mt-1 text-xs text-amber-700'>
                          Missing information, gaps, and optional profile improvements are kept separate from your resume.
                        </p>
                      </div>
                      <button
                        onClick={downloadProfileImprovements}
                        className='shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100'
                      >
                        📥 Download Report (PDF)
                      </button>
                    </div>
                    <pre className='max-h-56 overflow-y-auto whitespace-pre-wrap text-sm text-amber-900'>
                      {profileImprovements}
                    </pre>
                  </div>
                )}

                {isAnalyzing && (
                  <div className='flex items-center gap-2 text-sm text-slate-500'>
                    <LoadingSpinner />
                    <span>Analyzing job match...</span>
                  </div>
                )}

                {analysis && !analysis.error && (
                  <div className='space-y-3'>
                    <div className='flex flex-wrap items-center justify-between gap-3'><h3 className='font-semibold text-slate-800'>Job Match Analysis</h3><button type='button' onClick={() => void downloadAnalysisPdf()} className='rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100'>📥 Download analysis (PDF)</button></div>

                    <div className={`rounded-xl border p-4 ${getMatchColor(analysis.match_rate)}`}>
                      <div className='flex items-start justify-between'>
                        <div>
                          <p className='text-xs font-medium uppercase tracking-wide opacity-70'>Overall Match Rate</p>
                          <p className='text-4xl font-bold leading-tight'>{analysis.match_rate}%</p>
                          <p className='text-sm font-semibold'>{getMatchLabel(analysis.match_rate)}</p>
                        </div>
                        <div className='text-right space-y-1 text-xs opacity-80'>
                          <p>Industry <span className='font-bold'>{analysis.industry_score}%</span> <span className='opacity-60'>×{analysis.industry_weight}</span></p>
                          <p>Experience <span className='font-bold'>{analysis.experience_score}%</span> <span className='opacity-60'>×{analysis.experience_weight}</span></p>
                          <p>Skills <span className='font-bold'>{analysis.skills_score}%</span> <span className='opacity-60'>×{analysis.skills_weight}</span></p>
                          <p>Competencies <span className='font-bold'>{analysis.competency_score}%</span> <span className='opacity-60'>×{analysis.competency_weight}</span></p>
                        </div>
                      </div>
                      <div className='mt-3 h-2 w-full rounded-full bg-black/10'>
                        <div className='h-2 rounded-full bg-current' style={{ width: `${analysis.match_rate}%` }} />
                      </div>
                    </div>

                    <div className='rounded-xl border border-green-200 bg-green-50 p-4'>
                      <h4 className='mb-2 text-sm font-semibold text-green-800'>✅ Strong Matches</h4>
                      <ul className='space-y-1'>
                        {analysis.strong_matches.map((item, i) => (
                          <li key={i} className='text-sm text-green-700'>• {item}</li>
                        ))}
                      </ul>
                    </div>

                    <div className='rounded-xl border border-yellow-200 bg-yellow-50 p-4'>
                      <h4 className='mb-2 text-sm font-semibold text-yellow-800'>⚡ Moderate Matches</h4>
                      <ul className='space-y-1'>
                        {analysis.moderate_matches.map((item, i) => (
                          <li key={i} className='text-sm text-yellow-700'>• {item}</li>
                        ))}
                      </ul>
                    </div>

                    <div className='rounded-xl border border-red-200 bg-red-50 p-4'>
                      <h4 className='mb-2 text-sm font-semibold text-red-800'>⚠️ Gaps to Address</h4>
                      <ul className='space-y-1'>
                        {analysis.gaps.map((item, i) => (
                          <li key={i} className='text-sm text-red-700'>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
