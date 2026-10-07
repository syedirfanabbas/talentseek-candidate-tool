// Export an interview-preparation pack as plain text or branded PDF.
// Generated packs are also automatically saved to the account library.
import { BrandedReportPdf } from './reportPdf'

export type InterviewPack = {
  saved_pack_id?: string
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

export async function downloadPackPdf(pack: InterviewPack, context: PackContext): Promise<void> {
  const report = await BrandedReportPdf.create({ title: 'Interview preparation pack', jobTitle: context.jobTitle, company: context.companyName })
  report.paragraph(`${context.interviewType} · Resume match ${pack.match_confidence.score}% (${pack.match_confidence.label})`)
  report.paragraph(pack.match_confidence.summary)
  report.section('What this role needs'); report.paragraph(pack.role_summary)
  report.section('Skills to demonstrate'); report.bullets(pack.skills_to_demonstrate)
  report.section('Likely interview questions'); pack.likely_questions.forEach((item, i) => { report.paragraph(`${i + 1}. ${item.question} (${item.category})`); report.bullets(item.answer_points) })
  report.section('Questions to ask'); report.bullets(pack.questions_to_ask)
  report.section('Interview checklist'); report.bullets(pack.checklist.map(item => `[ ] ${item}`))
  report.save(packFilename(context, 'pdf'))
}
