/** First-touch attribution only: no complete URLs, page paths or account identifiers. */
export const SIGNUP_SOURCE_KEY = 'talentseek.signup-source.v1'
export const SOURCE_TTL_MS = 30 * 24 * 60 * 60 * 1000
export const SOURCE_VALUE_CAP = 60
export type SignupSource = {
  source: string
  medium: string
  campaign: string
  referrer_domain: string
  captured_at: string
}
type SourceStorage = Pick<Storage, 'getItem' | 'setItem'>
type CaptureInput = { search: string; referrer: string; storage?: SourceStorage; now?: number }

// Campaign tags are labels, not arbitrary URL payloads. Marketing uses lowercase hyphenated tags.
export function cleanSourceTag(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').slice(0, SOURCE_VALUE_CAP) : ''
}
export function referrerDomain(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return ''
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) return ''
    const domain = url.hostname.toLowerCase().replace(/^www\./, '')
    // Dropping an oversized domain is safer than storing a truncated, misleading host.
    return domain.length <= SOURCE_VALUE_CAP ? domain : ''
  } catch { return '' }
}
function isTalentSeekDomain(domain: string): boolean {
  return domain === 'talentseek.ca' || domain.endsWith('.talentseek.ca')
}
export function validStoredSource(value: unknown, now: number): SignupSource | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Partial<SignupSource>
  const timestamp = typeof record.captured_at === 'string' ? Date.parse(record.captured_at) : NaN
  const source = cleanSourceTag(record.source)
  if (!source || !Number.isFinite(timestamp) || timestamp > now || now - timestamp >= SOURCE_TTL_MS) return null
  return {
    source, medium: cleanSourceTag(record.medium), campaign: cleanSourceTag(record.campaign),
    referrer_domain: typeof record.referrer_domain === 'string' ? referrerDomain('https://' + record.referrer_domain) : '',
    captured_at: new Date(timestamp).toISOString(),
  }
}
export function sourceFromLanding(search: string, referrer: string, now = Date.now()): SignupSource {
  const params = new URLSearchParams(search)
  const domain = referrerDomain(referrer)
  const externalDomain = isTalentSeekDomain(domain) ? '' : domain
  for (const prefix of ['ts_', 'utm_']) {
    const [source, medium, campaign] = ['source', 'medium', 'campaign'].map(key => cleanSourceTag(params.get(prefix + key)))
    if (source || medium || campaign) return { source: source || 'other', medium, campaign, referrer_domain: externalDomain, captured_at: new Date(now).toISOString() }
  }
  return { source: externalDomain || 'direct', medium: '', campaign: '', referrer_domain: externalDomain, captured_at: new Date(now).toISOString() }
}
export function captureFirstTouch({ search, referrer, storage, now = Date.now() }: CaptureInput): SignupSource {
  try {
    const existing = validStoredSource(JSON.parse(storage?.getItem(SIGNUP_SOURCE_KEY) || 'null'), now)
    if (existing) return existing
  } catch { /* Disabled storage or an invalid record must not block the app. */ }
  const source = sourceFromLanding(search, referrer, now)
  try { storage?.setItem(SIGNUP_SOURCE_KEY, JSON.stringify(source)) } catch { /* Best effort in private/blocked storage. */ }
  return source
}
let browserFirstTouch: SignupSource | null = null
export function getBrowserSignupSource(): SignupSource {
  const now = Date.now()
  // Also retain the first touch in memory when browser storage is unavailable.
  const existing = validStoredSource(browserFirstTouch, now)
  if (existing) return existing
  let storage: SourceStorage | undefined
  try { storage = window.localStorage } catch { /* Access itself can throw. */ }
  browserFirstTouch = captureFirstTouch({ search: window.location.search, referrer: document.referrer, storage, now })
  return browserFirstTouch
}

/** Ordered rules to mirror in the backend. Metadata is user-editable reporting data, never authorization. */
export const SIGNUP_CHANNEL_RULES = [
  { channel: 'Email', sources: ['email', 'newsletter'], media: ['email'] },
  { channel: 'LinkedIn', sources: ['linkedin'], domains: ['linkedin.com', 'lnkd.in'] },
  { channel: 'Facebook', sources: ['facebook', 'fb'], domains: ['facebook.com', 'fb.com', 'fb.me'] },
  // Only explicitly tagged WhatsApp traffic: a referrer alone cannot reliably identify a group.
  { channel: 'WhatsApp (utm)', sources: ['whatsapp'], taggedOnly: true },
  { channel: 'Google search', sources: ['google'], domains: ['google.com', 'google.ca', 'google.co.uk', 'google.ae', 'google.com.pk', 'google.co.in'] },
  { channel: 'Other search', sources: ['bing', 'yahoo', 'duckduckgo', 'baidu', 'yandex', 'ecosia', 'search'], domains: ['bing.com', 'yahoo.com', 'duckduckgo.com', 'baidu.com', 'yandex.com', 'yandex.ru', 'ecosia.org'] },
] as const
const matchesDomain = (value: string, domain: string) => value === domain || value.endsWith('.' + domain)
export function signupChannel(record: Partial<SignupSource> | null | undefined): string {
  if (!record?.source) return 'Other' // Older accounts are unknown, not retroactively Direct.
  const source = cleanSourceTag(record.source), medium = cleanSourceTag(record.medium)
  for (const rule of SIGNUP_CHANNEL_RULES) {
    if ((rule.sources as readonly string[]).includes(source) || ('media' in rule && (rule.media as readonly string[]).includes(medium)) || ('domains' in rule && rule.domains.some(domain => matchesDomain(source, domain)))) return rule.channel
  }
  if (source === 'direct') return 'Direct'
  const domain = referrerDomain('https://' + source)
  if (domain === source && source.includes('.')) return 'Referral (domain)'
  return 'Other'
}
