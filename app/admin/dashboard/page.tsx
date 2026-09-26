import Link from 'next/link'

const tools = [
  { title: 'Master Resume Builder', text: 'Build and consolidate comprehensive candidate resumes.', href: '/master-resume', action: 'Open master resume builder' },
  { title: 'Resume Optimizer', text: 'Tailor a candidate resume to a specific job description.', href: '/', action: 'Open resume optimizer' },
  { title: 'Enhance Resume Optimization', text: 'Use recruiter-specific instructions and generate detailed candidate feedback.', href: '/recruiter', action: 'Open recruiter workspace' },
  { title: 'Koen Usage Status Report', text: 'Review AI usage, token consumption, costs, models, and endpoint activity.', href: '/admin', action: 'Open usage report' },
  { title: 'Prompt Editor', text: 'Review and update the prompts that control TalentSeek AI outputs.', href: '/admin/prompts', action: 'Open prompt editor' },
]

export default function AdminHomePage() {
  return <main className='min-h-screen bg-slate-50 px-6 py-12 sm:py-20'><div className='mx-auto max-w-6xl'>
    <p className='text-sm font-semibold uppercase tracking-widest text-violet-700'>TalentSeek administration</p>
    <h1 className='mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl'>What would you like to manage?</h1>
    <p className='mt-5 max-w-2xl text-lg leading-8 text-slate-600'>Access candidate tools, recruiter workflows, AI usage reporting, and prompt management from one workspace.</p>
    <div className='mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3'>{tools.map(tool => <section key={tool.title} className='flex flex-col rounded-2xl border border-slate-200 bg-white p-7 shadow-sm'><h2 className='text-2xl font-bold text-slate-900'>{tool.title}</h2><p className='mt-4 flex-1 leading-7 text-slate-600'>{tool.text}</p><Link href={tool.href} className='mt-8 rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-slate-700'>{tool.action} →</Link></section>)}</div>
  </div></main>
}
