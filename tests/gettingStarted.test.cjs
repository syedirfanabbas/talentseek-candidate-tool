const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const { outputText } = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '..', 'lib/gettingStarted.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
})
const mod = { exports: {} }
new Function('module', 'exports', 'require', outputText)(mod, mod.exports, require)
const { recommend, isComplete } = mod.exports

const r = (has_resume, need, experience = 'early') => recommend({ has_resume, need, experience })

test('no resume → interview prep plus the first-resume early-access offer, whatever the need', () => {
  for (const need of ['job', 'interview', 'improve', 'recruiter']) {
    assert.equal(r('none', need).href, '/interview-prep')
    assert.equal(r('none', need).firstResume, true)
  }
})

test('several versions → master resume, unless the need is an interview or a recruiter', () => {
  assert.equal(r('several', 'job').href, '/master-resume')
  assert.equal(r('several', 'improve').href, '/master-resume')
  assert.equal(r('several', 'interview').href, '/interview-prep')
  assert.equal(r('several', 'recruiter').href, '/billing#recruiter-support')
})

test('one resume routes by need', () => {
  for (const has of ['current', 'old']) {
    assert.equal(r(has, 'job').href, '/')
    assert.equal(r(has, 'improve').href, '/')
    assert.equal(r(has, 'interview').href, '/interview-prep')
    assert.equal(r(has, 'recruiter').href, '/billing#recruiter-support')
  }
})

test('experience does not change the route', () => {
  for (const experience of ['student', 'early', 'experienced']) assert.equal(r('current', 'job', experience).href, '/')
})

test('isComplete needs all three answers', () => {
  assert.equal(isComplete({ version: 1, has_resume: 'none', experience: 'student', need: 'job' }), true)
  assert.equal(isComplete({ version: 1, skipped_at: 'x' }), false)
  assert.equal(isComplete(null), false)
})
