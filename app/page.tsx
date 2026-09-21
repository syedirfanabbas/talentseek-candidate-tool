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

  const API_URL = process.env.NEXT_PUBLIC_API_URL

  const handleOptimize = async () => {
    if (!resume.trim() || !jobDescription.trim()) {
      setError('Please fill in both resume and job description')
      return
    }

    try {
      setIsLoading(true)
      setError('')

      const response = await fetch(`${API_URL}/resumes/optimize-demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: resume,
          job_description: jobDescription,
        }),
      })

      if (!response.ok) throw new Error('Failed to optimize')

      const data = await response.json()
      setOptimizedResume(data.optimized_content)
      setActiveTab('optimize')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  const handleExtract = async () => {
    if (!resume.trim()) {
      setError('Please paste your resume first')
      return
    }

    try {
      setIsLoading(true)
      setError('')

      const response = await fetch(`${API_URL}/resumes/extract-demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: resume }),
      })

      if (!response.ok) throw new Error('Failed to extract data')

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
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-12 text-center">
          <h1 className="mb-2 text-4xl font-bold text-gray-900">
            Resume Optimizer
          </h1>
          <p className="text-lg text-gray-600">
            Optimize your resume for any job in seconds
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Your Resume
              </label>
              <textarea
                value={resume}
                onChange={(e) => setResume(e.target.value)}
                placeholder="Paste your resume here..."
                rows={10}
                className="w-full rounded-lg border border-gray-300 p-4 font-mono text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Job Description
              </label>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the job posting here..."
                rows={10}
                className="w-full rounded-lg border border-gray-300 p-4 font-mono text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleOptimize}
                disabled={isLoading}
                className="flex-1 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:bg-gray-400"
              >
                {isLoading ? 'Processing...' : 'Optimize Resume'}
              </button>
              <button
                onClick={handleExtract}
                disabled={isLoading}
                className="flex-1 rounded-lg bg-green-600 px-6 py-3 font-semibold text-white hover:bg-green-700 disabled:bg-gray-400"
              >
                {isLoading ? 'Processing...' : 'Extract Data'}
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            {isLoading ? (
              <LoadingSpinner message="Processing your resume..." />
            ) : optimizedResume || extractedData ? (
              <div className="space-y-4">
                <div className="flex gap-2 border-b">
                  <button
                    onClick={() => setActiveTab('optimize')}
                    className={`px-4 py-2 font-semibold ${
                      activeTab === 'optimize'
                        ? 'border-b-2 border-blue-600 text-blue-600'
                        : 'text-gray-600'
                    }`}
                  >
                    Optimized
                  </button>
                  <button
                    onClick={() => setActiveTab('extract')}
                    className={`px-4 py-2 font-semibold ${
                      activeTab === 'extract'
                        ? 'border-b-2 border-green-600 text-green-600'
                        : 'text-gray-600'
                    }`}
                  >
                    Extracted
                  </button>
                </div>

                {activeTab === 'optimize' && optimizedResume && (
                  <div>
                    <h3 className="mb-3 font-semibold text-gray-900">
                      Your Optimized Resume
                    </h3>
                    <div className="max-h-96 overflow-y-auto rounded bg-gray-50 p-4 font-mono text-sm text-gray-700 whitespace-pre-wrap">
                      {optimizedResume}
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(optimizedResume)
                        alert('Copied to clipboard!')
                      }}
                      className="mt-3 w-full rounded bg-blue-100 px-4 py-2 font-semibold text-blue-700 hover:bg-blue-200"
                    >
                      Copy to Clipboard
                    </button>
                  </div>
                )}

                {activeTab === 'extract' && extractedData && (
                  <div>
                    <h3 className="mb-3 font-semibold text-gray-900">
                      Extracted Information
                    </h3>
                    <dl className="space-y-3 text-sm">
                      {extractedData.name && (
                        <div>
                          <dt className="font-medium text-gray-700">Name</dt>
                          <dd className="text-gray-600">{extractedData.name}</dd>
                        </div>
                      )}
                      {extractedData.email && (
                        <div>
                          <dt className="font-medium text-gray-700">Email</dt>
                          <dd className="text-gray-600">{extractedData.email}</dd>
                        </div>
                      )}
                      {extractedData.phone && (
                        <div>
                          <dt className="font-medium text-gray-700">Phone</dt>
                          <dd className="text-gray-600">{extractedData.phone}</dd>
                        </div>
                      )}
                      {extractedData.current_title && (
                        <div>
                          <dt className="font-medium text-gray-700">Current Title</dt>
                          <dd className="text-gray-600">{extractedData.current_title}</dd>
                        </div>
                      )}
                      {extractedData.key_skills && extractedData.key_skills.length > 0 && (
                        <div>
                          <dt className="font-medium text-gray-700">Skills</dt>
                          <dd className="flex flex-wrap gap-2">
                            {extractedData.key_skills.map((skill: string) => (
                              <span key={skill} className="inline-block rounded bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
                                {skill}
                              </span>
                            ))}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-500">
                Fill in your resume and job description, then click a button to see results
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
