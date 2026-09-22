'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'
import { LoadingSpinner } from './components/LoadingSpinner'
import {
  Document, Packer, Paragraph, TextRun, BorderStyle,
  AlignmentType, UnderlineType
} from 'docx'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'

function getInitials(name: string): string {
  return name.trim().split(/\s+/).map(w => w[0]?.toUpperCase() || '').join('')
}

function parseJobInfo(jd: string): { title: string; company: string } {
  const lines = jd.split('\n').map(l => l.trim()).filter(Boolean)
  const title = lines[0]?.replace(/[^a-zA-Z\s]/g, '').trim().split(/\s+/).slice(0, 3).join(' ') || 'Role'
  const companyLine = lines.find(l => /\bat\b|\bfor\b|\bwith\b/i.test(l))
  const companyMatch = companyLine?.match(/(?:at|for|with)\s+([A-Z][a-zA-Z\s]+?)(?:\s*[,.]|$)/)?.[1]?.trim()
  const company = companyMatch || lines[1]?.split(/\s+/).slice(0, 2).join('') || 'Company'
  return { title, company }
}

function buildFilename(resumeText: string, jdText: string): string {
  const nameMatch = resumeText.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/m)
  const name = nameMatch?.[1] || 'Resume'
  const initials = getInitials(name)
  const { title, company } = parseJobInfo(jdText)
  const titleAbbr = title.split(/\s+/).map(w => w[0]?.toUpperCase() || '').join('')
  const companyClean = company.replace(/\s+/g, '')
  return `${initials}-${titleAbbr}-${companyClean}`
}

// Classify each line for formatting
function classifyLine(line: string, lineIndex: number, allLines: string[]): {
  type: 'name' | 'contact' | 'section' | 'job-company' | 'job-title' | 'job-date' | 'bullet' | 'skills' | 'empty' | 'text'
  text: string
} {
  const trimmed = line.trim()
  if (!trimmed) return { type: 'empty', text: '' }

  // First non-empty line = name
  const firstNonEmpty = allLines.findIndex(l => l.trim())
  if (lineIndex === firstNonEmpty) return { type: 'name', text: trimmed }

  // Second non-empty line = contact
  let count = 0
  for (let i = 0; i < allLines.length; i++) {
    if (allLines[i].trim()) {
      count++
      if (count === 2 && i === lineIndex) return { type: 'contact', text: trimmed }
    }
  }

  // ALL CAPS line = section heading
  if (/^[A-Z][A-Z\s&/()]{3,}$/.test(trimmed)) return { type: 'section', text: trimmed }

  // Bullet point
  if (trimmed.startsWith('- ')) return { type: 'bullet', text: trimmed.slice(2).trim() }

  // Skills line (contains multiple | separators)
  if ((trimmed.match(/\|/g) || []).length >= 2) return { type: 'skills', text: trimmed }

  // Date line
  if (/\d{4}/.test(trimmed) && trimmed.length < 40) return { type: 'job-date', text: trimmed }

  return { type: 'text', text: trimmed }
}

