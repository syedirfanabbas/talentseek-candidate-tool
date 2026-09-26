import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function GET(request: Request) {
  const url = new URL('/jobs/search', backendUrl)
  const query = new URL(request.url).searchParams.get('query')?.trim()
  if (query) url.searchParams.set('query', query)

  try {
    const response = await fetch(url, { cache: 'no-store' })
    const data = await response.json().catch(() => ({ jobs: [] }))
    return NextResponse.json(data, { status: response.ok ? 200 : 502 })
  } catch {
    return NextResponse.json(
      { jobs: [], source_error: 'Jobs are temporarily unavailable. Please try again shortly.' },
      { status: 502 },
    )
  }
}
