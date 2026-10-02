// Export an interview-preparation pack as plain text, Word or PDF.
// Packs are not stored on our servers, so these are how a candidate keeps one.
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'

export type InterviewPack = {
  match_confidence: { score: number; label: string; summary: string }
  role_summary: string
  skills_to_demonstrate: string[]
  likely_questions: { question: string; category: string; answer_points: string[] }[]
  questions_to_ask: string[]
  checklist: string[]
}

export type PackContext = { jobTitle: string; companyName: string; interviewType: string }

type Block = { kind: 'title' | 'heading' | 'text' | 'bullet' | 'question' | 'footer'; text: string }

function packBlocks(pack: InterviewPack, context: PackContext): Block[] {
  const blocks: Block[] = [
    { kind: 'title', text: `Interview preparation: ${context.jobTitle} at ${context.companyName}` },
    { kind: 'text', text: `${context.interviewType} · Resume match ${pack.match_confidence.score}% (${pack.match_confidence.label})` },
    { kind: 'text', text: pack.match_confidence.summary },
    { kind: 'heading', text: 'What this role needs' },
    { kind: 'text', text: pack.role_summary },
    { kind: 'heading', text: 'Skills to demonstrate' },
    ...pack.skills_to_demonstrate.map(skill => ({ kind: 'bullet' as const, text: skill })),
    { kind: 'heading', text: 'Likely interview questions' },
  ]
  pack.likely_questions.forEach((item, index) => {
    blocks.push({ kind: 'question', text: `${index + 1}. ${item.question} (${item.category})` })
    item.answer_points.forEach(point => blocks.push({ kind: 'bullet', text: point }))
  })
  blocks.push({ kind: 'heading', text: 'Questions to ask' })
  pack.questions_to_ask.forEach((question, index) => blocks.push({ kind: 'text', text: `${index + 1}. ${question}` }))
  blocks.push({ kind: 'heading', text: 'Interview checklist' })
  pack.checklist.forEach(item => blocks.push({ kind: 'bullet', text: `☐ ${item}` }))
  blocks.push({ kind: 'footer', text: 'Created with TalentSeek · talentseek.ca' })
  return blocks
}

export function packFilename(context: PackContext, extension: string): string {
  const slug = `${context.jobTitle}-${context.companyName}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `interview-prep-${slug || 'pack'}.${extension}`
}

export function packToText(pack: InterviewPack, context: PackContext): string {
  return packBlocks(pack, context).map(block => {
    if (block.kind === 'title') return `${block.text.toUpperCase()}\n`
    if (block.kind === 'heading') return `\n${block.text.toUpperCase()}`
    if (block.kind === 'bullet') return block.text.startsWith('☐ ') ? `  ${block.text}` : `  • ${block.text}`
    if (block.kind === 'question' || block.kind === 'footer') return `\n${block.text}`
    return block.text
  }).join('\n')
}

export async function downloadPackDocx(pack: InterviewPack, context: PackContext): Promise<void> {
  const children = packBlocks(pack, context).map(block => {
    if (block.kind === 'title') return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(block.text)] })
    if (block.kind === 'heading') return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240 }, children: [new TextRun(block.text)] })
    if (block.kind === 'question') return new Paragraph({ spacing: { before: 160 }, children: [new TextRun({ text: block.text, bold: true })] })
    if (block.kind === 'bullet') return new Paragraph({ bullet: { level: 0 }, children: [new TextRun(block.text.replace(/^☐ /, ''))] })
    if (block.kind === 'footer') return new Paragraph({ spacing: { before: 360 }, children: [new TextRun({ text: block.text, italics: true, color: '64748B' })] })
    return new Paragraph({ children: [new TextRun(block.text)] })
  })
  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 1080, right: 1080 } } }, children }] })
  saveAs(await Packer.toBlob(doc), packFilename(context, 'docx'))
}

export function downloadPackPdf(pack: InterviewPack, context: PackContext): void {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const margin = 56
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const maxW = pageW - margin * 2
  let y = margin
  const write = (text: string, size: number, style: 'normal' | 'bold', indent = 0, gapBefore = 0) => {
    y += gapBefore
    doc.setFont('helvetica', style); doc.setFontSize(size)
    for (const line of doc.splitTextToSize(text, maxW - indent) as string[]) {
      if (y + size > pageH - margin) { doc.addPage(); y = margin }
      doc.text(line, margin + indent, y); y += size + 4
    }
  }
  for (const block of packBlocks(pack, context)) {
    if (block.kind === 'title') write(block.text, 16, 'bold', 0, 0)
    else if (block.kind === 'heading') write(block.text, 12, 'bold', 0, 12)
    else if (block.kind === 'question') write(block.text, 10.5, 'bold', 0, 6)
    // The default PDF font has no checkbox glyph, so the checklist uses a plain box marker.
    else if (block.kind === 'bullet') write(`•  ${block.text.replace(/^☐ /, '[ ] ')}`, 10, 'normal', 10)
    else if (block.kind === 'footer') write(block.text, 8.5, 'normal', 0, 16)
    else write(block.text, 10, 'normal')
  }
  doc.save(packFilename(context, 'pdf'))
}
