// Unbranded resume PDF/Word exports with a measured page-length fit.
import { AlignmentType, BorderStyle, Document, Packer, Paragraph, TextRun } from 'docx'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'

export type LineType = 'name' | 'contact' | 'section' | 'job-date' | 'job-header' | 'entry' | 'bullet' | 'skills' | 'empty' | 'text'
const ENTRY_SECTIONS = /^(?:EDUCATION(?: (?:&|AND) (?:CERTIFICATIONS?|TRAINING))?|CERTIFICATIONS?(?: (?:&|AND) (?:COURSES|TRAINING))?|CERTIFICATES?|PROFESSIONAL DEVELOPMENT|(?:TECHNICAL |CORE |KEY )?SKILLS|PERSONAL DETAILS)$/
const EXPERIENCE_SECTIONS = /^(?:(?:PROFESSIONAL|WORK|RELEVANT|ADDITIONAL|EARLIER|OTHER) EXPERIENCE|EXPERIENCE|EMPLOYMENT HISTORY|WORK HISTORY|CAREER HISTORY)$/
const KNOWN_HEADINGS = /^(?:SUMMARY|PROFESSIONAL SUMMARY|PROFILE|PROFESSIONAL PROFILE|CAREER OBJECTIVE|OBJECTIVE|CORE COMPETENCIES|COMPETENCIES|ACHIEVEMENTS|PROJECTS|LANGUAGES|VOLUNTEER EXPERIENCE|INTERESTS|REFERENCES)$/
const uppercaseHeading = (text: string) => /^[A-Z][A-Z\s&/()]{3,}$/.test(text)
const normalizeHeading = (text: string) => text.trim().replace(/:$/, '')
function heading(text: string, section: string): boolean {
  const t = normalizeHeading(text)
  // Uppercase qualifications/skills within an entry section are entries, too.
  return ENTRY_SECTIONS.test(t) || EXPERIENCE_SECTIONS.test(t) || KNOWN_HEADINGS.test(t) || (!ENTRY_SECTIONS.test(section) && uppercaseHeading(t))
}
function sectionAt(lines: string[], index: number): string {
  let section = ''
  const contactIndex = lines.map((line, i) => line.trim() ? i : -1).filter(i => i >= 0)[1] ?? -1
  for (let i = contactIndex + 1; i < index; i++) if (heading(lines[i].trim(), section)) section = normalizeHeading(lines[i])
  return section
}
const DATE_RANGE = /^(?:(?:[A-Za-z]+\.?\s+|\d{1,2}[/.])?(?:19|20)\d{2}|\[start date\?\])\s*(?:[-–—]|to)\s*(?:(?:[A-Za-z]+\.?\s+|\d{1,2}[/.])?(?:19|20)\d{2}|Present|Current|\[end date\?\])$/i
export function classifyLine(line: string, lineIndex: number, allLines: string[]): { type: LineType; text: string } {
  const text = line.trim()
  if (!text) return { type: 'empty', text: '' }
  const nonEmpty = allLines.map((l, i) => l.trim() ? i : -1).filter(i => i >= 0)
  if (lineIndex === nonEmpty[0]) return { type: 'name', text }
  if (lineIndex === nonEmpty[1]) return { type: 'contact', text }
  const section = sectionAt(allLines, lineIndex)
  if (heading(text, section)) return { type: 'section', text: normalizeHeading(text) }
  if (ENTRY_SECTIONS.test(section)) return { type: 'entry', text }
  if (/^[-•]\s+/.test(text)) return { type: 'bullet', text: text.replace(/^[-•]\s+/, '') }
  if (EXPERIENCE_SECTIONS.test(section)) return { type: DATE_RANGE.test(text) ? 'job-date' : 'job-header', text }
  if ((text.match(/\|/g) || []).length >= 2) return { type: 'skills', text }
  return { type: 'text', text }
}

