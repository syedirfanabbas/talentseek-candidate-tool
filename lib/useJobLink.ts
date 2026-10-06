'use client'
import { useState } from 'react'
import { apiErrorMessage } from './apiError'

type Job = { text: string; job_title?: string; company_name?: string }
type Options = { apiUrl: string; authHeaders: () => Promise<Record<string, string>>; onSuccess: (job: Job) => void }
export function useJobLink({ apiUrl, authHeaders, onSuccess }: Options) {
  const [jobLink, setJobLink] = useState('')
  const [isFetchingJob, setIsFetchingJob] = useState(false)
  const [jobLinkError, setJobLinkError] = useState('')
  const fetchJobText = async () => {
    if (!jobLink.trim()) { setJobLinkError('Paste a job link first.'); return }
    setIsFetchingJob(true); setJobLinkError('')
    try {
      const response = await fetch(`${apiUrl}/resumes/fetch-job`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...await authHeaders() }, body: JSON.stringify({ url: jobLink.trim() }) })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.text) throw new Error(data?.error || apiErrorMessage(data, 'We could not read that job page. Please paste the description instead.'))
      onSuccess(data)
    } catch (error) { setJobLinkError(error instanceof Error ? error.message : 'We could not read that job page. Please paste the description instead.') } finally { setIsFetchingJob(false) }
  }
  return { jobLink, setJobLink, isFetchingJob, jobLinkError, fetchJobText }
}
