'use client'

import { useEffect, useState } from 'react'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { Document, Packer, Paragraph, TextRun, BorderStyle } from 'docx'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'
import { supabase } from '../../lib/supabase'

const MAX_RESUMES = 10

function classifyLine(line: string, lineIndex: number, allLines: string[]): {
  type: 'name' | 'contact' | 'section' | 'job-date' | 'bullet' | 'skills' | 'empty' | 'text'
  text: string
} {
  const trimmed = line.trim()
  if (!trimmed) return { type: 'empty', text: '' }
  const firstNonEmpty = allLines.findIndex(l => l.trim())
  if (lineIndex === firstNonEmpty) return { type: 'name', text: trimmed }
  let count = 0
  for (let i = 0; i < allLines.length; i++) {
    if (allLines[i].trim()) {
      count++
      if (count === 2 && i === lineIndex) return { type: 'contact', text: trimmed }
    }
  }
  if (/^[A-Z][A-Z\s&/()]{3,}$/.test(trimmed)) return { type: 'section', text: trimmed }
  if (trimmed.startsWith('- ')) return { type: 'bullet', text: trimmed.slice(2).trim() }
  if ((trimmed.match(/\|/g) || []).length >= 2) return { type: 'skills', text: trimmed }
  if (/\d{4}/.test(trimmed) && trimmed.length < 40) return { type: 'job-date', text: trimmed }
  return { type: 'text', text: trimmed }
}

function buildDocxParagraphs(resumeText: string): Paragraph[] {
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
    if (type === 'job-date') return new Paragraph({
      children: [new TextRun({ text, size: 18, font: 'Calibri', color: '666666', italics: true })],
      spacing: { after: 60 },
    })
    if (type === 'bullet') return new Paragraph({
      children: [new TextRun({ text, size: 19, font: 'Calibri' })],
      bullet: { level: 0 },
      spacing: { after: 60 },
      indent: { left: 360 },
    })
    if (type === 'skills') {
      const parts = text.split('|').map(s => s.trim())
      const runs: TextRun[] = []
      parts.forEach((part, idx) => {
        runs.push(new TextRun({ text: part, size: 19, font: 'Calibri' }))
        if (idx < parts.length - 1) runs.push(new TextRun({ text: '  |  ', size: 19, font: 'Calibri', color: '888888' }))
      })
      return new Paragraph({ children: runs, spacing: { after: 60 } })
    }
    const isBold = /^[A-Z]/.test(text) && text.length < 80 && !text.endsWith('.')
    return new Paragraph({
      children: [new TextRun({ text, size: 20, font: 'Calibri', bold: isBold })],
      spacing: { after: 60 },
    })
  })
}

