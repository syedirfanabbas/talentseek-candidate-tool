const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const { jsPDF } = require('jspdf')
const { Packer } = require('docx')
const output = ts.transpileModule(fs.readFileSync('lib/resumeLayout.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText
const drawn = []
class RecordedPdf extends jsPDF {
  constructor(options) {
    super(options)
    const original = this.text.bind(this)
    this.text = (text, x, y, ...args) => {
      drawn.push({ text, page: this.getNumberOfPages(), style: this.getFont().fontStyle, size: this.getFontSize(), color: this.getTextColor() })
      return original(text, x, y, ...args)
    }
  }
}
const mod = { exports: {} }
new Function('module', 'exports', 'require', output)(mod, mod.exports, name => name === 'jspdf' ? RecordedPdf : require(name))
const { classifyLine, createResumePdf, createResumeDocx } = mod.exports
const classify = (section, entry) => {
  const lines = ['', 'Jordan Avery', 'Vancouver | jordan@example.test', '', section, entry]
  return classifyLine(entry, 5, lines).type
}
test('qualification, skill and personal entries share one classification regardless of dates or pipes', () => {
  for (const section of ['EDUCATION', 'CERTIFICATIONS', 'PROFESSIONAL DEVELOPMENT', 'SKILLS', 'PERSONAL DETAILS', 'CERTIFICATIONS AND COURSES']) {
    for (const entry of ['FoodSafe Level 1 (2024)', 'Google Project Management Certificate (2025)', 'C Accountants of BC | 2021', 'September 2024 – Present', 'SQL', 'Excel | SQL | Python']) {
      assert.equal(classify(section, entry), 'entry', `${section}: ${entry}`)
    }
  }
  assert.equal(classify('PROFESSIONAL EXPERIENCE', 'September 2024 – Present'), 'job-date')
  assert.equal(classify('PROFESSIONAL EXPERIENCE', '2021 - 2023'), 'job-date')
  assert.equal(classify('PROFESSIONAL EXPERIENCE', 'Granville Event Hall | Weekend Event Host'), 'job-header')
})
test('PDF entries use regular black type and real job dates retain italic styling', () => {
  drawn.length = 0
  createResumePdf('Jordan Avery\nVancouver | jordan@example.test\nCERTIFICATIONS\nFoodSafe Level 1 (2024)\nGoogle Project Management Certificate (2025)\nC Accountants of BC | 2021\nPROFESSIONAL EXPERIENCE\nGranville Event Hall | Weekend Event Host\nSeptember 2024 – Present\n- Welcomed guests.')
  for (const text of ['FoodSafe Level 1 (2024)', 'Google Project Management Certificate (2025)', 'C Accountants of BC | 2021']) { assert.equal(drawn.find(row => row.text === text).style, 'normal'); assert.equal(drawn.find(row => row.text === text).color, '#000000') }
  assert.equal(drawn.find(row => row.text === 'September 2024 – Present').style, 'italic')
})
test('PDF keeps section headings and job headers with their first content across page boundaries', () => {
  // Try every boundary position, including the job-header and section cases.
  for (let count = 30; count < 65; count++) {
    drawn.length = 0
    createResumePdf(['Sam Rivera', 'Vancouver | sam@example.test', 'SUMMARY', ...Array(count).fill('A sufficiently long summary sentence.'), 'EDUCATION', 'Bachelor of Business Administration', 'PROFESSIONAL EXPERIENCE', 'Northshore Logistics | Operations Coordinator', 'September 2024 – Present', '- Coordinated a team of eight.'].join('\n'), 100)
    const page = text => drawn.find(row => row.text === text).page
    assert.equal(page('EDUCATION'), page('Bachelor of Business Administration'))
    assert.equal(page('PROFESSIONAL EXPERIENCE'), page('Northshore Logistics | Operations Coordinator'))
    assert.equal(page('Northshore Logistics | Operations Coordinator'), page('September 2024 – Present'))
    assert.equal(page('September 2024 – Present'), page('•  Coordinated a team of eight.'))
  }
})
test('Word entries have consistent regular formatting, with keep-next chains for section/job headers', async () => {
  const text = ['Jordan Avery', 'Vancouver | jordan@example.test', 'CERTIFICATIONS', 'FoodSafe Level 1 (2024)', 'Google Project Management Certificate (2025)', 'C Accountants of BC | 2021', 'PROFESSIONAL EXPERIENCE', 'Granville Event Hall | Weekend Event Host', 'September 2024 – Present', '- Welcomed guests.'].join('\n')
  const doc = createResumeDocx(text)
  // docx's compiler exposes the paragraph XML without relying on a Word install.
  const archive = await Packer.toBuffer(doc)
  assert.ok(archive.length > 0)
  const { docxParagraphs } = mod.exports
  const context = { file: doc, stack: [] }
  const xml = docxParagraphs(text, 1).map(p => p.prepForXml(context))
  const serialized = xml.map(p => JSON.stringify(p))
  for (const i of [3, 4, 5]) {
    assert.ok(!serialized[i].includes('w:i'))
    assert.ok(serialized[i].includes('"w:val":false')) // explicitly non-bold
  }
  for (const i of [2, 6, 7, 8]) assert.ok(serialized[i].includes('w:keepNext'))
  assert.ok(serialized[8].includes('w:i'))
})
