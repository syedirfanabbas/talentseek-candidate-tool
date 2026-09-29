// Runs a long AI request as a background job (backend task CC16): start it, then poll
// GET /ai-jobs/{id}. Mobile browsers give up on a single request after about 60 seconds,
// and brief network drops during polling are simply retried.

// Same shape as the API's error bodies (see lib/credits.ts).
type JobBody = { detail?: string | { code?: string; message?: string } } | null
export type AiJobOutcome<T> = { ok: true; result: T } | { ok: false; status: number; body: JobBody }

type Options = {
  intervalMs?: number
  timeoutMs?: number // longer than the server's 5-minute stuck-job cutoff, so the server decides
  fetchImpl?: typeof fetch
  sleep?: (ms: number) => Promise<void>
}

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

export async function runAiJob<T>(apiUrl: string, startPath: string, body: unknown,
                                  headers: Record<string, string>, options: Options = {}): Promise<AiJobOutcome<T>> {
  const { intervalMs = 3000, timeoutMs = 6 * 60 * 1000, fetchImpl = fetch, sleep = wait } = options
  const started = await fetchImpl(`${apiUrl}${startPath}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
  })
  const startBody = await started.json().catch(() => null)
  if (!started.ok || !startBody?.job_id) return { ok: false, status: started.status, body: startBody }

  for (let waited = 0; waited < timeoutMs; waited += intervalMs) {
    await sleep(intervalMs)
    let response: Response
    try {
      response = await fetchImpl(`${apiUrl}/ai-jobs/${startBody.job_id}`, { headers })
    } catch {
      continue // dropped connection: keep polling, the job keeps running on the server
    }
    const job = await response.json().catch(() => null)
    if (response.status === 404) return { ok: false, status: 404, body: { detail: 'This request expired. Please try again.' } }
    if (!response.ok) return { ok: false, status: response.status, body: job }
    if (job?.status === 'succeeded') return { ok: true, result: job.result as T }
    if (job?.status === 'failed') return { ok: false, status: 502, body: { detail: job.error || 'This request failed. Please try again.' } }
  }
  return { ok: false, status: 504, body: { detail: 'This is taking longer than expected. Please check again in a few minutes.' } }
}
