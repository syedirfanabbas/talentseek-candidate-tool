// Hand a saved resume to the interview-prep page ("Prepare for this interview" in
// My Resumes). Kept in sessionStorage for one page load only, never sent anywhere.
const KEY = 'talentseek-interview-prefill'

export type InterviewPrefill = { resumeText: string; resumeLabel: string; jobTitle?: string; companyName?: string }

export function setInterviewPrefill(prefill: InterviewPrefill): void {
  try { sessionStorage.setItem(KEY, JSON.stringify(prefill)) } catch { /* storage blocked: the user can pick the resume on the page */ }
}

export function takeInterviewPrefill(): InterviewPrefill | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    sessionStorage.removeItem(KEY)
    return raw ? JSON.parse(raw) as InterviewPrefill : null
  } catch { return null }
}