export default function MasterResume() {
  const [files, setFiles] = useState<{ name: string; text: string }[]>([])
  const [masterResume, setMasterResume] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [isRecruiter, setIsRecruiter] = useState(false)

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const role = data.user?.app_metadata?.role
      setIsRecruiter(role === 'recruiter' || role === 'admin')
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
    if (files.length + selected.length > MAX_RESUMES) {
      setError(`Maximum ${MAX_RESUMES} resumes allowed`)
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
        if (!res.ok) throw new Error('Failed to parse ' + file.name)
        const data = await res.json()
        if (data.text) {
          setFiles(prev => [...prev, { name: file.name, text: data.text }])
        } else {
          setError('Could not extract text from ' + file.name)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed')
      }
    }
    setUploadingIndex(null)
    e.target.value = ''
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleConsolidate = async () => {
    if (files.length < 2) { setError('Please upload at least 2 resumes to consolidate'); return }
    setIsLoading(true); setError(''); setMasterResume('')
    try {
      const authHeaders = await getAuthHeaders()
      const res = await fetch(`${API_URL}/resumes/consolidate-demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ resumes: files.map(f => f.text) }),
      })
      if (!res.ok) throw new Error('Consolidation failed')
      const data = await res.json()
      setMasterResume(data.master_resume || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally { setIsLoading(false) }
  }

  const downloadDocx = async () => {
    const doc = new Document({
      sections: [{
        properties: { page: { margin: { top: 720, bottom: 720, left: 1080, right: 1080 } } },
        children: buildDocxParagraphs(masterResume),
      }]
    })
    saveAs(await Packer.toBlob(doc), 'master-resume.docx')
  }

  const downloadPdf = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'letter' })
    const margin = 60
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const maxW = pageW - margin * 2
    let y = margin
    const checkPage = (n: number) => { if (y + n > pageH - margin) { doc.addPage(); y = margin } }

    const lines = masterResume.split('\n')
    lines.forEach((line, i) => {
      const { type, text } = classifyLine(line, i, lines)
      if (type === 'empty') { y += 5; return }
      if (type === 'name') {
        checkPage(32)
        doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(30, 58, 95)
        doc.text(text, margin, y); y += 24; doc.setTextColor(0, 0, 0)
      } else if (type === 'contact') {
        checkPage(16)
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(80, 80, 80)
        doc.text(text, margin, y); y += 18; doc.setTextColor(0, 0, 0)
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
      } else if (type === 'bullet') {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10)
        const wrapped = doc.splitTextToSize('•  ' + text, maxW - 15)
        wrapped.forEach((l: string, idx: number) => {
          checkPage(13); doc.text(l, margin + (idx === 0 ? 0 : 10), y); y += 13
        })
      } else {
        const isBold = /^[A-Z]/.test(text) && text.length < 80 && !text.endsWith('.')
        doc.setFont('helvetica', isBold ? 'bold' : 'normal'); doc.setFontSize(10)
        doc.splitTextToSize(text, maxW).forEach((l: string) => { checkPage(14); doc.text(l, margin, y); y += 14 })
      }
    })
    doc.save('master-resume.pdf')
  }

  return (
    <main className='min-h-screen bg-slate-50 px-6 py-10'>
      <div className='mx-auto max-w-6xl'>
        <div className='mb-8 text-center'>
          <h1 className='text-4xl font-bold text-slate-900'>TalentSeek</h1>
          <p className='mt-2 text-slate-600'>Master Resume Builder</p>
        </div>

        <div className='mb-4'>
          <a href={isRecruiter ? '/recruiter/dashboard' : '/dashboard'} className='text-sm text-slate-500 hover:text-slate-700'>← Back to {isRecruiter ? 'Recruiter Home' : 'What would you like to do?'}</a>
        </div>

        <div className='grid gap-8 lg:grid-cols-2'>
          <section className='rounded-2xl bg-white p-6 shadow-sm'>
            <h2 className='mb-1 text-xl font-semibold text-slate-900'>Upload Your Resumes</h2>
            <p className='mb-4 text-sm text-slate-500'>Upload up to {MAX_RESUMES} versions of your resume. Claude will merge them into one comprehensive master resume.</p>

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
                  disabled={uploadingIndex !== null}
                />
              </label>
            )}

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
                      className='text-slate-400 hover:text-red-500 text-lg leading-none'>×</button>
                  </div>
                ))}
              </div>
            )}

            {files.length >= MAX_RESUMES && (
              <div className='mb-4 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-700'>
                Maximum {MAX_RESUMES} resumes reached
              </div>
            )}

            <button
              onClick={handleConsolidate}
              disabled={isLoading || files.length < 2}
              className='w-full rounded-xl bg-slate-900 px-5 py-3 text-white disabled:opacity-40'>
              {isLoading ? 'Working...' : `✨ Build Master Resume (${files.length} files)`}
            </button>

            {files.length < 2 && files.length > 0 && (
              <p className='mt-2 text-center text-xs text-slate-400'>Upload at least one more resume to continue</p>
            )}

            {error && <div className='mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700'>{error}</div>}
          </section>

          <section className='rounded-2xl bg-white p-6 shadow-sm'>
            <h2 className='mb-4 text-xl font-semibold text-slate-900'>Master Resume</h2>

            {!masterResume && !isLoading && (
              <div className='rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500'>
                <p className='text-4xl mb-3'>📋</p>
                <p className='text-sm'>Upload multiple resume versions and click Build Master Resume. Claude will merge them into one comprehensive document.</p>
              </div>
            )}

            {isLoading && (
              <div className='flex flex-col items-center gap-3 py-12'>
                <LoadingSpinner />
                <p className='text-sm text-slate-500'>World-leading AI is building your master resume...</p>
                <p className='text-xs text-slate-400'>Analysing, merging, and perfecting your career story — this may take 20-30 seconds</p>
              </div>
            )}

            {masterResume && (
              <div>
                <div className='mb-3 flex items-center justify-between'>
                  <h3 className='font-semibold text-slate-800'>Your Master Resume</h3>
                  <div className='flex gap-2'>
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
                <pre className='max-h-[600px] overflow-y-auto whitespace-pre-wrap rounded-xl bg-slate-100 p-4 text-sm text-slate-800'>{masterResume}</pre>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
