'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export function AppNavigation() {
  const pathname = usePathname()
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState('')
  // Unknown until the session loads, so the menu never flashes another role's links.
  const [role, setRole] = useState<string | null>(null)
  const [account, setAccount] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user
      setRole(user?.app_metadata?.role || 'candidate')
      setAccount(user?.user_metadata?.full_name?.trim() || user?.email || '')
    })
  }, [])

  async function signOut() {
    setSigningOut(true)
    setError('')
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      window.location.replace('/auth')
    } catch {
      setError('Unable to sign out. Please try again.')
      setSigningOut(false)
    }
  }
  if (pathname.startsWith('/auth')) return null

  return (
    <nav aria-label='Main navigation' className='border-b border-slate-200 bg-white px-6 py-4'>
      <div className='mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 text-sm'>
        <a href='https://talentseek.ca' className='font-bold text-slate-900'>TalentSeek.ca</a>
        {role && (role === 'admin'
          ? [
              { href: '/admin/dashboard', label: 'Admin Home' },
              { href: '/admin/jobs', label: 'Job Postings' },
              { href: '/admin', label: 'Koen Usage Report' },
              { href: '/admin/prompts', label: 'Prompt Editor' },
            ]
          : role === 'recruiter'
          ? [
              { href: '/recruiter/dashboard', label: 'Recruiter Home' },
              { href: '/recruiter', label: 'Enhance Resume Optimization' },
              { href: '/master-resume', label: 'Master Resume Builder' },
            ]
          : role === 'employer'
          ? [
              { href: '/employer/jobs', label: 'Employer Home' },
              { href: '/employer/jobs/new', label: 'Post a Job' },
              { href: '/jobs', label: 'View Job Board' },
            ]
          : [
              { href: '/dashboard', label: 'Home' },
              { href: '/', label: 'Tailor My Resume' },
              { href: '/interview-prep', label: 'Interview Prep' },
              { href: '/my-resumes', label: 'My Resumes' },
              { href: '/master-resume', label: 'Master Resume' },
              { href: '/jobs', label: 'Jobs' },
              { href: '/billing', label: 'Plan & Usage' },
            ]
        ).map(({ href, label }) => (
          // Plain links: a full page load lets a page warn about unsaved work (e.g. an interview pack not yet kept).
          <a key={href} href={href} aria-current={pathname === href ? 'page' : undefined}
            className={pathname === href ? 'font-semibold text-slate-900 underline underline-offset-4' : 'text-slate-600 hover:text-slate-900'}>
            {label}
          </a>
        ))}
        <div className='flex min-w-0 items-center gap-3 sm:ml-auto'>
          {account && <span className='max-w-[14rem] truncate text-slate-500' title={account}>{account}</span>}
          <button onClick={signOut} disabled={signingOut} className='shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-slate-600 hover:bg-slate-50 disabled:opacity-50'>
            {signingOut ? 'Signing out…' : 'Sign Out'}
          </button>
        </div>
        {error && <p role='alert' className='w-full text-sm text-red-700'>{error}</p>}
      </div>
    </nav>
  )
}
