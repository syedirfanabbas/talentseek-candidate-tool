const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const React = require('react')
const { File } = require('node:buffer')

function load(relative, deps = {}) {
  const mod = { exports: {} }
  const { outputText } = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', relative), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  })
  new Function('module', 'exports', 'require', outputText)(mod, mod.exports, name => deps[name] || require(name))
  return mod.exports
}
const inputRules = load('lib/masterResumeInputs.ts')
function harness(t, saveOk = true) {
  const states = [], effects = [], calls = [], navigations = []
  let cursor = 0
  const deps = {
    react: { useState(initial) { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value }] }, useEffect(fn) { if (!effects.length) effects.push(fn) } },
    '../components/MasterResumeUpdates': { MasterResumeUpdates: 'updates' },
    '../components/LoadingSpinner': { LoadingSpinner: 'spinner' },
    '../components/AiProcessingNotice': { AiProcessingNotice: 'notice' },
    '../../lib/masterResumeInputs': inputRules,
    '../../lib/supabase': { supabase: { auth: { async getSession() { return { data: { session: { access_token: 'test-token' } } } } } } },
    '../../lib/apiError': { apiErrorMessage(data, fallback) { return fallback } },
    '../../lib/retryAdvice': { withRetryAdvice: text => text },
    docx: {}, 'file-saver': {}, jspdf: {},
  }
  const previousFetch = global.fetch, previousWindow = global.window
  t.after(() => { global.fetch = previousFetch; global.window = previousWindow })
  global.window = { location: { search: '?start=update', assign: path => navigations.push(path) } }
  global.fetch = async (url, options = {}) => {
    calls.push([url, options])
    const data = url.endsWith('/parse-demo') ? { text: 'Old resume' } : url.endsWith('/consolidate-demo') ? { master_resume: 'Reviewed master result' } : null
    return { ok: options.method === 'PUT' ? saveOk : true, async json() { return data } }
  }
  const Page = load('app/master-resume/page.tsx', deps).default
  const render = () => { cursor = 0; return Page() }
  const nodes = tree => React.isValidElement(tree) ? [tree, ...React.Children.toArray(tree.props.children).flatMap(nodes)] : []
  const find = predicate => nodes(render()).find(predicate)
  const flush = () => new Promise(resolve => setImmediate(resolve))
  render()
  return { calls, navigations, render, nodes, find, async start() { effects[0](); await flush() }, async upload() { const input = find(n => n.type === 'input' && n.props.type === 'file'); await input.props.onChange({ target: { files: [new File(['old'], 'old.pdf')], value: 'old.pdf' } }); await flush() }, async build() { const button = find(n => n.type === 'button' && typeof n.props.children === 'string' && n.props.children.includes('Build Master Resume')); assert.equal(button.props.disabled, false); await button.props.onClick() }, async next() { find(n => n.type === 'button' && n.props.children === 'Next: tailor it to a job').props.onClick(); await flush() } }
}

test('update flow submits a resume plus typed note and Next saves only the generated master before leaving', async t => {
  const h = harness(t)
  await h.start(); await h.upload()
  const updates = h.find(n => n.type === 'updates')
  assert.equal(updates.props.updateFlow, true)
  updates.props.onChange('Engineer at Sample, 2024–Present, current')
  await h.build()
  const body = JSON.parse(h.calls.find(([url]) => url.endsWith('/consolidate-demo'))[1].body)
  assert.deepEqual(body.resumes, ['Old resume', inputRules.TYPED_UPDATE_PREFIX + 'Engineer at Sample, 2024–Present, current'])
  assert.ok(!h.calls.some(([, options]) => options.method === 'PUT'))
  await h.next()
  const saved = h.calls.find(([, options]) => options.method === 'PUT')
  assert.deepEqual(JSON.parse(saved[1].body), { content: 'Reviewed master result' })
  assert.deepEqual(h.navigations, ['/'])
})

test('a failed save prevents Next navigation and exposes an announced error', async t => {
  const h = harness(t, false)
  await h.start(); await h.upload()
  h.find(n => n.type === 'updates').props.onChange('New skill: SQL')
  await h.build(); await h.next()
  assert.deepEqual(h.navigations, [])
  assert.ok(h.nodes(h.render()).some(n => n.props.role === 'alert'))
})

test('whitespace-only notes keep Build disabled and show announced validation', async t => {
  const h = harness(t)
  await h.start(); await h.upload()
  h.find(n => n.type === 'updates').props.onChange(' \n\t ')
  assert.equal(h.find(n => n.type === 'button' && typeof n.props.children === 'string' && n.props.children.includes('Build Master Resume')).props.disabled, true)
  assert.ok(h.nodes(h.render()).some(n => n.props.role === 'status' && n.props['aria-live'] === 'polite'))
})
