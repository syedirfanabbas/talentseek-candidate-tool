import { jsPDF } from 'jspdf'

export type ReportMeta = { title: string; jobTitle?: string; company?: string; generatedAt?: Date }

type Score = { label: string; score: number }

const NAVY = '#1E3A5F'
const SLATE = '#334155'
const LIGHT_GREY = '#E2E8F0'
const MARGIN = 48
const PAGE_BOTTOM = 718

async function loadLogo(): Promise<string | null> {
  try {
    const response = await fetch('/talentseek-logo.png')
    if (!response.ok) return null
    const blob = await response.blob()
    return await new Promise(resolve => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export class BrandedReportPdf {
  private readonly pdf: jsPDF
  private readonly title: string
  private readonly logo: string | null
  private y = 0

  private constructor(pdf: jsPDF, title: string, logo: string | null) {
    this.pdf = pdf
    this.title = title
    this.logo = logo
    this.header()
  }

  static async create(meta: ReportMeta): Promise<BrandedReportPdf> {
    const report = new BrandedReportPdf(new jsPDF({ unit: 'pt', format: 'letter' }), meta.title, await loadLogo())
    report.cover(meta)
    return report
  }

  private header() {
    const { pdf } = this
    pdf.setDrawColor(NAVY)
    pdf.setLineWidth(0.7)
    pdf.line(MARGIN, 82, pdf.internal.pageSize.getWidth() - MARGIN, 82)
    if (this.logo) {
      const properties = pdf.getImageProperties(this.logo)
      const height = 28
      pdf.addImage(this.logo, 'PNG', MARGIN, 38, height * (properties.width / properties.height), height)
    }
    pdf.setTextColor(NAVY)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    const width = pdf.internal.pageSize.getWidth()
    pdf.text(this.title.toUpperCase(), width - MARGIN - pdf.getTextWidth(this.title.toUpperCase()), 58)
    this.y = 112
  }

  private nextPage() {
    this.pdf.addPage()
    this.header()
  }

  private ensure(height: number) {
    if (this.y + height > PAGE_BOTTOM) this.nextPage()
  }

  private text(value: string, size = 10.5, bold = false, indent = 0) {
    this.pdf.setFont('helvetica', bold ? 'bold' : 'normal')
    this.pdf.setFontSize(size)
    this.pdf.setTextColor(SLATE)
    const width = this.pdf.internal.pageSize.getWidth() - MARGIN * 2 - indent
    const lines = this.pdf.splitTextToSize(value, width) as string[]
    for (const line of lines) {
      this.ensure(size + 8)
      this.pdf.text(line, MARGIN + indent, this.y)
      this.y += size + 5
    }
  }

  private cover(meta: ReportMeta) {
    this.ensure(145)
    this.pdf.setFillColor('#F8FAFC')
    this.pdf.roundedRect(MARGIN, this.y, this.pdf.internal.pageSize.getWidth() - MARGIN * 2, 126, 10, 10, 'F')
    this.y += 34
    this.pdf.setFont('helvetica', 'bold')
    this.pdf.setFontSize(22)
    this.pdf.setTextColor(NAVY)
    this.pdf.text(meta.title, MARGIN + 20, this.y)
    this.y += 29
    const job = meta.jobTitle && meta.company ? `Prepared for: ${meta.jobTitle} at ${meta.company}` : meta.jobTitle ? `Prepared for: ${meta.jobTitle}` : ''
    if (job) this.text(job, 10.5, false, 20)
    const generated = (meta.generatedAt || new Date()).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
    this.text(`Generated: ${generated}`, 10.5, false, 20)
    this.y += 24
  }

  scoreCard(score: number, scores: Score[]) {
    this.ensure(172)
    const colour = score >= 75 ? '#15803D' : score >= 50 ? '#B45309' : '#B91C1C'
    const width = this.pdf.internal.pageSize.getWidth() - MARGIN * 2
    this.pdf.setFillColor('#F8FAFC')
    this.pdf.setDrawColor(LIGHT_GREY)
    this.pdf.roundedRect(MARGIN, this.y, width, 152, 10, 10, 'FD')
    this.pdf.setFont('helvetica', 'bold')
    this.pdf.setTextColor(colour)
    this.pdf.setFontSize(33)
    this.pdf.text(`${score}%`, MARGIN + 20, this.y + 48)
    this.pdf.setFontSize(10)
    this.pdf.setTextColor(SLATE)
    this.pdf.text('JOB MATCH ESTIMATE', MARGIN + 20, this.y + 67)
    let barY = this.y + 25
    const left = MARGIN + 148
    for (const item of scores) {
      this.pdf.setFont('helvetica', 'normal')
      this.pdf.setFontSize(9)
      this.pdf.setTextColor(SLATE)
      this.pdf.text(item.label, left, barY)
      this.pdf.setFillColor(LIGHT_GREY)
      this.pdf.roundedRect(left + 98, barY - 8, 160, 7, 3, 3, 'F')
      this.pdf.setFillColor(colour)
      this.pdf.roundedRect(left + 98, barY - 8, Math.max(0, Math.min(100, item.score)) * 1.6, 7, 3, 3, 'F')
      this.pdf.setFont('helvetica', 'bold')
      this.pdf.text(`${item.score}%`, left + 267, barY)
      barY += 27
    }
    this.y += 178
  }

  section(title: string) {
    this.ensure(42)
    this.pdf.setDrawColor(LIGHT_GREY)
    this.pdf.line(MARGIN, this.y, this.pdf.internal.pageSize.getWidth() - MARGIN, this.y)
    this.y += 20
    this.pdf.setFont('helvetica', 'bold')
    this.pdf.setFontSize(13)
    this.pdf.setTextColor(NAVY)
    this.pdf.text(title, MARGIN, this.y)
    this.y += 20
  }

  paragraph(value: string) {
    this.text(value)
    this.y += 7
  }

  bullets(items: string[]) {
    for (const item of items) {
      this.ensure(26)
      this.pdf.setFont('helvetica', 'normal')
      this.pdf.setFontSize(10.5)
      this.pdf.setTextColor(SLATE)
      const lines = this.pdf.splitTextToSize(item, this.pdf.internal.pageSize.getWidth() - MARGIN * 2 - 16) as string[]
      this.pdf.text('•', MARGIN, this.y)
      for (const line of lines) {
        this.ensure(18)
        this.pdf.text(line, MARGIN + 14, this.y)
        this.y += 15.5
      }
      this.y += 4
    }
  }

  save(filename: string) {
    const pages = this.pdf.getNumberOfPages()
    for (let page = 1; page <= pages; page += 1) {
      this.pdf.setPage(page)
      this.pdf.setDrawColor(LIGHT_GREY)
      this.pdf.line(MARGIN, 744, this.pdf.internal.pageSize.getWidth() - MARGIN, 744)
      this.pdf.setFont('helvetica', 'normal')
      this.pdf.setFontSize(6.2)
      this.pdf.setTextColor('#64748B')
      this.pdf.text("The match score is an estimate by TalentSeek's AI, not a result from any employer's applicant tracking system.", MARGIN, 758)
      this.pdf.setTextColor(SLATE)
      this.pdf.setFontSize(8)
      this.pdf.text('talentseek.ca', MARGIN, 776)
      const pageText = `Page ${page} of ${pages}`
      this.pdf.text(pageText, this.pdf.internal.pageSize.getWidth() - MARGIN - this.pdf.getTextWidth(pageText), 776)
    }
    this.pdf.save(filename)
  }
}

export async function downloadJobMatchReport(meta: ReportMeta, score: number, scores: Score[], sections: Array<{ title: string; items: string[] }>, filename: string) {
  const report = await BrandedReportPdf.create(meta)
  report.scoreCard(score, scores)
  sections.forEach(section => { report.section(section.title); report.bullets(section.items) })
  report.save(filename)
}

export async function downloadProfileReport(meta: ReportMeta, content: string, filename: string) {
  const report = await BrandedReportPdf.create(meta)
  const blocks = content.split(/\n\s*\n/).map(block => block.trim()).filter(Boolean)
  blocks.forEach((block, index) => {
    const lines = block.split('\n').map(line => line.trim()).filter(Boolean)
    const heading = lines[0].replace(/:$/, '')
    const body = lines.slice(1)
    report.section(index === 0 && body.length === 0 ? 'Profile improvement report' : heading)
    if (body.length) report.bullets(body)
    else report.paragraph(heading)
  })
  report.save(filename)
}
