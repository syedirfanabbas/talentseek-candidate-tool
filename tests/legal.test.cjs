const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const { outputText } = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '..', 'lib/legal.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
})
const legal = { exports: {} }
new Function('module', 'exports', outputText)(legal, legal.exports)
const { MARKETING_CONSENT_TEXT, MARKETING_CONSENT_VERSION, PRIVACY_URL, TERMS_URL } = legal.exports

// The backend records consent only for wording it has on file. This must match the row
// seeded in talentseek-app/supabase/migrations/014_marketing_consent.sql (and its test).
test('consent wording matches the version recorded by the backend', () => {
  assert.equal(MARKETING_CONSENT_VERSION, '2026-09-27')
  assert.equal(MARKETING_CONSENT_TEXT, 'Yes, email me job-search tips, product updates and offers from TalentSeek. I can unsubscribe at any time.')
})

test('consent wording names the sender and says consent can be withdrawn', () => {
  assert.match(MARKETING_CONSENT_TEXT, /TalentSeek/)
  assert.match(MARKETING_CONSENT_TEXT, /unsubscribe at any time/)
})

test('legal pages are served over HTTPS from the marketing site', () => {
  for (const url of [TERMS_URL, PRIVACY_URL]) assert.match(url, /^https:\/\/talentseek\.ca\/[a-z-]+\/$/)
})
