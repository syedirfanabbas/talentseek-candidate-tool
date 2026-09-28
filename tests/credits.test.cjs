const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const { outputText } = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '..', 'lib/credits.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
})
const credits = { exports: {} }
new Function('module', 'exports', outputText)(credits, credits.exports)
const { outOfCreditsMessage, errorDetail } = credits.exports

test('402 with insufficient_credits shows the backend message', () => {
  const body = { detail: { code: 'insufficient_credits', credit_type: 'resume_optimization', message: 'You have used all of your resume optimizations. Buy a pack to continue.' } }
  assert.equal(outOfCreditsMessage(402, body), body.detail.message)
})

test('402 without a structured body still reports missing credits', () => {
  assert.equal(outOfCreditsMessage(402, null), 'You have used all of your credits. Buy a pack to continue.')
})

test('other statuses are not treated as missing credits', () => {
  assert.equal(outOfCreditsMessage(429, { detail: 'Daily limit reached' }), null)
  assert.equal(outOfCreditsMessage(502, null), null)
})

test('errorDetail handles string, structured and missing details', () => {
  assert.equal(errorDetail({ detail: 'Try again' }, 'fallback'), 'Try again')
  assert.equal(errorDetail({ detail: { message: 'Structured' } }, 'fallback'), 'Structured')
  assert.equal(errorDetail(null, 'fallback'), 'fallback')
})
