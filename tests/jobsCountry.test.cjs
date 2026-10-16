const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const page = fs.readFileSync('app/jobs/page.tsx', 'utf8')
const route = fs.readFileSync('app/api/jobs/search/route.ts', 'utf8')

test('country picker shares country in the URL and search request', () => {
  assert.match(page, /const COUNTRIES/)
  assert.match(page, /url\.searchParams\.set\('country', next\)/)
  assert.match(page, /new URLSearchParams\(\{ country: selected \}\)/)
  assert.match(route, /searchParams\.get\('country'\)/)
  assert.match(route, /url\.searchParams\.set\('country', country\)/)
})

test('Gulf jobs wait for an explicit search and identify Jooble listings', () => {
  assert.match(page, /initialCountry === 'ca'/)
  assert.match(page, /Jobs in the Gulf provided by Jooble\./)
  assert.match(page, /via Jooble/)
  assert.match(page, /noopener noreferrer nofollow/)
})
