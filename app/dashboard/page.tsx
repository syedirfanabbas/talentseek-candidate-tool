import Link from 'next/link'

const choices = [
  {
    title: 'Build My Master Resume',
    description: 'Bring your experience, skills, and achievements together in one comprehensive resume.',
    action: 'Build my master resume',
    href: '/master-resume',
    category: 'Start with your experience',
  },
  {
    title: 'Tailor My Resume for a Job',
    description: 'Have a role in mind? Match your resume to the job description and highlight the experience that matters.',
    action: 'Optimize my resume',
    href: '/',
    category: 'Get ready to apply',
  },
  {
    title: 'Get Recruiter Help',
    description: 'Work with a TalentSeek recruiter to review and strengthen your resume for your next opportunity.',
    action: 'Contact a recruiter',
    href: 'https://talentseek.ca/contact/',
    category: 'Work with an expert',
  },
]

export default function DashboardPage() {
  return (
    <main className='min-h-screen bg-slate-50 px-6 py-12 sm:py-20'>
      <div className='mx-auto max-w-6xl'>
        <div className='max-w-2xl'>
          <p className='text-sm font-semibold uppercase tracking-widest text-teal-700'>Your next step</p>
          <h1 className='mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl'>What would you like to do today?</h1>
          <p className='mt-5 text-lg leading-8 text-slate-600'>Start with your experience, prepare for a specific role, or get support from a recruiter.</p>
        </div>

        <div className='mt-10 grid gap-6 md:grid-cols-3'>
          {choices.map(choice => (
            <section key={choice.href} className='flex flex-col rounded-2xl border border-slate-200 bg-white p-7 shadow-sm'>
              <p className='text-xs font-semibold uppercase tracking-wider text-teal-700'>{choice.category}</p>
              <h2 className='mt-4 text-2xl font-bold text-slate-900'>{choice.title}</h2>
              <p className='mt-4 flex-1 leading-7 text-slate-600'>{choice.description}</p>
              <Link href={choice.href} className='mt-8 inline-flex items-center justify-between gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700'>
                {choice.action}<span aria-hidden='true'>→</span>
              </Link>
              {choice.href.startsWith('https:') && <p className='mt-3 text-xs text-slate-500'>Opens the contact page on TalentSeek.ca.</p>}
            </section>
          ))}
        </div>

        <p className='mt-8 text-sm leading-6 text-slate-500'>Not sure where to start? Build your master resume first, then tailor it for each job you apply to.</p>
      </div>
    </main>
  )
}
