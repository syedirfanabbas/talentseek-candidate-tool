'use client'

import { useState } from 'react'
import { LoadingSpinner } from './components/LoadingSpinner'

export default function CandidateTool() {
  const [resume, setResume] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [optimizedResume, setOptimizedResume] = useState('')
  const [extractedData, setExtractedData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'optimize' | 'extract'>('optimize')
  const [uploading, setUploading] = useState(false)

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch(`${API_URL}/resumes/parse-demo`, {
        method: 'POST',
        body: formData,
      })
      if (!response.ok) throw new Error('Failed to parse file')
      const data = await response.json()
      if (data.text) {
        setResume(data.text)
      } else {
        setError(data.error || 'Could not extract text from file')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleOptimize = async () => {
    if (!resume.trim() || !jobDescription.trim()) {
      setError('Please fill in both resume and job description')
      return
    }
    setIsLoading(true)
    setError('')
    setOptimizedResume('')
    try {
      const response = await fetch(`${API_URL}/resumes/optimize-demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: resume, job_description: jobDescription }),
      })
      if (!response.ok) throw new Error('Optimization failed')
      const data = await response.json()
      setOptimizedResume(data.optimized_content || '')
      setActiveTab('optimize')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  const handleExtract = async () => {
    if (!resume.trim()) {
      setError('Please enter your resume first')
      return
    }
    setIsLoading(true)
    setError('')
    setExtractedData(null)
    try {
      const response = await fetch(`${API_URL}/resumes/extract-demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: resume }),
      })
      if (!response.ok) throw new Error('Extraction failed')
      const data = await response.json()
      setExtractedData(data)
      setActiveTab('extract')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold text-slate-900">TalentSeek</h1>
          <p className="mt-3 text-slate-600">AI Resume Optimization Tool</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-slate-900">Your Resume</h2>

            <label className="mb-3 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 hover:border-slate-400">
              <input
                type="file"
                accept=".pdf,.docx"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
              />
              {uploading ? 'Extracting text...' : '📎 Upload PDF or Word file'}
            </label>

            <textarea
              value={resume}
              onChange={(e) => setResume(e.target.value)}
              placeholder="Or paste your resume here..."
              className="min-h-[200px] w-full rounded-xl border border-slate-300 p-4 text-sm text-slate-900 outline-none focus:border-slate-500"
            />

            <h2 className="mb-4 mt-6 text-xl font-semibold text-slate-900">Job Description</h2>

            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the target job description here..."
              className="min-h-[160px] w-full rounded-xl border border-slate-300 p-4 text-sm text-slate-900 outline-none focus:border-slate-500"
            />

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={handleOptimize}
                disabled={isLoading}
                className="rounded-xl bg-slate-900 px-5 py-3 text-white disabled:opacity-50"
              >
                {isLoading ? 'Working...' : 'Optimize Resume'}
              </button>
              <button
                onClick={handleExtract}
                disabled={isLoading}
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-slate-900 disabled:opacity-50"
              >
                Extract Resume Data
              </button>
            </div>

            {error && (
              <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>
            )}
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-slate-900">Results</h2>

            {!optimizedResume && !extractedData && !isLoading && (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                Your optimized resume or extracted data will appear here.
              </div>
            )}

            {isLoading && (
              <div className="flex justify-center py-12">
                <LoadingSpinner />
              </div>
            )}

            {optimizedResume && (
              <div>
                <h3 className="mb-3 font-semibold text-slate-800">Optimized Resume</h3>
                <pre className="whitespace-pre-wrap rounded-xl bg-slate-100 p-4 text-sm text-slate-800">
                  {optimizedResume}
                </pre>
              </div>
            )}

            {extractedData && (
              <div className="mt-6">
                <h3 className="mb-3 font-semibold text-slate-800">Extracted Resume Data</h3>
                <pre className="overflow-x-auto rounded-xl bg-slate-100 p-4 text-sm text-slate-800">
                  {JSON.stringify(extractedData, null, 2)}
                </pre>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
