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
    return redirectTo(signInUrl(pathname + req.nextUrl.search))
  }

  if (user && isAuthPage) {
    const next = req.nextUrl.searchParams.get('next')
    return redirectTo(next ? safeReturnTo(next) : defaultDestinationForRole(user.app_metadata?.role))
  }

  if (user) {
    const role = user.app_metadata?.role

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
  }

  return response
}

export const config = {
  matcher: ['/', '/auth', '/dashboard', '/master-resume/:path*', '/admin/:path*', '/recruiter/:path*'],
}
