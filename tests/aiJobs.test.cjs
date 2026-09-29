const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const { outputText } = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '..', 'lib/aiJobs.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
})
const mod = { exports: {} }
new Function('module', 'exports', 'require', outputText)(mod, mod.exports, require)
const { runAiJob } = mod.exports

const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body })
const noSleep = async () => {}

function fakeFetch(responses) {
  const calls = []
  const impl = async (url, init) => {
    calls.push({ url, method: init?.method || 'GET' })
    const next = responses.shift()
    if (next instanceof Error) throw next
    return next
  }
  return { impl, calls }
}

test('starts a job, polls until it succeeds, and returns the result', async () => {
  const { impl, calls } = fakeFetch([json(202, { job_id: 'j1' }), json(200, { status: 'queued' }), json(200, { status: 'running' }),
    json(200, { status: 'succeeded', result: { pack: 1 } })])
  const outcome = await runAiJob('https://api', '/interview/generate-pack/jobs', { a: 1 }, { Authorization: 'Bearer t' }, { fetchImpl: impl, sleep: noSleep })
  assert.deepEqual(outcome, { ok: true, result: { pack: 1 } })
  assert.equal(calls[0].method, 'POST')
  assert.equal(calls[1].url, 'https://api/ai-jobs/j1')
})

test('a refused start (e.g. out of credits) is returned unchanged for the page to explain', async () => {
  const body = { detail: { code: 'insufficient_credits', message: 'Buy a pack' } }
  const { impl, calls } = fakeFetch([json(402, body)])
  const outcome = await runAiJob('https://api', '/x/jobs', {}, {}, { fetchImpl: impl, sleep: noSleep })
  assert.deepEqual(outcome, { ok: false, status: 402, body })
  assert.equal(calls.length, 1)
})

test('dropped connections while polling are retried', async () => {
  const { impl } = fakeFetch([json(202, { job_id: 'j1' }), new TypeError('Load failed'), new TypeError('Load failed'),
    json(200, { status: 'succeeded', result: 'done' })])
  const outcome = await runAiJob('https://api', '/x/jobs', {}, {}, { fetchImpl: impl, sleep: noSleep })
  assert.deepEqual(outcome, { ok: true, result: 'done' })
})

test('a failed job returns its message', async () => {
  const { impl } = fakeFetch([json(202, { job_id: 'j1' }), json(200, { status: 'failed', error: 'Your credit was not used' })])
  const outcome = await runAiJob('https://api', '/x/jobs', {}, {}, { fetchImpl: impl, sleep: noSleep })
  assert.equal(outcome.ok, false)
  assert.equal(outcome.body.detail, 'Your credit was not used')
})

test('an expired job and a client timeout give clear messages', async () => {
  let { impl } = fakeFetch([json(202, { job_id: 'j1' }), json(404, { detail: 'x' })])
  assert.match((await runAiJob('https://api', '/x/jobs', {}, {}, { fetchImpl: impl, sleep: noSleep })).body.detail, /expired/)
  const running = [json(202, { job_id: 'j1' })]
  for (let i = 0; i < 5; i++) running.push(json(200, { status: 'running' }))
  ;({ impl } = fakeFetch(running))
  const outcome = await runAiJob('https://api', '/x/jobs', {}, {}, { fetchImpl: impl, sleep: noSleep, intervalMs: 1, timeoutMs: 3 })
  assert.equal(outcome.status, 504)
})
