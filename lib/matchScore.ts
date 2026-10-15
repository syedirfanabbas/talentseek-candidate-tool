export type BeforeScore = {
  match_rate: number
  industry_score: number
  experience_score: number
  skills_score: number
  competency_score: number
  presentation_score?: number
}

export function scoreSummary(before: number | undefined, after: number): string {
  if (before === undefined) return `Match ${after}%`
  return after > before ? `Match ${before}% → ${after}% (+${after - before})` : `Match ${before}% → ${after}%`
}

export function savedScoreLabel(before?: number | null, after?: number | null): string | null {
  if (typeof after !== 'number') return null
  return typeof before === 'number' ? `Match ${before}% → ${after}%` : `Match ${after}%`
}