export type Fit = { scale: number; margin: number }
const FITS: Fit[] = [{ scale: 1, margin: 60 }, { scale: 1, margin: 48 }, { scale: 0.95, margin: 44 }, { scale: 0.92, margin: 40 }, { scale: 0.88, margin: 36 }, { scale: 0.85, margin: 36 }]
type Measure = { pages: number; lastPageFill: number }
function classified(content: string) {
  const lines = content.split('\n')
  return lines.map((line, i) => classifyLine(line, i, lines))
}
type Classified = ReturnType<typeof classified>
const jobHeader = (type: LineType) => type === 'job-header' || type === 'job-date'
// Section + first entry, or company/title/dates + first bullet. Blank paragraphs
// between them are included so they cannot defeat the keep-with-next chain.
function groupEnd(lines: Classified, start: number): number {
  let i = start + 1
  while (i < lines.length && lines[i].type === 'empty') i++
  if (i >= lines.length || lines[i].type === 'section') return start
  if (jobHeader(lines[start].type) || (lines[start].type === 'section' && jobHeader(lines[i].type))) {
    while (i < lines.length && (jobHeader(lines[i].type) || lines[i].type === 'empty')) i++
    return i < lines.length && lines[i].type === 'bullet' ? i : i - 1
  }
  return i
}

