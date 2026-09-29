const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const { outputText } = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '..', 'lib/authErrors.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
})
const mod = { exports: {} }
new Function('module', 'exports', outputText)(mod, mod.exports)
const { isEmailNotConfirmed } = mod.exports

test('recognises Supabase unconfirmed-email errors by code or message', () => {
  assert.equal(isEmailNotConfirmed({ code: 'email_not_confirmed', message: 'x' }), true)
  assert.equal(isEmailNotConfirmed({ message: 'Email not confirmed' }), true)
})

test('other sign-in errors are not treated as unconfirmed email', () => {
  assert.equal(isEmailNotConfirmed({ code: 'invalid_credentials', message: 'Invalid login credentials' }), false)
  assert.equal(isEmailNotConfirmed(null), false)
  assert.equal(isEmailNotConfirmed(undefined), false)
})
