import Link from 'next/link'

const tools = [
  { title: 'Master Resume Builder', text: 'Build and refine a complete candidate resume before tailoring it for specific roles.', href: '/master-resume', action: 'Open master resume builder' },
  { title: 'Enhance Resume Optimization', text: 'Use the recruiter workspace to optimize a candidate resume with recruiter instructions.', href: '/recruiter', action: 'Open resume optimization' },
  { title: 'Career Analysis', text: 'Generate career direction, role-fit, and salary analysis from the recruiter workspace.', href: '/recruiter', action: 'Open career analysis' },
  { title: 'Candidate Request Queue', text: 'Review incoming candidate requests, update their status, and provide feedback.', href: '/recruiter/requests', action: 'Open request queue' },
]

export default function RecruiterDashboard() {
  return <main className='min-h-screen bg-slate-50 px-6 py-12 sm:py-20'><div className='mx-auto max-w-6xl'>
    <p className='text-sm font-semibold uppercase tracking-widest text-teal-700'>Recruiter workspace</p>
    <h1 className='mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl'>What would you like to work on?</h1>
    <p className='mt-5 max-w-2xl text-lg leading-8 text-slate-600'>Manage candidate requests, prepare stronger resumes, and create practical career guidance.</p>
    <div className='mt-10 grid gap-6 md:grid-cols-2'>{tools.map(tool => <section key={tool.title} className='flex flex-col rounded-2xl border border-slate-200 bg-white p-7 shadow-sm'><h2 className='text-2xl font-bold text-slate-900'>{tool.title}</h2><p className='mt-4 flex-1 leading-7 text-slate-600'>{tool.text}</p><Link href={tool.href} className='mt-8 rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-slate-700'>{tool.action} →</Link></section>)}</div>
  </div></main>
}
