'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export function AppNavigation() {
  const pathname = usePathname()
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState('')
  const [role, setRole] = useState(pathname.startsWith('/admin') ? 'admin' : pathname.startsWith('/recruiter') ? 'recruiter' : pathname.startsWith('/employer') ? 'employer' : 'candidate')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const protectedRole = data.user?.app_metadata?.role
      setRole(protectedRole || (data.user?.user_metadata?.account_type === 'employer' ? 'employer' : 'candidate'))
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
        {(role === 'admin'
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
              { href: '/', label: 'Resume Optimizer' },
              { href: '/master-resume', label: 'Master Resume Builder' },
              { href: '/billing', label: 'Plan & Usage' },
            ]
        ).map(({ href, label }) => (
          <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined}
            className={pathname === href ? 'font-semibold text-slate-900 underline underline-offset-4' : 'text-slate-600 hover:text-slate-900'}>
            {label}
          </Link>
        ))}
        <button onClick={signOut} disabled={signingOut} className='rounded-lg border border-slate-300 px-3 py-2 text-slate-600 hover:bg-slate-50 disabled:opacity-50 sm:ml-auto'>
          {signingOut ? 'Signing out…' : 'Sign Out'}
        </button>
        {error && <p role='alert' className='w-full text-sm text-red-700'>{error}</p>}
      </div>
    </nav>
  )
}
