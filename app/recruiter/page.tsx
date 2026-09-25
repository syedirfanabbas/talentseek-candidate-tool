'use client'

import { useState } from 'react'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { Document, Packer, Paragraph, TextRun, BorderStyle } from 'docx'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'
import { supabase } from '../../lib/supabase'

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

function classifyLine(line: string, idx: number, lines: string[]) {
  const t = line.trim()
  if (!t) return { type: 'empty', text: '' }
  const first = lines.findIndex(l => l.trim())
  if (idx === first) return { type: 'name', text: t }
  let c = 0
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim()) { c++; if (c === 2 && i === idx) return { type: 'contact', text: t } }
  }
  if (/^[A-Z][A-Z\s&/()]{3,}$/.test(t)) return { type: 'section', text: t }
  if (t.startsWith('- ')) return { type: 'bullet', text: t.slice(2).trim() }
  if ((t.match(/\|/g) || []).length >= 2) return { type: 'skills', text: t }
  if (/\d{4}/.test(t) && t.length < 40) return { type: 'date', text: t }
  return { type: 'text', text: t }
}

function buildDocx(resumeText: string): Paragraph[] {
  const lines = resumeText.split('\n')
  return lines.map((line, i) => {
    const { type, text } = classifyLine(line, i, lines)
    if (type === 'empty') return new Paragraph({ children: [], spacing: { after: 40 } })
    if (type === 'name') return new Paragraph({
      children: [new TextRun({ text, bold: true, size: 36, font: 'Calibri', color: '1E3A5F' })],
      spacing: { after: 40 },
    })
    if (type === 'contact') return new Paragraph({
      children: [new TextRun({ text, size: 18, font: 'Calibri', color: '555555' })],
      spacing: { after: 120 },
    })
    if (type === 'section') return new Paragraph({
      children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 22, font: 'Calibri', color: '1E3A5F' })],
      spacing: { before: 240, after: 80 },
      border: { bottom: { color: '1E3A5F', size: 6, space: 1, style: BorderStyle.SINGLE } },
    })
    if (type === 'date') return new Paragraph({
      children: [new TextRun({ text, size: 18, font: 'Calibri', color: '666666', italics: true })],
      spacing: { after: 60 },
    })
    if (type === 'bullet') return new Paragraph({
      children: [new TextRun({ text, size: 19, font: 'Calibri' })],
      bullet: { level: 0 }, spacing: { after: 60 }, indent: { left: 360 },
    })
    if (type === 'skills') {
      const parts = text.split('|').map(s => s.trim())
      const runs: TextRun[] = []
      parts.forEach((p, i) => {
        runs.push(new TextRun({ text: p, size: 19, font: 'Calibri' }))
        if (i < parts.length - 1) runs.push(new TextRun({ text: '  |  ', size: 19, font: 'Calibri', color: '888888' }))
      })
      return new Paragraph({ children: runs, spacing: { after: 60 } })
    }
    const bold = /^[A-Z]/.test(text) && text.length < 80 && !text.endsWith('.')
    return new Paragraph({
      children: [new TextRun({ text, size: 20, font: 'Calibri', bold })],
      spacing: { after: 60 },
    })
  })
}

