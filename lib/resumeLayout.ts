// Resume PDF and Word downloads that respect the page length the candidate chose.
//
// The AI writes to a word budget, but the downloaded file's length depends on our
// fonts, spacing and margins. So before saving, the PDF layout is measured at a
// few progressively tighter settings and the first one that fits the target is
// used (body text never below ~8.5 pt). The Word file uses the same setting;
// Calibri is narrower than the PDF's Helvetica, so a fitting PDF means a fitting
// Word file.
import { AlignmentType, BorderStyle, Document, Packer, Paragraph, TextRun } from 'docx'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'

export type LineType = 'name' | 'contact' | 'section' | 'job-date' | 'bullet' | 'skills' | 'empty' | 'text'

export function classifyLine(line: string, lineIndex: number, allLines: string[]): { type: LineType; text: string } {
  const trimmed = line.trim()
  if (!trimmed) return { type: 'empty', text: '' }
  const firstNonEmpty = allLines.findIndex(l => l.trim())
  if (lineIndex === firstNonEmpty) return { type: 'name', text: trimmed }
  let count = 0
  for (let i = 0; i < allLines.length; i++) {
    if (allLines[i].trim()) {
      count++
      if (count === 2 && i === lineIndex) return { type: 'contact', text: trimmed }
    }
  }
  if (/^[A-Z][A-Z\s&/()]{3,}$/.test(trimmed)) return { type: 'section', text: trimmed }
  if (trimmed.startsWith('- ')) return { type: 'bullet', text: trimmed.slice(2).trim() }
  if ((trimmed.match(/\|/g) || []).length >= 2) return { type: 'skills', text: trimmed }
  if (/\d{4}/.test(trimmed) && trimmed.length < 40) return { type: 'job-date', text: trimmed }
  return { type: 'text', text: trimmed }
}

export type Fit = { scale: number; margin: number } // margin in points
const FITS: Fit[] = [
  { scale: 1, margin: 60 },
  { scale: 1, margin: 48 },
  { scale: 0.95, margin: 44 },
  { scale: 0.92, margin: 40 },
  { scale: 0.88, margin: 36 },
  { scale: 0.85, margin: 36 },
]

type Measure = { pages: number; lastPageFill: number }

/** Lay the resume out on `doc`; when `draw` is false only measures. */
function layout(doc: jsPDF, content: string, fit: Fit, draw: boolean): Measure {
  const { scale: s, margin } = fit
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const maxW = pageW - margin * 2
  let y = margin
  let pages = 1
  const ensure = (n: number) => { if (y + n > pageH - margin) { if (draw) doc.addPage(); pages++; y = margin } }
  const text = (t: string, x: number) => { if (draw) doc.text(t, x, y) }

  const lines = content.split('\n')
  lines.forEach((line, i) => {
    const { type, text: t } = classifyLine(line, i, lines)
    if (type === 'empty') { y += 5 * s; return }
    if (type === 'name') {
      ensure(32 * s)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(18 * s); doc.setTextColor(30, 58, 95)
      text(t, margin); y += 24 * s; doc.setTextColor(0, 0, 0)
    } else if (type === 'contact') {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9 * s); doc.setTextColor(80, 80, 80)
      for (const l of doc.splitTextToSize(t, maxW) as string[]) { ensure(14 * s); text(l, margin); y += 13 * s }
      y += 5 * s; doc.setTextColor(0, 0, 0)
    } else if (type === 'section') {
      ensure(28 * s); y += 10 * s
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11 * s); doc.setTextColor(30, 58, 95)
      text(t.toUpperCase(), margin); y += 4 * s
      if (draw) { doc.setDrawColor(30, 58, 95); doc.setLineWidth(0.75); doc.line(margin, y, pageW - margin, y) }
      y += 14 * s
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10 * s); doc.setTextColor(0, 0, 0)
    } else if (type === 'job-date') {
      ensure(14 * s)
      doc.setFont('helvetica', 'italic'); doc.setFontSize(9 * s); doc.setTextColor(100, 100, 100)
      text(t, margin); y += 14 * s
      doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0)
    } else if (type === 'skills') {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5 * s)
      for (const l of doc.splitTextToSize(t, maxW) as string[]) { ensure(14 * s); text(l, margin); y += 14 * s }
    } else if (type === 'bullet') {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10 * s)
      ;(doc.splitTextToSize('•  ' + t, maxW - 15) as string[]).forEach((l, idx) => {
        ensure(13 * s); text(l, margin + (idx === 0 ? 0 : 10)); y += 13 * s
      })
    } else {
      const isBold = /^[A-Z]/.test(t) && t.length < 80 && !t.endsWith('.')
      doc.setFont('helvetica', isBold ? 'bold' : 'normal'); doc.setFontSize(10 * s)
      for (const l of doc.splitTextToSize(t, maxW) as string[]) { ensure(14 * s); text(l, margin); y += 14 * s }
    }
  })
  return { pages, lastPageFill: (y - margin) / (pageH - margin * 2) }
}

