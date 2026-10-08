'use client'

import { useEffect, useState } from 'react'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { downloadResumePdf as exportResumePdf, downloadResumeDocx as exportResumeDocx } from '../../lib/resumeLayout'
import { BrandedReportPdf } from '../../lib/reportPdf'
import { supabase } from '../../lib/supabase'
import { useJobLink } from '../../lib/useJobLink'
import { apiErrorMessage } from '../../lib/apiError'

type CareerAnalysis = {
  seniority_level: string
  years_experience: number
  core_strengths: string[]
  within_industry: { title: string; fit: string; why: string; salary_cad: string }[]
  outside_industry: { title: string; industry: string; fit: string; why: string; salary_cad: string }[]
  salary_benchmark: { role: string; location: string; range_cad: string; notes: string }
  career_advice: string
  status?: string
  questions?: string[]
  error?: string
}

const fitColor = (fit: string) =>
  fit === 'Strong' ? 'bg-green-100 text-green-700 border-green-200'
  : fit === 'Good' ? 'bg-blue-100 text-blue-700 border-blue-200'
  : 'bg-yellow-100 text-yellow-700 border-yellow-200'

export default function RecruiterTool() {
  const [isAdmin, setIsAdmin] = useState(false)
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setIsAdmin(data.user?.app_metadata?.role === 'admin')) }, [])
  const [candidateName, setCandidateName] = useState('')
  const [candidateLocation, setCandidateLocation] = useState('')
  const [targetRole, setTargetRole] = useState('')
  const [customInstructions, setCustomInstructions] = useState('')
  const [resume, setResume] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [targetRoleAuto, setTargetRoleAuto] = useState(false)
  const [resumeLength, setResumeLength] = useState(2)

  const [optimized, setOptimized] = useState('')
  const [feedback, setFeedback] = useState('')
  const [analysis, setAnalysis] = useState<CareerAnalysis | null>(null)
  const [activeTab, setActiveTab] = useState<'resume' | 'feedback' | 'career'>('resume')

  const [isLoading, setIsLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState('')
  const [uploadingResume, setUploadingResume] = useState(false)
  const [uploadingJD, setUploadingJD] = useState(false)
  const [error, setError] = useState('')

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token

    return token
      ? { Authorization: `Bearer ${token}` }
      : {}
  }


  const { jobLink, setJobLink, isFetchingJob, jobLinkError, fetchJobText } = useJobLink({ apiUrl: API_URL, authHeaders: getAuthHeaders, onSuccess: data => { setJobDescription(data.text); if (data.job_title && (!targetRole.trim() || targetRoleAuto)) { setTargetRole(data.job_title); setTargetRoleAuto(true) } } })

  const parseFile = async (file: File, setter: (t: string) => void, setUploading: (b: boolean) => void) => {
    setUploading(true); setError('')
    try {
      const fd = new FormData(); fd.append('file', file)
      const authHeaders = await getAuthHeaders()
      const res = await fetch(`${API_URL}/resumes/parse-demo`, {
        method: 'POST',
        headers: authHeaders,
        body: fd,
      })
      if (!res.ok) throw new Error('Failed to parse file')
      const data = await res.json()
      if (data.text) setter(data.text)
      else setError(typeof data.error === 'string' ? data.error : apiErrorMessage(data, 'Could not extract text'))
    } catch (err) { setError(err instanceof Error ? err.message : 'Upload failed') }
    finally { setUploading(false) }
  }

  const handleGenerate = async () => {
    if (!resume.trim() || !jobDescription.trim() || !candidateName.trim()) {
      setError('Please fill in candidate name, resume, and job description'); return
    }
    setIsLoading(true); setError('')
    setOptimized(''); setFeedback(''); setAnalysis(null)

    try {
      // Step 1: Optimize resume
      setLoadingStep('Optimizing resume with recruiter instructions...')
      const authHeaders = await getAuthHeaders()
      const r1 = await fetch(`${API_URL}/resumes/recruiter/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          resume_content: resume,
          job_description: jobDescription,
          candidate_name: candidateName,
          candidate_location: candidateLocation,
          target_role: targetRole,
          custom_instructions: customInstructions,
          length_pages: resumeLength,
        }),
      })
      const d1 = await r1.json()
      const optimizedContent = d1.optimized_content || ''
      setOptimized(optimizedContent)

      // Step 2: Generate feedback report
      setLoadingStep('Generating recruiter feedback report...')
      const r2 = await fetch(`${API_URL}/resumes/recruiter/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          original_resume: resume,
          optimized_resume: optimizedContent,
          job_description: jobDescription,
          candidate_name: candidateName,
          target_role: targetRole,
          custom_instructions: customInstructions,
        }),
      })
      const d2 = await r2.json()
      setFeedback(d2.feedback || '')

      // Step 3: Career analysis
      setLoadingStep('Analyzing career opportunities and salary benchmarks...')
      const r3 = await fetch(`${API_URL}/resumes/recruiter/career-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          resume_content: optimizedContent,
          candidate_name: candidateName,
          candidate_location: candidateLocation || 'Canada',
          target_role: targetRole,
        }),
      })
      const d3 = await r3.json()

      if (!r3.ok || d3.error) {
        throw new Error(d3.error || 'Career analysis failed')
      }

      setAnalysis({
        status: d3.status || 'partial',
        seniority_level: d3.seniority_level || 'Not specified',
        years_experience: d3.years_experience ?? 0,
        core_strengths: Array.isArray(d3.core_strengths) ? d3.core_strengths : [],
        within_industry: Array.isArray(d3.within_industry) ? d3.within_industry : [],
        outside_industry: Array.isArray(d3.outside_industry) ? d3.outside_industry : [],
        salary_benchmark: d3.salary_benchmark || {
          role: targetRole || 'Target role',
          location: candidateLocation || 'Canada',
          range_cad: 'Not available',
          notes: 'Insufficient information for a reliable benchmark.',
        },
        career_advice: d3.career_advice || 'Additional information is needed to provide more specific career guidance.',
        questions: Array.isArray(d3.questions) ? d3.questions : [],
      })

      setActiveTab('resume')

    } catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong') }
    finally { setIsLoading(false); setLoadingStep('') }
  }

  const downloadResumePdf = () => exportResumePdf(optimized, `${candidateName.replace(/\s+/g, '-')}-optimized`, null)
  const downloadResumeDocx = () => exportResumeDocx(optimized, `${candidateName.replace(/\s+/g, '-')}-optimized`, null)

  const feedbackFilename = () => { const role = (targetRole || 'recruiter-feedback').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); return `TalentSeek-recruiter-feedback-${role}-${new Date().toISOString().slice(0, 10)}.pdf` }
  const downloadFeedbackPdf = async () => {
    const report = await BrandedReportPdf.create({ title: 'Recruiter feedback report', preparedFor: [candidateName, targetRole].filter(Boolean).join(' · ') })
    let paragraphs: string[] = []
    const flush = () => { paragraphs.forEach(text => report.paragraph(text)); paragraphs = [] }
    feedback.split('\n').forEach(line => { const text = line.trim(); if (!text) { flush(); return } if (/^[A-Z][A-Z\s]{4,}$/.test(text)) { flush(); report.section(text) } else if (text.startsWith('- ')) { flush(); report.bullets([text.slice(2)]) } else paragraphs.push(text) })
    flush(); report.save(feedbackFilename())
  }


  const careerFilename = (extension: string) => { const role = (targetRole || 'career-analysis').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); return `TalentSeek-career-analysis-${role}-${new Date().toISOString().slice(0, 10)}.${extension}` }
  const careerSections = () => { if (!analysis) return []; return [
    ['Career profile', [`Seniority: ${analysis.seniority_level}`, `Years of experience: ${analysis.years_experience}`]],
    ['Core strengths', analysis.core_strengths],
    ['Roles within the industry', analysis.within_industry.map(role => `${role.title} · Fit: ${role.fit} · Salary range: ${role.salary_cad}\n${role.why}`)],
    ['Roles outside the industry', analysis.outside_industry.map(role => `${role.title} · ${role.industry} · Fit: ${role.fit} · Salary range: ${role.salary_cad}\n${role.why}`)],
    ['Salary benchmark', [`Role: ${analysis.salary_benchmark.role}`, `Location: ${analysis.salary_benchmark.location}`, `Salary range: ${analysis.salary_benchmark.range_cad}`, analysis.salary_benchmark.notes]],
    ['Career advice', [analysis.career_advice]],
  ] as Array<[string, string[]]> }
  const downloadCareerPdf = async () => { if (!analysis) return; const report = await BrandedReportPdf.create({ title: 'Career analysis', jobTitle: `${candidateName} · ${targetRole}`, disclaimerLines: ['Salary figures are AI estimates for guidance only, not offers or guarantees.'] }); careerSections().forEach(([title, items]) => { report.section(title); report.bullets(items) }); report.save(careerFilename('pdf')) }


  return (
    <main className='min-h-screen bg-slate-50 px-6 py-10'>
      <div className='mx-auto max-w-7xl'>
        <div className='mb-8 flex items-center justify-between'>
          <div>
            <p className='text-xs font-medium uppercase tracking-widest text-slate-400'>TalentSeek</p>
            <h1 className='text-3xl font-bold text-slate-900'>Recruiter Console</h1>
            <p className='mt-1 text-sm text-slate-500'>Resume Consultation · Career Analysis · Feedback Reports</p>
          </div>
          <div className='flex gap-2'><a href='/recruiter/requests' className='rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700'>Candidate requests</a><a href={isAdmin ? '/admin/dashboard' : '/recruiter/dashboard'} className='rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100'>← {isAdmin ? 'Admin home' : 'Recruiter home'}</a></div>
        </div>

        <div className='grid gap-8 lg:grid-cols-5'>
          {/* LEFT INPUT PANEL — 2 cols */}
          <section className='lg:col-span-2 rounded-2xl bg-white p-6 shadow-sm'>
            <h2 className='mb-4 text-lg font-semibold text-slate-900'>Candidate Details</h2>

            <div className='mb-3'>
              <label className='mb-1 block text-xs font-medium text-slate-600'>Candidate Name *</label>
              <input value={candidateName} onChange={e => setCandidateName(e.target.value)}
                placeholder='e.g. John Smith'
                className='w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-500 shadow-sm' />
            </div>

            <div className='mb-3'>
              <label className='mb-1 block text-xs font-medium text-slate-600'>Location</label>
              <input value={candidateLocation} onChange={e => setCandidateLocation(e.target.value)}
                placeholder='e.g. Vancouver, BC'
                className='w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-500 shadow-sm' />
            </div>

            <div className='mb-4'>
              <label className='mb-1 block text-xs font-medium text-slate-600'>Target Role</label>
              <input value={targetRole} onChange={e => { setTargetRoleAuto(false); setTargetRole(e.target.value) }}
                placeholder='e.g. Senior Manager, Credit Risk'
                className='w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-500 shadow-sm' />
            </div>

            <h2 className='mb-3 text-lg font-semibold text-slate-900'>Resume</h2>
            <label className='mb-3 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 hover:border-slate-400'>
              <input type='file' accept='.pdf,.docx' className='hidden'
                onChange={e => { const f = e.target.files?.[0]; if (f) parseFile(f, setResume, setUploadingResume); e.target.value = '' }}
                disabled={uploadingResume} />
              {uploadingResume ? '⏳ Extracting text...' : resume ? '✅ Resume uploaded — click to replace' : '📎 Upload PDF or Word'}
            </label>
            <textarea value={resume} onChange={e => setResume(e.target.value)}
              placeholder='Or paste resume here...'
              className='mb-4 min-h-[120px] w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-500 shadow-sm' />

            <h2 className='mb-3 text-lg font-semibold text-slate-900'>Job Description</h2>
            <div className='mb-3 flex gap-2'><input value={jobLink} onChange={e => setJobLink(e.target.value)} placeholder='Paste a job link' className='min-w-0 flex-1 rounded-xl border border-slate-200 p-2 text-sm text-slate-900' /><button type='button' disabled={isFetchingJob} onClick={() => void fetchJobText()} className='rounded-xl border border-slate-300 px-3 text-xs font-medium text-slate-700'>{isFetchingJob ? 'Getting…' : 'Get job text'}</button></div>{jobLinkError && <p className='mb-2 text-xs text-red-700'>{jobLinkError}</p>}
            <label className='mb-3 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 hover:border-slate-400'>
              <input type='file' accept='.pdf,.docx' className='hidden'
                onChange={e => { const f = e.target.files?.[0]; if (f) parseFile(f, setJobDescription, setUploadingJD); e.target.value = '' }}
                disabled={uploadingJD} />
              {uploadingJD ? '⏳ Extracting text...' : jobDescription ? '✅ JD uploaded — click to replace' : '📎 Upload PDF or Word'}
            </label>
            <textarea value={jobDescription} onChange={e => setJobDescription(e.target.value)}
              placeholder='Or paste job description here...'
              className='mb-4 min-h-[100px] w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-500 shadow-sm' />

            <div className='mb-4'>
              <label className='mb-2 block text-xs font-medium text-slate-600'>Recruiter Instructions</label>
              <textarea value={customInstructions} onChange={e => setCustomInstructions(e.target.value)}
                placeholder='e.g. Emphasize leadership experience. Candidate is targeting VP roles. Downplay the 6-month gap in 2022. Focus on Canadian banking experience.'
                className='min-h-[100px] w-full rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus:border-amber-400 shadow-sm' />
              <p className='mt-1 text-xs text-slate-400'>These instructions guide the AI and appear in the feedback report</p>
            </div>

            <div className='mb-5'>
              <label className='mb-2 block text-xs font-medium text-slate-600'>Resume Length</label>
              <div className='flex gap-2'>
                {[[1,'1 Page'],[2,'2 Pages'],[3,'Detailed']].map(([val, label]) => (
                  <button key={val} onClick={() => setResumeLength(Number(val))}
                    className={`flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                      resumeLength === val ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                    }`}>{label}</button>
                ))}
              </div>
            </div>

            <button onClick={handleGenerate} disabled={isLoading}
              className='w-full rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50'>
              {isLoading ? 'Generating Full Report...' : '✨ Generate Full Report'}
            </button>

            {error && <div className='mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700'>{error}</div>}
          </section>

          {/* RIGHT OUTPUT PANEL — 3 cols */}
          <section className='lg:col-span-3 rounded-2xl bg-white shadow-sm'>
            {!optimized && !isLoading && (
              <div className='flex h-full flex-col items-center justify-center p-12 text-center text-slate-400'>
                <p className='text-5xl mb-4'>📋</p>
                <p className='text-lg font-medium text-slate-600'>Fill in the candidate details and click Generate Full Report</p>
                <p className='mt-2 text-sm'>Three outputs will be generated: optimized resume, recruiter feedback report, and career analysis</p>
              </div>
            )}

            {isLoading && (
              <div className='flex h-full flex-col items-center justify-center gap-4 p-12'>
                <LoadingSpinner />
                <p className='text-sm font-medium text-slate-700'>{loadingStep}</p>
                <p className='text-xs text-slate-400'>World-leading AI is building the full candidate report...</p>
                <p className='text-xs text-slate-400'>This takes 30-60 seconds</p>
              </div>
            )}

            {optimized && !isLoading && (
              <div className='flex h-full flex-col'>
                {/* Tabs */}
                <div className='flex border-b border-slate-200'>
                  {([
                    ['resume', '📄 Optimized Resume'],
                    ['feedback', '📝 Recruiter Feedback'],
                    ['career', '🎯 Career Analysis'],
                  ] as const).map(([tab, label]) => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                      className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                        activeTab === tab ? 'border-b-2 border-slate-900 text-slate-900' : 'text-slate-500 hover:text-slate-700'
                      }`}>{label}</button>
                  ))}
                </div>

                <div className='flex-1 overflow-y-auto p-6'>
                  {activeTab === 'resume' && (
                    <div>
                      <div className='mb-4 flex items-center justify-between'>
                        <h3 className='font-semibold text-slate-800'>Optimized Resume</h3>
                        <div className='flex gap-2'>
                          <button onClick={downloadResumeDocx}
                            className='rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100'>
                            📥 Word
                          </button>
                          <button onClick={downloadResumePdf}
                            className='rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100'>
                            📥 PDF
                          </button>
                        </div>
                      </div>
                      <pre className='whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm text-slate-800 leading-relaxed'>{optimized}</pre>
                    </div>
                  )}

                  {activeTab === 'feedback' && (
                    <div>
                      <div className='mb-4 flex items-center justify-between'>
                        <h3 className='font-semibold text-slate-800'>Recruiter Feedback Report</h3>
                        <button onClick={() => void downloadFeedbackPdf()}
                          className='rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100'>
                          📥 Download PDF
                        </button>
                      </div>
                      <pre className='whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm text-slate-800 leading-relaxed'>{feedback}</pre>
                    </div>
                  )}

                  {activeTab === 'career' && analysis && !analysis.error && (
                    <div className='space-y-6'>
                      <div className='flex flex-wrap gap-2'><button onClick={() => void downloadCareerPdf()} className='rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100'>Download PDF</button></div>
                      {/* Header */}
                      <div className='rounded-xl bg-slate-900 p-4 text-white'>
                        <div className='flex items-start justify-between'>
                          <div>
                            <p className='text-xs uppercase tracking-widest text-slate-400'>Career Profile</p>
                            <p className='mt-1 text-xl font-bold'>{candidateName}</p>
                            <p className='text-sm text-slate-300'>{analysis.seniority_level} · {analysis.years_experience} years experience</p>
                          </div>
                          <div className='text-right'>
                            <p className='text-xs text-slate-400'>Location</p>
                            <p className='text-sm font-medium'>{candidateLocation || 'Canada'}</p>
                          </div>
                        </div>
                        <div className='mt-3 flex flex-wrap gap-2'>
                          {analysis.core_strengths.map((s, i) => (
                            <span key={i} className='rounded-full bg-slate-700 px-3 py-1 text-xs text-slate-200'>{s}</span>
                          ))}
                        </div>
                      </div>

                      {/* Salary benchmark */}
                      <div className='rounded-xl border border-green-200 bg-green-50 p-4'>
                        <h4 className='mb-2 text-sm font-semibold text-green-800'>💰 Salary Benchmark — {analysis.salary_benchmark.role}</h4>
                        <p className='text-2xl font-bold text-green-700'>{analysis.salary_benchmark.range_cad}</p>
                        <p className='mt-1 text-xs text-green-600'>{analysis.salary_benchmark.location} · {analysis.salary_benchmark.notes}</p>
                      </div>

                      {/* Within industry */}
                      <div>
                        <h4 className='mb-3 text-sm font-semibold text-slate-800'>🎯 Within Industry — Recommended Roles</h4>
                        <div className='space-y-2'>
                          {analysis.within_industry.map((role, i) => (
                            <div key={i} className='rounded-xl border border-slate-200 bg-white p-3'>
                              <div className='flex items-start justify-between gap-2'>
                                <div className='flex-1'>
                                  <p className='text-sm font-semibold text-slate-800'>{role.title}</p>
                                  <p className='mt-0.5 text-xs text-slate-500'>{role.why}</p>
                                </div>
                                <div className='text-right shrink-0'>
                                  <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${fitColor(role.fit)}`}>{role.fit}</span>
                                  <p className='mt-1 text-xs font-medium text-slate-600'>{role.salary_cad}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Outside industry */}
                      <div>
                        <h4 className='mb-3 text-sm font-semibold text-slate-800'>🔀 Outside Industry — Transferable Roles</h4>
                        <div className='space-y-2'>
                          {analysis.outside_industry.map((role, i) => (
                            <div key={i} className='rounded-xl border border-slate-200 bg-white p-3'>
                              <div className='flex items-start justify-between gap-2'>
                                <div className='flex-1'>
                                  <p className='text-sm font-semibold text-slate-800'>{role.title}</p>
                                  <p className='text-xs text-slate-400'>{role.industry}</p>
                                  <p className='mt-0.5 text-xs text-slate-500'>{role.why}</p>
                                </div>
                                <div className='text-right shrink-0'>
                                  <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${fitColor(role.fit)}`}>{role.fit}</span>
                                  <p className='mt-1 text-xs font-medium text-slate-600'>{role.salary_cad}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Career advice */}
                      <div className='rounded-xl border border-blue-200 bg-blue-50 p-4'>
                        <h4 className='mb-2 text-sm font-semibold text-blue-800'>💡 Career Strategy Advice</h4>
                        <p className='text-sm text-blue-700'>{analysis.career_advice}</p>
                      </div>

                      {analysis.questions && analysis.questions.length > 0 && (
                        <div className='rounded-xl border border-amber-200 bg-amber-50 p-4'>
                          <h4 className='mb-2 text-sm font-semibold text-amber-900'>
                            More Information That Would Improve This Analysis
                          </h4>
                          <p className='mb-3 text-sm text-amber-800'>
                            The analysis above is based on the information currently available. These details would help refine it further:
                          </p>
                          <ul className='list-disc space-y-2 pl-5 text-sm text-amber-800'>
                            {analysis.questions.map((q, i) => (
                              <li key={i}>{q}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