function buildFeedbackDocx(feedback: string, candidateName: string, targetRole: string): Paragraph[] {
  const paras: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: `Recruiter Feedback Report`, bold: true, size: 32, font: 'Calibri', color: '1E3A5F' })],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Candidate: ${candidateName}  |  Target Role: ${targetRole}`, size: 20, font: 'Calibri', color: '555555' })],
      spacing: { after: 200 },
    }),
  ]
  feedback.split('\n').forEach(line => {
    const t = line.trim()
    if (!t) { paras.push(new Paragraph({ children: [], spacing: { after: 60 } })); return }
    if (/^[A-Z][A-Z\s]{4,}$/.test(t)) {
      paras.push(new Paragraph({
        children: [new TextRun({ text: t, bold: true, size: 22, font: 'Calibri', color: '1E3A5F' })],
        spacing: { before: 240, after: 80 },
        border: { bottom: { color: '1E3A5F', size: 6, space: 1, style: BorderStyle.SINGLE } },
      }))
    } else if (t.startsWith('- ')) {
      paras.push(new Paragraph({
        children: [new TextRun({ text: t.slice(2), size: 19, font: 'Calibri' })],
        bullet: { level: 0 }, spacing: { after: 60 },
      }))
    } else {
      paras.push(new Paragraph({
        children: [new TextRun({ text: t, size: 20, font: 'Calibri' })],
        spacing: { after: 80 },
      }))
    }
  })
  return paras
}

const fitColor = (fit: string) =>
  fit === 'Strong' ? 'bg-green-100 text-green-700 border-green-200'
  : fit === 'Good' ? 'bg-blue-100 text-blue-700 border-blue-200'
  : 'bg-yellow-100 text-yellow-700 border-yellow-200'

export default function RecruiterTool() {
  const [candidateName, setCandidateName] = useState('')
  const [candidateLocation, setCandidateLocation] = useState('')
  const [targetRole, setTargetRole] = useState('')
  const [customInstructions, setCustomInstructions] = useState('')
  const [resume, setResume] = useState('')
  const [jobDescription, setJobDescription] = useState('')
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
      else setError(data.error || 'Could not extract text')
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

  const downloadResumePdf = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'letter' })
    const margin = 60, pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight(), maxW = pageW - margin * 2
    let y = margin
    const check = (n: number) => { if (y + n > pageH - margin) { doc.addPage(); y = margin } }
    optimized.split('\n').forEach((line, i) => {
      const { type, text } = classifyLine(line, i, optimized.split('\n'))
      if (type === 'empty') { y += 5; return }
      if (type === 'name') { check(32); doc.setFont('helvetica','bold'); doc.setFontSize(18); doc.setTextColor(30,58,95); doc.text(text,margin,y); y+=24; doc.setTextColor(0,0,0) }
      else if (type === 'contact') { check(16); doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(80,80,80); doc.text(text,margin,y); y+=18; doc.setTextColor(0,0,0) }
      else if (type === 'section') { check(28); y+=10; doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(30,58,95); doc.text(text.toUpperCase(),margin,y); y+=4; doc.setDrawColor(30,58,95); doc.setLineWidth(0.75); doc.line(margin,y,pageW-margin,y); y+=14; doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(0,0,0) }
      else if (type === 'date') { check(14); doc.setFont('helvetica','italic'); doc.setFontSize(9); doc.setTextColor(100,100,100); doc.text(text,margin,y); y+=14; doc.setFont('helvetica','normal'); doc.setTextColor(0,0,0) }
      else if (type === 'bullet') { doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.splitTextToSize('•  '+text, maxW-15).forEach((l:string,idx:number)=>{ check(13); doc.text(l,margin+(idx===0?0:10),y); y+=13 }) }
      else { const b=/^[A-Z]/.test(text)&&text.length<80&&!text.endsWith('.'); doc.setFont('helvetica',b?'bold':'normal'); doc.setFontSize(10); doc.splitTextToSize(text,maxW).forEach((l:string)=>{ check(14); doc.text(l,margin,y); y+=14 }) }
    })
    doc.save(`${candidateName.replace(/\s+/g,'-')}-optimized.pdf`)
  }

  const downloadResumeDocx = async () => {
    const doc = new Document({ sections: [{ properties: { page: { margin: { top:720,bottom:720,left:1080,right:1080 } } }, children: buildDocx(optimized) }] })
    saveAs(await Packer.toBlob(doc), `${candidateName.replace(/\s+/g,'-')}-optimized.docx`)
  }

  const downloadFeedbackDocx = async () => {
    const doc = new Document({ sections: [{ properties: { page: { margin: { top:720,bottom:720,left:1080,right:1080 } } }, children: buildFeedbackDocx(feedback, candidateName, targetRole) }] })
    saveAs(await Packer.toBlob(doc), `${candidateName.replace(/\s+/g,'-')}-feedback-report.docx`)
  }

  return (
    <main className='min-h-screen bg-slate-50 px-6 py-10'>
      <div className='mx-auto max-w-7xl'>
        <div className='mb-8 flex items-center justify-between'>
          <div>
            <p className='text-xs font-medium uppercase tracking-widest text-slate-400'>TalentSeek</p>
            <h1 className='text-3xl font-bold text-slate-900'>Recruiter Console</h1>
            <p className='mt-1 text-sm text-slate-500'>Resume Consultation · Career Analysis · Feedback Reports</p>
          </div>
          <a href='/dashboard' className='rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100'>← What would you like to do?</a>
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
              <input value={targetRole} onChange={e => setTargetRole(e.target.value)}
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
                        <button onClick={downloadFeedbackDocx}
                          className='rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100'>
                          📥 Download Report
                        </button>
                      </div>
                      <pre className='whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm text-slate-800 leading-relaxed'>{feedback}</pre>
                    </div>
                  )}

                  {activeTab === 'career' && analysis && !analysis.error && (
                    <div className='space-y-6'>
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
