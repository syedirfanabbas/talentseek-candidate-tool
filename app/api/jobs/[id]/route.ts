import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  try {
    const response = await fetch(new URL(`/jobs/public/${encodeURIComponent(id)}`, backendUrl), { cache: 'no-store' })
    const data = await response.json().catch(() => ({ detail: 'Job not found' }))
    return NextResponse.json(data, { status: response.status })
  } catch {
    return NextResponse.json({ detail: 'Job details are temporarily unavailable.' }, { status: 502 })
  }
}
