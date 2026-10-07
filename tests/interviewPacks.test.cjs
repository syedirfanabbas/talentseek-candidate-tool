const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const React = require('react')

const summary = { id: 'pack-1', job_title: 'Analyst', company_name: 'Example', interview_type: 'Technical', created_at: '2026-10-07T00:00:00Z' }
const pack = { role_summary: 'Guidance' }

function harness(fetcher) {
  const states = [], effects = [], downloads = [], texts = []
  let cursor = 0
  const source = fs.readFileSync(path.join(__dirname, '../app/components/InterviewPackLibrary.tsx'), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } })
  const deps = {
    react: {
      useState(initial) { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value }] },
      useEffect(fn) { if (!effects.length) effects.push(fn) },
    },
    'react/jsx-runtime': require('react/jsx-runtime'),
    'next/link': { default: 'a' },
    '../../lib/supabase': { supabase: { auth: { async getSession() { return { data: { session: { access_token: 'test-token' } } } } } } },
    '../../lib/interviewPackExport': { async downloadPackPdf(...args) { downloads.push(args) }, packToText(...args) { texts.push(args); return 'Readable guidance' } },
  }
  const mod = { exports: {} }
  new Function('module', 'exports', 'require', outputText)(mod, mod.exports, name => { assert.ok(name in deps, name); return deps[name] })
  const calls = []
  global.fetch = async (url, options) => { calls.push([url, options]); return fetcher(url, options) }
  global.confirm = () => true
  function render() { cursor = 0; return mod.exports.InterviewPackLibrary() }
  function nodes(tree) { return React.isValidElement(tree) ? [tree, ...React.Children.toArray(tree.props.children).flatMap(nodes)] : [] }
  async function click(label) { const button = nodes(render()).find(n => n.type === 'button' && n.props.children === label); assert.ok(button, label); await button.props.onClick(); await flush() }
  const flush = () => new Promise(resolve => setImmediate(resolve))
  render()
  return { async start() { effects[0](); await flush() }, render, nodes, click, calls, downloads, texts }
}

const response = data => ({ ok: true, status: 200, async json() { return data } })

test('saved library lists, views, exports PDF with saved context, and deletes', async () => {
  const h = harness((url, options) => response(options.method === 'DELETE' ? null : url.endsWith('/pack-1') ? { ...summary, pack } : [summary]))
  await h.start()
  await h.click('View pack')
  h.render()
  assert.deepEqual(h.texts.at(-1), [pack, { jobTitle: 'Analyst', companyName: 'Example', interviewType: 'Technical' }])
  await h.click('Close')
  await h.click('Download PDF')
  assert.deepEqual(h.downloads[0], [pack, { jobTitle: 'Analyst', companyName: 'Example', interviewType: 'Technical' }])
  await h.click('Delete')
  assert.ok(!h.nodes(h.render()).some(n => n.type === 'button' && n.props.children === 'View pack'))
  assert.equal(h.calls.at(-1)[1].method, 'DELETE')
  for (const [, options] of h.calls) assert.equal(options.headers.Authorization, 'Bearer test-token')
})

test('failed deletion keeps the library item and displays an error', async () => {
  const h = harness((url, options) => options.method === 'DELETE' ? { ok: false, status: 500 } : response([summary]))
  await h.start(); await h.click('Delete')
  const nodes = h.nodes(h.render())
  assert.ok(nodes.some(n => n.props.role === 'alert'))
  assert.ok(nodes.some(n => n.type === 'button' && n.props.children === 'View pack'))
})
