const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const { outputText } = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '..', 'lib/booking.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
})
const mod = { exports: {} }
new Function('module', 'exports', outputText)(mod, mod.exports)
const { SESSION_BOOKING_PAGES, hasPaidSession } = mod.exports

test('booking pages are shown only after a paid strategy session', () => {
  assert.equal(hasPaidSession([{ product_key: 'recruiter_session', status: 'paid' }]), true)
  assert.equal(hasPaidSession([{ product_key: 'recruiter_session', status: 'pending' }]), false)
  assert.equal(hasPaidSession([{ product_key: 'recruiter_session', status: 'refunded' }]), false)
  assert.equal(hasPaidSession([{ product_key: 'written_review', status: 'paid' }]), false)
  assert.equal(hasPaidSession(undefined), false)
})

test('every booking page is an https Google Calendar link with a label', () => {
  assert.ok(SESSION_BOOKING_PAGES.length >= 1)
  for (const page of SESSION_BOOKING_PAGES) {
    assert.match(page.url, /^https:\/\/calendar\.app\.google\//)
    assert.ok(page.label.trim())
  }
})