function buildDocxParagraphs(resumeText: string): Paragraph[] {
  const lines = resumeText.split('\n')
  const paragraphs: Paragraph[] = []

  lines.forEach((line, i) => {
    const { type, text } = classifyLine(line, i, lines)

    if (type === 'empty') {
      paragraphs.push(new Paragraph({ children: [], spacing: { after: 40 } }))
      return
    }

    if (type === 'name') {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text, bold: true, size: 36, font: 'Calibri', color: '1E3A5F' })],
        alignment: AlignmentType.LEFT,
        spacing: { after: 40 },
      }))
      return
    }

    if (type === 'contact') {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text, size: 18, font: 'Calibri', color: '555555' })],
        spacing: { after: 120 },
      }))
      return
    }

    if (type === 'section') {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 22, font: 'Calibri', color: '1E3A5F' })],
        spacing: { before: 240, after: 80 },
        border: { bottom: { color: '1E3A5F', size: 6, space: 1, style: BorderStyle.SINGLE } },
      }))
      return
    }

    if (type === 'skills') {
      const parts = text.split('|').map(s => s.trim())
      const runs: TextRun[] = []
      parts.forEach((part, idx) => {
        runs.push(new TextRun({ text: part, size: 19, font: 'Calibri' }))
        if (idx < parts.length - 1) runs.push(new TextRun({ text: '  |  ', size: 19, font: 'Calibri', color: '888888' }))
      })
      paragraphs.push(new Paragraph({ children: runs, spacing: { after: 60 } }))
      return
    }

    if (type === 'job-date') {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text, size: 18, font: 'Calibri', color: '666666', italics: true })],
        spacing: { after: 60 },
      }))
      return
    }

    if (type === 'bullet') {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text, size: 19, font: 'Calibri' })],
        bullet: { level: 0 },
        spacing: { after: 60 },
        indent: { left: 360 },
      }))
      return
    }

    // Default text — could be company/job title
    const isBoldLike = /^[A-Z]/.test(text) && text.length < 80 && !text.endsWith('.')
    paragraphs.push(new Paragraph({
      children: [new TextRun({ text, size: 20, font: 'Calibri', bold: isBoldLike })],
      spacing: { after: 60 },
    }))
  })

  return paragraphs
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
  const [optimizedResume, setOptimizedResume] = useState('')
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const [uploadingResume, setUploadingResume] = useState(false)
  const [uploadingJD, setUploadingJD] = useState(false)
  const [resumeLength, setResumeLength] = useState('2')

  const [user, setUser] = useState<any>(null)
  const router = useRouter()
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  const parseFile = async (file: File, setter: (t: string) => void, setUploading: (b: boolean) => void) => {
    setUploading(true); setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`${API_URL}/resumes/parse-demo`, { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Failed to parse file')
      const data = await res.json()
      if (data.text) { setter(data.text) } else { setError(data.error || 'Could not extract text') }
    } catch (err) { setError(err instanceof Error ? err.message : 'Upload failed') }
    finally { setUploading(false) }
  }

  const handleResumeFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (file) parseFile(file, setResume, setUploadingResume)
  }
  const handleJDFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (file) parseFile(file, setJobDescription, setUploadingJD)
  }

  const handleOptimize = async () => {
    if (!resume.trim() || !jobDescription.trim()) { setError('Please fill in both fields'); return }
    setIsLoading(true); setError(''); setOptimizedResume(''); setAnalysis(null)
    try {
      const lengthInstruction = resumeLength === '1'
        ? 'LENGTH: Keep to 1 page maximum. Be very concise, only most relevant roles.'
        : resumeLength === '2'
        ? 'LENGTH: Keep to 2 pages. Balance detail with conciseness.'
        : 'LENGTH: Detailed resume, 3+ pages. Include comprehensive experience and achievements.'

      const res = await fetch(`${API_URL}/resumes/optimize-demo`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: resume,
          job_description: jobDescription + '\n\n' + lengthInstruction,
        }),
      })
      if (!res.ok) throw new Error('Optimization failed')
      const data = await res.json()
      setOptimizedResume(data.optimized_content || '')

      setIsAnalyzing(true)
      try {
        const aRes = await fetch(`${API_URL}/resumes/analyze-demo`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resume_content: data.optimized_content, job_description: jobDescription }),
        })
        if (aRes.ok) setAnalysis(await aRes.json())
      } catch (_) {}
      finally { setIsAnalyzing(false) }

    } catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong') }
    finally { setIsLoading(false) }
  }

  const downloadDocx = async () => {
    const filename = buildFilename(optimizedResume, jobDescription)
    const doc = new Document({
      sections: [{
        properties: { page: { margin: { top: 720, bottom: 720, left: 1080, right: 1080 } } },
        children: buildDocxParagraphs(optimizedResume),
      }]
    })
    saveAs(await Packer.toBlob(doc), `${filename}.docx`)
  }

  const downloadPdf = () => {
    const filename = buildFilename(optimizedResume, jobDescription)
    const doc = new jsPDF({ unit: 'pt', format: 'letter' })
    const margin = 60
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const maxW = pageW - margin * 2
    let y = margin
    const checkPage = (n: number) => { if (y + n > pageH - margin) { doc.addPage(); y = margin } }

    const lines = optimizedResume.split('\n')
    lines.forEach((line, i) => {
      const { type, text } = classifyLine(line, i, lines)
      if (type === 'empty') { y += 5; return }

      if (type === 'name') {
        checkPage(32)
        doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(30, 58, 95)
        doc.text(text, margin, y); y += 24
        doc.setTextColor(0, 0, 0)

      } else if (type === 'contact') {
        checkPage(16)
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(80, 80, 80)
        doc.text(text, margin, y); y += 18
        doc.setTextColor(0, 0, 0)

      } else if (type === 'section') {
        checkPage(28); y += 10
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(30, 58, 95)
        doc.text(text.toUpperCase(), margin, y); y += 4
        doc.setDrawColor(30, 58, 95); doc.setLineWidth(0.75)
        doc.line(margin, y, pageW - margin, y); y += 14
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(0, 0, 0)

      } else if (type === 'job-date') {
        checkPage(14)
        doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(100, 100, 100)
        doc.text(text, margin, y); y += 14
        doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0)

      } else if (type === 'skills') {
        checkPage(14)
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5)
        const wrapped = doc.splitTextToSize(text, maxW)
        wrapped.forEach((l: string) => { checkPage(14); doc.text(l, margin, y); y += 14 })

      } else if (type === 'bullet') {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10)
        const wrapped = doc.splitTextToSize('•  ' + text, maxW - 15)
        wrapped.forEach((l: string, idx: number) => {
          checkPage(13)
          doc.text(l, margin + (idx === 0 ? 0 : 10), y); y += 13
        })

      } else {
        const isBold = /^[A-Z]/.test(text) && text.length < 80 && !text.endsWith('.')
        doc.setFont('helvetica', isBold ? 'bold' : 'normal'); doc.setFontSize(10)
        const wrapped = doc.splitTextToSize(text, maxW)
        wrapped.forEach((l: string) => { checkPage(14); doc.text(l, margin, y); y += 14 })
      }
    })
    doc.save(`${filename}.pdf`)
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
            <button onClick={handleLogout} className='rounded-lg border border-slate-200 px-3 py-1 text-slate-500 hover:border-slate-400 hover:text-slate-700'>
              Sign Out
            </button>
          </div>
          <a href='/master-resume' className='mt-3 inline-block rounded-lg border border-slate-300 px-4 py-1.5 text-sm text-slate-600 hover:border-slate-500 hover:text-slate-900'>
            📋 Build Master Resume
          </a>
        </div>

        <div className='grid gap-8 lg:grid-cols-2'>
          <section className='rounded-2xl bg-white p-6 shadow-sm'>
            <h2 className='mb-3 text-xl font-semibold text-slate-900'>Your Resume</h2>
            <label className='mb-3 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 hover:border-slate-400'>
              <input type='file' accept='.pdf,.docx' className='hidden' onChange={handleResumeFile} disabled={uploadingResume} />
              {uploadingResume ? 'Extracting...' : '📎 Upload PDF or Word'}
            </label>
            <textarea value={resume} onChange={(e) => setResume(e.target.value)}
              placeholder='Or paste your resume here...'
              className='min-h-[160px] w-full rounded-xl border border-slate-300 p-4 text-sm text-slate-900 outline-none focus:border-slate-500' />

            <h2 className='mb-3 mt-5 text-xl font-semibold text-slate-900'>Job Description</h2>
            <label className='mb-3 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 hover:border-slate-400'>
              <input type='file' accept='.pdf,.docx' className='hidden' onChange={handleJDFile} disabled={uploadingJD} />
              {uploadingJD ? 'Extracting...' : '📎 Upload PDF or Word'}
            </label>
            <textarea value={jobDescription} onChange={(e) => setJobDescription(e.target.value)}
              placeholder='Or paste the job description here...'
              className='min-h-[130px] w-full rounded-xl border border-slate-300 p-4 text-sm text-slate-900 outline-none focus:border-slate-500' />

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
            {error && <div className='mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700'>{error}</div>}
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
                  <pre className='max-h-56 overflow-y-auto whitespace-pre-wrap rounded-xl bg-slate-100 p-4 text-sm text-slate-800'>{optimizedResume}</pre>
                </div>

                {isAnalyzing && (
                  <div className='flex items-center gap-2 text-sm text-slate-500'>
                    <LoadingSpinner />
                    <span>Analyzing job match...</span>
                  </div>
                )}

                {analysis && !analysis.error && (
                  <div className='space-y-3'>
                    <h3 className='font-semibold text-slate-800'>Job Match Analysis</h3>

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
