const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

function load(relative, dependencies = {}) {
  const mod = { exports: {} }
  const { outputText } = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', relative), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  })
  new Function('module', 'exports', 'require', outputText)(mod, mod.exports, name => dependencies[name] || require(name))
  return mod.exports
}
const inputs = load('lib/masterResumeInputs.ts')
const { consolidationInputs, TYPED_UPDATE_PREFIX, MAX_UPDATE_CHARACTERS } = inputs
const file = { name: 'old.pdf', text: 'Analyst | Example | 2020–Present' }

test('one resume plus short notes forms the existing string-array API payload', () => {
  const result = consolidationInputs([file], '  Current: Engineer at Sample since 2024.  ')
  assert.equal(result.error, '')
  assert.deepEqual(result.inputs, [file.text, TYPED_UPDATE_PREFIX + 'Current: Engineer at Sample since 2024.'])
  assert.ok(result.inputs.every(value => typeof value === 'string'))
})
test('whitespace notes do not count and notes alone do not replace a resume', () => {
  assert.notEqual(consolidationInputs([file], ' \n\t ').error, '')
  assert.deepEqual(consolidationInputs([file, file], ' \n ').inputs, [file.text, file.text])
  assert.notEqual(consolidationInputs([], 'New role').error, '')
})
test('total-input and per-input caps include the typed update prefix', () => {
  assert.equal(consolidationInputs(Array(9).fill(file), 'new role').error, '')
  assert.notEqual(consolidationInputs(Array(10).fill(file), 'new role').error, '')
  assert.equal(consolidationInputs(Array(10).fill(file), ' ').error, '')
  assert.equal(consolidationInputs([file], 'x'.repeat(MAX_UPDATE_CHARACTERS)).error, '')
  assert.notEqual(consolidationInputs([file], 'x'.repeat(MAX_UPDATE_CHARACTERS + 1)).error, '')
  assert.notEqual(consolidationInputs([{ ...file, text: 'x'.repeat(30001) }, file], '').error, '')
})

test('update flow opens labelled notes with visible guidance and empty initial content', () => {
  const { MasterResumeUpdates } = load('app/components/MasterResumeUpdates.tsx', { '../../lib/masterResumeInputs': inputs })
  const html = renderToStaticMarkup(React.createElement(MasterResumeUpdates, { value: '', onChange() {}, updateFlow: true, disabled: false }))
  assert.match(html, /<details open=""/)
  assert.match(html, /for="career-updates"/)
  assert.match(html, /aria-describedby="career-updates-hints career-updates-privacy"/)
  assert.match(html, /You don’t need a second file/)
  assert.match(html, /held at the same time/)
  assert.match(html, /<textarea[^>]*><\/textarea>/)
  const direct = renderToStaticMarkup(React.createElement(MasterResumeUpdates, { value: '', onChange() {}, updateFlow: false, disabled: false }))
  assert.match(direct, /<summary/)
  assert.match(direct, /id="career-updates"/)
  assert.doesNotMatch(direct, /<details open/)
})
