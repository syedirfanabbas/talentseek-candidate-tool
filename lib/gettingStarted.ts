// D15 getting started: three first-visit questions → one recommended starting card.
// Answers live in the account's user_metadata (no migration); counted later for the D16 decision.

export type HasResume = 'current' | 'several' | 'old' | 'none'
export type Experience = 'student' | 'early' | 'experienced'
export type Need = 'job' | 'interview' | 'improve' | 'recruiter'

export type GettingStartedAnswers = { has_resume: HasResume; experience: Experience; need: Need }
export type GettingStartedRecord = Partial<GettingStartedAnswers> & { version: 1; answered_at?: string; skipped_at?: string; first_resume_early_access_at?: string }

export type Recommendation = { href: string; reason: string; firstResume?: boolean }

export const QUESTIONS = [
  { key: 'has_resume', question: 'Do you have a resume right now?', options: [
    { value: 'current', icon: '📄', label: 'Yes, and it’s fairly up to date' },
    { value: 'several', icon: '🗂️', label: 'Yes, but I have several versions' },
    { value: 'old', icon: '🕰️', label: 'Yes, but it’s old or needs work' },
    { value: 'none', icon: '✏️', label: 'No, not yet' },
  ] },
  { key: 'experience', question: 'How much work experience do you have?', options: [
    { value: 'student', icon: '🎓', label: 'Student or new graduate' },
    { value: 'early', icon: '🌱', label: '1–5 years' },
    { value: 'experienced', icon: '🏆', label: 'More than 5 years' },
  ] },
  { key: 'need', question: 'What do you need most right now?', options: [
    { value: 'job', icon: '🎯', label: 'Apply to a specific job' },
    { value: 'interview', icon: '🎤', label: 'Prepare for an interview' },
    { value: 'improve', icon: '✨', label: 'Improve my resume in general' },
    { value: 'recruiter', icon: '🤝', label: 'Talk to a recruiter' },
  ] },
] as const

// First matching rule wins. Experience does not change the route yet (it is evidence for D16).
export function recommend(answers: GettingStartedAnswers): Recommendation {
  if (answers.has_resume === 'none')
    return { href: '/interview-prep', reason: 'Interview packs work without a resume. A guided first-resume builder is coming soon.', firstResume: true }
  if (answers.has_resume === 'several' && answers.need !== 'interview' && answers.need !== 'recruiter')
    return { href: '/master-resume', reason: 'Combine your versions once, then tailor from your master resume for each job.' }
  if (answers.need === 'interview') return { href: '/interview-prep', reason: 'Get likely questions and a preparation plan for your interview.' }
  if (answers.need === 'recruiter') return { href: '/billing#recruiter-support', reason: 'Book a written review or a 30-minute session with an experienced recruiter.' }
  if (answers.need === 'improve')
    return { href: '/', reason: 'Paste any job ad for the kind of role you want: the tailored resume shows what to strengthen.' }
  return { href: '/', reason: 'You get the best results with the job ad or a job link.' }
}

export function isComplete(record: GettingStartedRecord | null | undefined): record is GettingStartedRecord & GettingStartedAnswers {
  return Boolean(record?.has_resume && record?.experience && record?.need)
}
