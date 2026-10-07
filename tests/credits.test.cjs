const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

function loadTsModule(fileName, dependencies = {}) {
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'lib', fileName), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  })
  const mod = { exports: {} }
  new Function('module', 'exports', 'require', outputText)(mod, mod.exports, (specifier) => {
    if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier]
    throw new Error(`Unexpected dependency: ${specifier}`)
  })
  return mod.exports
}

const apiError = loadTsModule('apiError.ts')
const { outOfCreditsMessage, errorDetail } = loadTsModule('credits.ts', { './apiError': apiError })

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
