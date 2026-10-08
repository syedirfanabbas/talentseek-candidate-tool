const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const React = require('react')
function load(file, deps = {}) {
  const mod = { exports: {} }
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText
  new Function('module', 'exports', 'require', output)(mod, mod.exports, name => deps[name] || require(name))
  return mod.exports
}
function harness(t, search) {
  const states = [], effects = [], calls = []
  let cursor = 0, captureCalls = 0
  const touch = { source: 'whatsapp', medium: 'group', campaign: 'szabist', referrer_domain: '', captured_at: '2026-10-08T12:00:00.000Z' }
  const deps = {
    react: { useState(initial) { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = value }] }, useRef: () => ({ current: null }), useEffect: effect => effects.push(effect) },
    '../../lib/supabase': { supabase: { auth: { async signUp(args) { calls.push(['signup', args]); return { data: { user: { identities: [{}] }, session: null } } }, async signInWithPassword(args) { calls.push(['login', args]); return { data: { user: {} } } } } } },
    '../../lib/signupSource': { getBrowserSignupSource() { captureCalls++; return touch } },
    '../../lib/navigation': load('lib/navigation.ts'), '../../lib/authErrors': load('lib/authErrors.ts'), '../../lib/legal': load('lib/legal.ts'),
  }
  const oldWindow = global.window
  global.window = { location: { search, origin: 'https://app.talentseek.ca', replace() {} } }
  t.after(() => { global.window = oldWindow })
  const Page = load('app/auth/page.tsx', deps).default
  const render = () => { cursor = 0; return Page() }
  const nodes = tree => React.isValidElement(tree) ? [tree, ...React.Children.toArray(tree.props.children).flatMap(nodes)] : []
  const find = predicate => nodes(render()).find(predicate)
  render(); effects.slice().forEach(effect => effect())
  return { calls, touch, find, captures: () => captureCalls }
}
test('marketing signup link opens Create Account and stores source only in signUp metadata', async t => {
  const h = harness(t, '?mode=register&utm_source=whatsapp')
  h.find(n => n.type === 'input' && n.props.placeholder === 'John Smith').props.onChange({ target: { value: 'Test Candidate' } })
  h.find(n => n.type === 'input' && n.props.type === 'email').props.onChange({ target: { value: 'test@example.test' } })
  h.find(n => n.type === 'input' && n.props.type === 'password').props.onChange({ target: { value: 'synthetic-password' } })
  await h.find(n => n.type === 'button' && n.props.className.startsWith('mt-6')).props.onClick()
  assert.equal(h.calls[0][0], 'signup')
  assert.deepEqual(h.calls[0][1].options.data.signup_source, h.touch)
  assert.equal(h.calls[0][1].options.data.account_type, 'candidate')
})
test('existing user sign-in does not capture or update account attribution', async t => {
  const h = harness(t, '')
  h.find(n => n.type === 'input' && n.props.type === 'email').props.onChange({ target: { value: 'test@example.test' } })
  h.find(n => n.type === 'input' && n.props.type === 'password').props.onChange({ target: { value: 'synthetic-password' } })
  await h.find(n => n.type === 'button' && n.props.className.startsWith('mt-6')).props.onClick()
  assert.equal(h.calls[0][0], 'login'); assert.equal(h.captures(), 0)
  assert.equal(h.calls[0][1].options, undefined)
})