function measure(content: string, fit: Fit): Measure {
  return layout(new jsPDF({ unit: 'pt', format: 'letter' }), content, fit, false)
}

/**
 * The most generous layout that fits `targetPages`. Without a target (e.g. a saved
 * resume whose chosen length isn't known), only avoids a nearly empty last page.
 */
export function chooseFit(content: string, targetPages?: number | null): Fit {
  let target = targetPages ?? null
  if (target === null) {
    const natural = measure(content, FITS[0])
    if (natural.pages <= 1 || natural.lastPageFill > 0.35) return FITS[0]
    target = natural.pages - 1
  }
  return FITS.find(fit => measure(content, fit).pages <= target!) ?? FITS[FITS.length - 1]
}

export function pageCount(content: string, fit: Fit): number {
  return measure(content, fit).pages
}

export function downloadResumePdf(content: string, filename: string, targetPages?: number | null): void {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  layout(doc, content, chooseFit(content, targetPages), true)
  doc.save(`${filename}.pdf`)
}

function docxParagraphs(content: string, s: number): Paragraph[] {
  const half = (pt: number) => Math.round(pt * 2 * s) // docx sizes are half-points
  const tw = (twips: number) => Math.round(twips * s)
  const lines = content.split('\n')
  return lines.map((line, i) => {
    const { type, text } = classifyLine(line, i, lines)
    if (type === 'empty') return new Paragraph({ children: [], spacing: { after: tw(40) } })
    if (type === 'name') return new Paragraph({ children: [new TextRun({ text, bold: true, size: half(18), font: 'Calibri', color: '1E3A5F' })], alignment: AlignmentType.LEFT, spacing: { after: tw(40) } })
    if (type === 'contact') return new Paragraph({ children: [new TextRun({ text, size: half(9), font: 'Calibri', color: '555555' })], spacing: { after: tw(120) } })
    if (type === 'section') return new Paragraph({ children: [new TextRun({ text: text.toUpperCase(), bold: true, size: half(11), font: 'Calibri', color: '1E3A5F' })], spacing: { before: tw(240), after: tw(80) }, border: { bottom: { color: '1E3A5F', size: 6, space: 1, style: BorderStyle.SINGLE } } })
    if (type === 'skills') {
      const parts = text.split('|').map(part => part.trim())
      return new Paragraph({ children: parts.flatMap((part, idx) => [new TextRun({ text: part, size: half(9.5), font: 'Calibri' }), ...(idx < parts.length - 1 ? [new TextRun({ text: '  |  ', size: half(9.5), font: 'Calibri', color: '888888' })] : [])]), spacing: { after: tw(60) } })
    }
    if (type === 'job-date') return new Paragraph({ children: [new TextRun({ text, size: half(9), font: 'Calibri', color: '666666', italics: true })], spacing: { after: tw(60) } })
    if (type === 'bullet') return new Paragraph({ children: [new TextRun({ text, size: half(9.5), font: 'Calibri' })], bullet: { level: 0 }, spacing: { after: tw(60) }, indent: { left: 360 } })
    const isBold = /^[A-Z]/.test(text) && text.length < 80 && !text.endsWith('.')
    return new Paragraph({ children: [new TextRun({ text, size: half(10), font: 'Calibri', bold: isBold })], spacing: { after: tw(60) } })
  })
}

export async function downloadResumeDocx(content: string, filename: string, targetPages?: number | null): Promise<void> {
  const fit = chooseFit(content, targetPages)
  const margin = Math.round(fit.margin * 20) // points to twips
  const doc = new Document({ sections: [{ properties: { page: { margin: { top: Math.round(margin * 0.8), bottom: Math.round(margin * 0.8), left: margin, right: margin } } }, children: docxParagraphs(content, fit.scale) }] })
  saveAs(await Packer.toBlob(doc), `${filename}.docx`)
}
