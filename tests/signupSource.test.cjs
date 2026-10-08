const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const output = ts.transpileModule(fs.readFileSync('lib/signupSource.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const mod = { exports: {} }
new Function('module', 'exports', 'require', output)(mod, mod.exports, require)
const { captureFirstTouch, sourceFromLanding, referrerDomain, signupChannel, SIGNUP_SOURCE_KEY, SOURCE_TTL_MS, getBrowserSignupSource } = mod.exports
const now = Date.parse('2026-10-08T12:00:00Z')
const store = () => {
  const records = new Map()
  return { getItem: key => records.get(key) ?? null, setItem: (key, value) => records.set(key, value), records }
}
test('URL campaign tags beat referrer and ts tags beat utm tags as one complete set', () => {
  const utm = sourceFromLanding('?utm_source=LinkedIn&utm_medium=Social&utm_campaign=Company-posts', 'https://google.com/search?q=private', now)
  assert.deepEqual(utm, { source: 'linkedin', medium: 'social', campaign: 'company-posts', referrer_domain: 'google.com', captured_at: new Date(now).toISOString() })
  const forwarded = sourceFromLanding('?ts_source=whatsapp&ts_campaign=szabist&utm_source=facebook&utm_medium=social', 'https://talentseek.ca/path?private=1', now)
  assert.equal(forwarded.source, 'whatsapp'); assert.equal(forwarded.medium, ''); assert.equal(forwarded.campaign, 'szabist'); assert.equal(forwarded.referrer_domain, '')
  assert.equal(sourceFromLanding('?utm_medium=email', '', now).source, 'other')
})
test('referrers store domains only, never paths, query strings, fragments or credentials', () => {
  const source = sourceFromLanding('', 'https://user:password@www.linkedin.com/in/someone?secret=value#private', now)
  assert.equal(source.source, 'linkedin.com'); assert.equal(source.referrer_domain, 'linkedin.com')
  assert.ok(!JSON.stringify(source).includes('private')); assert.ok(!JSON.stringify(source).includes('password'))
  assert.equal(referrerDomain('not-a-url'), ''); assert.equal(referrerDomain('file:///private/example'), '')
})
test('direct fallback excludes internal TalentSeek navigation and handles invalid referrers', () => {
  for (const referrer of ['', 'bad-url', 'https://talentseek.ca/about', 'https://app.talentseek.ca/jobs']) assert.equal(sourceFromLanding('', referrer, now).source, 'direct')
})
test('a valid first touch is not overwritten; expired, corrupt and future records are replaced', () => {
  const storage = store()
  const first = captureFirstTouch({ search: '?utm_source=whatsapp&utm_campaign=dream-team', referrer: '', storage, now })
  assert.deepEqual(captureFirstTouch({ search: '?utm_source=facebook', referrer: '', storage, now: now + 1000 }), first)
  assert.equal(captureFirstTouch({ search: '?utm_source=facebook', referrer: '', storage, now: now + SOURCE_TTL_MS }).source, 'facebook')
  for (const bad of ['invalid json', JSON.stringify({ ...first, captured_at: new Date(now + 1000).toISOString() }), JSON.stringify({ source: 'google', captured_at: 'bad' })]) {
    storage.setItem(SIGNUP_SOURCE_KEY, bad)
    assert.equal(captureFirstTouch({ search: '', referrer: '', storage, now }).source, 'direct')
  }
})
test('values are lowercased, trimmed, capped and safe labels; oversized domains are omitted', () => {
  const source = sourceFromLanding('?utm_source=%20LINKEDIN%20&utm_medium=' + 'A'.repeat(100) + '&utm_campaign=' + encodeURIComponent(' https://site.test/path?email=private@example.test '), '', now)
  assert.equal(source.source, 'linkedin'); assert.equal(source.medium.length, 60)
  assert.ok(source.campaign.length <= 60); assert.ok(!/[/:?@=]/.test(source.campaign))
  assert.equal(referrerDomain('https://' + 'a'.repeat(58) + '.example.test/path'), '')
})
test('storage failures never prevent capture; browser memory retains a first touch across navigation', t => {
  const blocked = { getItem() { throw Error('blocked') }, setItem() { throw Error('blocked') } }
  assert.equal(captureFirstTouch({ search: '?utm_source=email', referrer: '', storage: blocked, now }).source, 'email')
  const oldWindow = global.window, oldDocument = global.document
  t.after(() => { global.window = oldWindow; global.document = oldDocument })
  global.window = { get localStorage() { throw Error('blocked') }, location: { search: '?utm_source=whatsapp&utm_campaign=dcs-canada' } }
  global.document = { referrer: '' }
  const first = getBrowserSignupSource()
  global.window.location.search = '?utm_source=facebook'
  assert.deepEqual(getBrowserSignupSource(), first)
})
test('readable report channels follow ordered rules and older accounts remain unknown', () => {
  const cases = [['linkedin', '', 'LinkedIn'], ['m.facebook.com', '', 'Facebook'], ['whatsapp', 'group', 'WhatsApp (utm)'], ['google.ca', '', 'Google search'], ['www.bing.com', '', 'Other search'], ['direct', '', 'Direct'], ['community.example.org', '', 'Referral (domain)'], ['newsletter', '', 'Email'], ['partner', 'email', 'Email'], ['unknown', '', 'Other'], ['whatsapp.com', '', 'Referral (domain)']]
  for (const [source, medium, expected] of cases) assert.equal(signupChannel({ source, medium }), expected)
  assert.equal(signupChannel(null), 'Other')
})
