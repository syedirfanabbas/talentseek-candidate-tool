import { cleanSourceTag } from './lib/signupSource'
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { defaultDestinationForRole, safeReturnTo, signInUrl } from './lib/navigation'

export async function middleware(req: NextRequest) {
  let response = NextResponse.next({
    request: req,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            req.cookies.set(name, value)
          })

          response = NextResponse.next({
            request: req,
          })

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = req.nextUrl.pathname
  const isAuthPage = pathname === '/auth'

  // Preserve refreshed/cleared session cookies when returning a redirect.
  const redirectTo = (destination: string) => {
    const redirect = NextResponse.redirect(new URL(destination, req.url))
    response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie))
    return redirect
  }

  if (!user && !isAuthPage) {
    const signIn = new URL(signInUrl(pathname + req.nextUrl.search), req.url)
    // Campaign tags must survive before the first client page can capture them.
    for (const prefix of ['ts_', 'utm_']) for (const key of ['source', 'medium', 'campaign']) {
      const tag = cleanSourceTag(req.nextUrl.searchParams.get(prefix + key))
      if (tag) signIn.searchParams.set(prefix + key, tag)
    }
    return redirectTo(signIn.pathname + signIn.search)
  }

  if (user && isAuthPage) {
    const next = req.nextUrl.searchParams.get('next')
    return redirectTo(next ? safeReturnTo(next) : defaultDestinationForRole(user.app_metadata?.role))
  }

  if (user) {
    // Only app_metadata is trusted: users can edit their own user_metadata.
    // Employer accounts receive app_metadata.role = 'employer' at sign-up (backend migration 015).
    const role = user.app_metadata?.role

    if (pathname === '/dashboard' && role === 'employer') {
      return redirectTo('/employer/jobs/new')
    }

    if (pathname.startsWith('/admin') && role !== 'admin') {
      return redirectTo('/dashboard')
    }

    if (
      pathname.startsWith('/recruiter') &&
      role !== 'recruiter' &&
      role !== 'admin'
    ) {
      return redirectTo('/dashboard')
    }

    if (
      pathname.startsWith('/employer') &&
      role !== 'admin' &&
      role !== 'employer'
    ) {
      return redirectTo('/dashboard')
    }
  }

  return response
}

export const config = {
  matcher: ['/', '/auth', '/dashboard', '/billing', '/master-resume/:path*', '/my-resumes/:path*', '/interview-prep/:path*', '/employer/:path*', '/admin/:path*', '/recruiter/:path*'],
}
