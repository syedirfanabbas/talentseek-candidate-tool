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
const { recommend, isComplete, isSkipped } = mod.exports

const r = (has_resume, need, experience = 'early') => recommend({ has_resume, need, experience })

test('no resume → talk to a recruiter, plus registering interest in a first-resume builder, whatever the need', () => {
  for (const need of ['job', 'interview', 'improve', 'recruiter']) {
    assert.equal(r('none', need).href, '/billing#recruiter-support')
    assert.equal(r('none', need).firstResume, true)
  }
})

test('several versions → Tailor first, master resume optional; interview and recruiter keep precedence', () => {
  for (const need of ['job', 'improve']) {
    assert.equal(r('several', need).href, '/')
    assert.equal(r('several', need).skip.href, '/master-resume')
  }
  assert.equal(r('several', 'interview').href, '/interview-prep')
  assert.equal(r('several', 'recruiter').href, '/billing#recruiter-support')
})

test('one resume routes by need', () => {
  for (const has of ['current']) {
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

test('records with unknown values or versions are not trusted', () => {
  assert.equal(isComplete({ version: 1, has_resume: 'none', experience: 'student', need: 'hack' }), false)
  assert.equal(isComplete({ version: 2, has_resume: 'none', experience: 'student', need: 'job' }), false)
  assert.equal(isSkipped({ version: 1, skipped_at: '2026-10-07T00:00:00Z' }), true)
  assert.equal(isSkipped({ version: 1, skipped_at: 'x', has_resume: 'none', experience: 'student', need: 'job' }), false)
  assert.equal(isSkipped({ skipped_at: 'x' }), false)
})


test('old resume → Tailor first, with the master resume update flow as an option', () => {
  for (const experience of ['student', 'early', 'experienced']) {
    for (const need of ['job', 'improve']) {
      const result = r('old', need, experience)
      assert.equal(result.href, '/')
      assert.equal(result.destination, undefined)
      assert.equal(result.skip.href, '/master-resume?start=update')
      assert.ok(result.skip.note)
    }
    assert.equal(r('old', 'interview', experience).href, '/interview-prep')
    assert.equal(r('old', 'recruiter', experience).href, '/billing#recruiter-support')
  }
})
