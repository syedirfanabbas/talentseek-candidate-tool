const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const { NextRequest } = require('next/server')

// Compile the actual routing modules, substituting only the remote auth service.
function loadModule(file, overrides = {}) {
  const filename = path.resolve(__dirname, '..', file)
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', outputText)(
    name => overrides[name] ?? require(name), module, module.exports,
  )
  return module.exports
}

const navigation = loadModule('lib/navigation.ts')
const { defaultDestinationForRole, safeReturnTo, signInUrl } = navigation

async function request(route, user = null, refreshCookies = false) {
  const { middleware } = loadModule('middleware.ts', {
    './lib/navigation': navigation,
    '@supabase/ssr': {
      createServerClient: (_url, _key, options) => ({
        auth: {
          getUser: async () => {
            if (refreshCookies) options.cookies.setAll([
              { name: 'test-session', value: 'refreshed', options: { path: '/', httpOnly: true } },
            ])
            return { data: { user } }
          },
        },
      }),
    },
  })
  return middleware(new NextRequest(`https://app.talentseek.ca${route}`))
}

test('return destinations preserve supported paths, queries and anchors', () => {
  for (const destination of ['/', '/dashboard', '/master-resume', '/master-resume?source=jobs&job=123#experience', '/admin/prompts', '/recruiter', '/recruiter/dashboard', '/recruiter/requests']) {
    assert.equal(safeReturnTo(destination), destination)
    assert.equal(new URL(signInUrl(destination), 'https://app.talentseek.ca').searchParams.get('next'), destination)
  }
})

test('external URLs, auth loops, unknown routes and malformed destinations fall back safely', () => {
  for (const destination of [null, '', 'https://evil.example', '//evil.example', '/\\evil.example', '/\nevil.example', 'javascript:alert(1)', '/auth', '/auth?next=/auth', '/missing', '/%2f%2fevil.example', '/master-resume/../auth']) {
    assert.equal(safeReturnTo(destination), '/dashboard', String(destination))
  }
})

test('anonymous deep links survive the sign-in round trip', async () => {
  const destination = '/master-resume?job=123&source=jobs'
  const response = await request(destination)
  const authUrl = new URL(response.headers.get('location'))
  assert.equal(authUrl.pathname, '/auth')
  assert.equal(authUrl.searchParams.get('next'), destination)
  assert.equal(authUrl.searchParams.has('job'), false)
  const signedIn = await request(authUrl.pathname + authUrl.search, { app_metadata: {} })
  assert.equal(signedIn.headers.get('location'), `https://app.talentseek.ca${destination}`)
})

test('general sign-in opens the appropriate workspace while explicit links stay direct', async () => {
  const user = { app_metadata: {} }
  assert.equal((await request('/auth', user)).headers.get('location'), 'https://app.talentseek.ca/dashboard')
  assert.equal(defaultDestinationForRole('recruiter'), '/recruiter/dashboard')
  assert.equal(defaultDestinationForRole('admin'), '/recruiter/dashboard')
  assert.equal((await request('/auth', { app_metadata: { role: 'recruiter' } })).headers.get('location'), 'https://app.talentseek.ca/recruiter/dashboard')
  assert.equal((await request('/auth?next=%2F', user)).headers.get('location'), 'https://app.talentseek.ca/')
  const response = await request('/dashboard')
  assert.equal(new URL(response.headers.get('location')).searchParams.get('next'), '/dashboard')
  assert.equal((await request('/dashboard', user)).status, 200)
})

test('anonymous auth page stays accessible and regular signed-in requests pass through', async () => {
  assert.equal((await request('/auth?next=%2Fmaster-resume')).status, 200)
  assert.equal((await request('/master-resume', { app_metadata: {} })).status, 200)
})

test('signed-in auth requests reject external destinations and auth loops', async () => {
  for (const next of ['//evil.example', '/auth', 'https://evil.example']) {
    const response = await request(`/auth?${new URLSearchParams({ next })}`, { app_metadata: {} })
    assert.equal(response.headers.get('location'), 'https://app.talentseek.ca/dashboard')
  }
})

test('role restrictions remain enforced after returning from login', async () => {
  for (const [role, route, allowed] of [
    ['candidate', '/admin', false], ['candidate', '/admin/prompts', false],
    ['candidate', '/recruiter', false], ['candidate', '/recruiter/dashboard', false],
    ['candidate', '/recruiter/requests', false], ['recruiter', '/admin', false],
    ['recruiter', '/recruiter', true], ['recruiter', '/recruiter/dashboard', true],
    ['recruiter', '/recruiter/requests', true], ['admin', '/admin/prompts', true],
    ['admin', '/recruiter', true], ['admin', '/recruiter/dashboard', true],
  ]) {
    const response = await request(route, { app_metadata: { role } })
    assert.equal(response.status, allowed ? 200 : 307, `${role}: ${route}`)
  }
})

test('refreshed session cookies are preserved on every redirect branch', async () => {
  for (const [route, user] of [
    ['/master-resume', null], ['/auth?next=%2Fmaster-resume', { app_metadata: {} }],
    ['/admin', { app_metadata: {} }], ['/recruiter', { app_metadata: {} }],
  ]) {
    const response = await request(route, user, true)
    assert.equal(response.cookies.get('test-session').value, 'refreshed')
    assert.match(response.headers.get('set-cookie'), /HttpOnly/i)
  }
})
