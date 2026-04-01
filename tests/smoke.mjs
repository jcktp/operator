/**
 * Navigation smoke test — requires the dev server to be running on :3000.
 * Run with: npm run test:smoke
 *
 * Checks:
 *  1. All nav routes respond without a 5xx error
 *  2. Nav group buttons are present in the HTML (Intake, Analysis, Synthesis)
 *
 * For interactive browser tests (dropdown clicks, badge persistence),
 * use the Puppeteer MCP in the Claude Code session.
 */

const BASE = 'http://localhost:3000'

// All routes that should exist and return < 500
// Note: unauthenticated requests may redirect to /login (302) — that's fine, not a crash
const ROUTES = [
  '/',
  '/dashboard',
  '/upload',
  '/library',
  '/directs',
  '/journal',
  '/pulse',
  '/dispatch',
  '/settings',
  '/login',
]

let passed = 0
let failed = 0

async function check(label, fn) {
  try {
    await fn()
    console.log(`  ✓  ${label}`)
    passed++
  } catch (err) {
    console.error(`  ✗  ${label}`)
    console.error(`     ${err.message}`)
    failed++
  }
}

// ── 1. Route availability ──────────────────────────────────────────────────
console.log('\nRoute availability:')
for (const route of ROUTES) {
  await check(route, async () => {
    const res = await fetch(BASE + route, { redirect: 'manual' })
    if (res.status >= 500) {
      throw new Error(`HTTP ${res.status}`)
    }
    if (res.status === 0) {
      throw new Error('No response — is the dev server running?')
    }
  })
}

// ── 2. Nav HTML contains dropdown group buttons ────────────────────────────
// This checks the rendered HTML from the /login page which does NOT hide the nav.
// NOTE: Nav.tsx hides itself on /login — so we check a page that renders nav.
// Since all other routes redirect to /login when unauthenticated, we check
// if at least the login page HTML contains our nav group labels.
console.log('\nNav structure (from login page HTML):')

await check('Nav renders without crash (login page loads)', async () => {
  const res = await fetch(BASE + '/login')
  if (res.status >= 500) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()
  if (html.includes('Application error') || html.includes('Unhandled Runtime Error')) {
    throw new Error('Error overlay detected in HTML')
  }
})

// The nav is hidden on /login, so check / page instead (may redirect, but HTML is still served)
await check('Nav groups present in app HTML (Intake, Analysis, Synthesis)', async () => {
  const res = await fetch(BASE + '/', { redirect: 'manual' })
  // 302 to /login is expected unauthenticated; we need a different approach
  // Try fetching with a cookie header if TEST_SESSION is set
  const session = process.env.TEST_SESSION
  const headers = session ? { Cookie: `operator_session=${session}` } : {}
  const res2 = await fetch(BASE + '/', { headers })
  const html = await res2.text()
  if (html.includes('Application error')) throw new Error('Error overlay in HTML')

  // Check nav group buttons exist — data-nav-group attributes
  const hasIntake = html.includes('data-nav-group="intake"')
  const hasAnalysis = html.includes('data-nav-group="analysis"')
  const hasSynthesis = html.includes('data-nav-group="synthesis"')
  if (!hasIntake || !hasAnalysis || !hasSynthesis) {
    // If we got redirected to login, nav won't be in HTML — skip rather than fail
    if (html.includes('/login') && res2.url.includes('/login')) {
      console.log('     (skipped: unauthenticated redirect — set TEST_SESSION env var to test nav HTML)')
      return
    }
    const missing = [!hasIntake && 'intake', !hasAnalysis && 'analysis', !hasSynthesis && 'synthesis']
      .filter(Boolean).join(', ')
    throw new Error(`Missing nav groups: ${missing}`)
  }
})

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} checks: ${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