/** The exact same wrapped heights are used for fitting and drawing. */
function layout(doc: jsPDF, content: string, fit: Fit, draw: boolean): Measure {
  const { scale: s, margin } = fit
  const pageW = doc.internal.pageSize.getWidth(), pageH = doc.internal.pageSize.getHeight()
  const maxW = pageW - margin * 2, available = pageH - margin * 2
  const lines = classified(content)
  const plans = lines.map(({ type, text }) => {
    const style = type === 'name' || type === 'section' || type === 'job-header' || (type === 'text' && /^[A-Z]/.test(text) && text.length < 80 && !text.endsWith('.')) ? 'bold' : type === 'job-date' ? 'italic' : 'normal'
    const size = (type === 'name' ? 18 : type === 'section' ? 11 : type === 'contact' || type === 'job-date' ? 9 : type === 'skills' ? 9.5 : 10) * s
    const color: [number, number, number] = type === 'name' || type === 'section' ? [30, 58, 95] : type === 'contact' ? [80, 80, 80] : type === 'job-date' ? [100, 100, 100] : [0, 0, 0]
    doc.setFont('helvetica', style); doc.setFontSize(size)
    const rows = type === 'empty' ? [] : doc.splitTextToSize(type === 'bullet' ? '•  ' + text : text, maxW - (type === 'bullet' ? 15 : 0)) as string[]
    const lineHeight = (type === 'name' ? 24 : type === 'section' ? 14 : type === 'bullet' || type === 'contact' ? 13 : 14) * s
    const before = type === 'section' ? 10 * s : 0
    const after = (type === 'empty' ? 5 : type === 'section' ? 4 : type === 'contact' ? 5 : 0) * s
    return { type, rows, style, size, color, lineHeight, before, after, height: before + rows.length * lineHeight + after }
  })
  let y = margin, pages = 1
  const ensure = (height: number) => { if (y + height > pageH - margin) { if (draw) doc.addPage(); pages++; y = margin } }
  plans.forEach((plan, index) => {
    if (plan.type === 'section' || (jobHeader(plan.type) && !jobHeader(lines[index - 1]?.type))) {
      const end = groupEnd(lines, index)
      let height = plans.slice(index, end + 1).reduce((sum, item) => sum + item.height, 0)
      // For an unusually long first entry/bullet, keep its first rendered line
      // with the header instead of forcing an oversized group off every page.
      if (height > available && end > index) height -= plans[end].height - plans[end].before - plans[end].lineHeight
      if (height <= available) ensure(height)
    }
    if (plan.type === 'empty') { y += plan.after; return }
    ensure(plan.before + plan.lineHeight)
    y += plan.before
    doc.setFont('helvetica', plan.style); doc.setFontSize(plan.size); doc.setTextColor(...plan.color)
    plan.rows.forEach((row, rowIndex) => {
      ensure(plan.lineHeight)
      if (draw) doc.text(row, margin + (plan.type === 'bullet' && rowIndex > 0 ? 10 : 0), y)
      y += plan.lineHeight
    })
    if (draw && plan.type === 'section') { doc.setDrawColor(30, 58, 95); doc.setLineWidth(0.75); doc.line(margin, y - plan.lineHeight + 4 * s, pageW - margin, y - plan.lineHeight + 4 * s) }
    y += plan.after
  })
  return { pages, lastPageFill: (y - margin) / available }
}
function measure(content: string, fit: Fit): Measure { return layout(new jsPDF({ unit: 'pt', format: 'letter' }), content, fit, false) }
export function chooseFit(content: string, targetPages?: number | null): Fit {
  let target = targetPages ?? null
  if (target === null) { const natural = measure(content, FITS[0]); if (natural.pages <= 1 || natural.lastPageFill > 0.35) return FITS[0]; target = natural.pages - 1 }
  return FITS.find(fit => measure(content, fit).pages <= target!) ?? FITS[FITS.length - 1]
}
export function pageCount(content: string, fit: Fit): number { return measure(content, fit).pages }
export function createResumePdf(content: string, targetPages?: number | null): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  layout(doc, content, chooseFit(content, targetPages), true)
  return doc
}
export function downloadResumePdf(content: string, filename: string, targetPages?: number | null): void { createResumePdf(content, targetPages).save(`${filename}.pdf`) }
export function docxParagraphs(content: string, s: number): Paragraph[] {
  const half = (pt: number) => Math.round(pt * 2 * s), tw = (value: number) => Math.round(value * s)
  const lines = classified(content), keep = new Set<number>()
  lines.forEach((line, i) => { if (line.type === 'section' || jobHeader(line.type)) for (let j = i; j < groupEnd(lines, i); j++) keep.add(j) })
  return lines.map(({ type, text }, i) => {
    const common = { keepNext: keep.has(i), keepLines: true }
    if (type === 'empty') return new Paragraph({ ...common, children: [], spacing: { after: tw(40) } })
    if (type === 'name') return new Paragraph({ ...common, children: [new TextRun({ text, bold: true, size: half(18), font: 'Calibri', color: '1E3A5F' })], alignment: AlignmentType.LEFT, spacing: { after: tw(40) } })
    if (type === 'contact') return new Paragraph({ ...common, children: [new TextRun({ text, size: half(9), font: 'Calibri', color: '555555' })], spacing: { after: tw(120) } })
    if (type === 'section') return new Paragraph({ ...common, children: [new TextRun({ text, bold: true, size: half(11), font: 'Calibri', color: '1E3A5F' })], spacing: { before: tw(240), after: tw(80) }, border: { bottom: { color: '1E3A5F', size: 6, space: 1, style: BorderStyle.SINGLE } } })
    if (type === 'job-date') return new Paragraph({ ...common, children: [new TextRun({ text, size: half(9), font: 'Calibri', color: '666666', italics: true })], spacing: { after: tw(60) } })
    if (type === 'bullet') return new Paragraph({ ...common, children: [new TextRun({ text, size: half(9.5), font: 'Calibri' })], bullet: { level: 0 }, spacing: { after: tw(60) }, indent: { left: 360 } })
    const bold = type === 'job-header' || (type === 'text' && /^[A-Z]/.test(text) && text.length < 80 && !text.endsWith('.'))
    return new Paragraph({ ...common, children: [new TextRun({ text, size: half(type === 'skills' ? 9.5 : 10), font: 'Calibri', bold })], spacing: { after: tw(60) } })
  })
}
export function createResumeDocx(content: string, targetPages?: number | null): Document {
  const fit = chooseFit(content, targetPages), margin = Math.round(fit.margin * 20)
  return new Document({ sections: [{ properties: { page: { margin: { top: Math.round(margin * 0.8), bottom: Math.round(margin * 0.8), left: margin, right: margin } } }, children: docxParagraphs(content, fit.scale) }] })
}
export async function downloadResumeDocx(content: string, filename: string, targetPages?: number | null): Promise<void> { saveAs(await Packer.toBlob(createResumeDocx(content, targetPages)), `${filename}.docx`) }
