const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const source = fs.readFileSync('lib/matchScore.ts', 'utf8')
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
const mod = { exports: {} }
new Function('module', 'exports', output)(mod, mod.exports)
const { scoreSummary, savedScoreLabel } = mod.exports
test('match score display handles gains, no gain, and absent before score', () => {
  assert.equal(scoreSummary(54, 72), 'Match 54% → 72% (+18)')
  assert.equal(scoreSummary(72, 72), 'Match 72% → 72%')
  assert.equal(scoreSummary(undefined, 72), 'Match 72%')
})
test('saved score display omits null scores', () => {
  assert.equal(savedScoreLabel(54, 72), 'Match 54% → 72%')
  assert.equal(savedScoreLabel(null, 72), 'Match 72%')
  assert.equal(savedScoreLabel(null, null), null)
})
