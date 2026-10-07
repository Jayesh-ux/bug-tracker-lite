// Responsive verification: full lifecycle at 320px + overflow checks across
// widths 320..1440. Requires backend (:4000) + Vite dev server (:5173).
//   node responsive.mjs
// Screenshots -> ../../docs/screenshots/responsive
import { chromium } from 'playwright'
import { mkdir, rm, appendFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const shotsDir = join(here, '..', '..', 'docs', 'screenshots', 'responsive')
const tmpDir = join(here, '..', '..', 'docs', 'screenshots', '.tmp')
const BASE = process.env.SMOKE_BASE || 'http://127.0.0.1:5173'

const suffix = Math.random().toString(36).slice(2, 8)
const email = `resp-${suffix}@example.com`
const password = 'password123'
const results = []
const record = (name, ok, detail = '') =>
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
const shot = (page, name) => page.screenshot({ path: join(shotsDir, `${name}.png`) })
const tmpShot = (page, name) =>
  page.screenshot({ path: join(tmpDir, `${name}.png`), clip: { x: 0, y: 0, width: 1200, height: 800 } })

const logFilePath = join(here, 'responsive.log')
const log = (m) => appendFile(logFilePath, `${new Date().toISOString()} ${m}\n`)

const overflow = async (page) =>
  page.evaluate(() => {
    const de = document.documentElement
    const viewport = window.innerWidth
    let maxRight = -1e9
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect()
      if (r.right > maxRight) maxRight = r.right
    }
    return {
      viewport,
      scrollW: de.scrollWidth,
      overX: de.scrollWidth - de.clientWidth,
      maxRight: Math.round(maxRight * 10) / 10,
    }
  })

const checkOverflow = async (page, label) => {
  const r = await overflow(page)
  const ok = r.overX <= 1 && r.maxRight <= r.viewport + 1
  record(
    `${label} @${r.viewport}px`,
    ok,
    `overX=${r.overX} maxRight=${r.maxRight} (scrollW=${r.scrollW})`
  )
  return r
}

const hasText = (t) => {
  log(`wait text: ${t}`)
  return page.waitForFunction((x) => document.body.innerText.includes(x), t, { timeout: 12000 })
}

let page
let errors = []

try {
  await log('start')
  await rm(shotsDir, { recursive: true, force: true })
  await mkdir(shotsDir, { recursive: true })
  await mkdir(tmpDir, { recursive: true })

  const browser = await chromium.launch()
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(String(e)))

  // Fixtures BEFORE shrinking the viewport (1200x800 PNGs)
  await page.goto(`${BASE}/register`)
  await tmpShot(page, 'upload-red')
  await page.goto(`${BASE}/`)
  await tmpShot(page, 'upload-blue')

  // ---------- FULL FLOW AT 320px ----------
  await page.setViewportSize({ width: 320, height: 700 })
  await page.goto(`${BASE}/register`)
  await hasText('Create your account')
  await shot(page, 'a1-register-320')
  await checkOverflow(page, 'register')
  await page.fill('#name', 'Responsive Tester')
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button[type=submit]')
  await page.waitForURL((u) => u.pathname === '/', { timeout: 20000 })
  await hasText('Your bugs')
  await shot(page, 'a2-dashboard-empty-320')
  record('register + empty dashboard @320', await page.isVisible('text=No bugs yet'))

  // Create bug + image at 320
  await page.goto(`${BASE}/bugs/new`)
  await page.fill('#title', 'Icons overlap under 360px')
  await page.fill('#description', 'Gallery icons collide below 360px viewport width.')
  await page.click('button:has-text("High")')
  await page.setInputFiles('input[type=file]', join(tmpDir, 'upload-red.png'))
  await page.waitForSelector('img[alt="Selected screenshot"]')
  await shot(page, 'a3-bug-form-filled-320')
  await checkOverflow(page, 'bug form (filled)')
  await page.click('button:has-text("Report bug")')
  await page.waitForURL((u) => /\/bugs\/[0-9a-f-]+$/.test(u.pathname), { timeout: 20000 })
  await hasText('Icons overlap under 360px')
  await page.waitForFunction(() => {
    const i = document.querySelector('img[alt="Screenshot attached to this bug"]')
    return i && i.complete && i.naturalHeight > 0
  }, { timeout: 15000 })
  await shot(page, 'a4-detail-320')
  await checkOverflow(page, 'detail (with image)')
  record('create bug with S3 image @320', await page.isVisible('img[alt="Screenshot attached to this bug"]'))
  const bugId = new URL(page.url()).pathname.split('/').pop()

  // Lightbox at 320
  await page.click('button[aria-label="View screenshot"]')
  await page.waitForFunction(() => {
    const i = document.querySelector('.fixed img')
    return i && i.complete && i.naturalHeight > 0
  }, { timeout: 15000 })
  await shot(page, 'a5-lightbox-320')
  record('lightbox @320', await page.isVisible('.fixed img'))
  await page.keyboard.press('Escape')

  // Dashboard with a bug at 320
  await page.goto(`${BASE}/`)
  await hasText('Icons overlap under 360px')
  await shot(page, 'a6-dashboard-list-320')
  await checkOverflow(page, 'dashboard (list)')

  // ---------- OVERFLOW SWEEP 320..1440 ----------
  for (const w of [320, 360, 375, 390, 414, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width: w, height: 800 })
    await page.goto(`${BASE}/`)
    await hasText('Icons overlap under 360px')
    await checkOverflow(page, 'dashboard')
    await shot(page, `b-dash-${w}`)

    await page.goto(`${BASE}/bugs/new`)
    await hasText('Report a bug')
    await checkOverflow(page, 'form')
    await shot(page, `c-form-${w}`)

    await page.goto(`${BASE}/bugs/${bugId}`)
    await hasText('Icons overlap under 360px')
    await checkOverflow(page, 'detail')
    await shot(page, `d-detail-${w}`)
  }

  // ---------- EDIT + DELETE AT 320 ----------
  await page.setViewportSize({ width: 320, height: 700 })
  await page.goto(`${BASE}/bugs/${bugId}/edit`)
  await hasText('Edit bug')
  await page.click('button:has-text("In progress")')
  await page.click('button:has-text("Save changes")')
  await page.waitForURL((u) => u.pathname === `/bugs/${bugId}`, { timeout: 20000 })
  await hasText('In progress')
  await shot(page, 'a7-edit-done-320')
  record('edit status @320', await page.isVisible('text=In progress'))

  await page.goto(`${BASE}/`)
  await hasText('Icons overlap under 360px')
  await page.locator(`a[href="/bugs/${bugId}"]`).filter({ visible: true }).first().click()
  await hasText('Icons overlap under 360px')
  await page.click('button:has-text("Delete")')
  const dialog = page.locator('[role="dialog"]')
  await dialog.waitFor({ state: 'visible' })
  await dialog.locator('button', { hasText: 'Delete bug' }).click()
  await page.waitForURL((u) => u.pathname === '/', { timeout: 20000 })
  await hasText('Your bugs')
  await shot(page, 'a8-deleted-320')
  record('delete bug @320', await page.isVisible('text=No bugs yet'))

  // Logout at 320
  await page.click('button[aria-label="Log out"]')
  await page.waitForURL((u) => u.pathname === '/login', { timeout: 20000 })
  await shot(page, 'a9-login-320')
  await checkOverflow(page, 'login')
  record('logout -> login @320', await page.isVisible('text=Log in to manage your bugs.'))

  const filtered = errors.filter((e) => !/favicon|net::|Failed to load resource/i.test(e))
  record('no console/page errors', filtered.length === 0, filtered.slice(0, 2).join(' | '))

  await browser.close()
} catch (e) {
  await log(`SCRIPT FAILED: ${e}`)
  console.log('SCRIPT FAILED:', e)
  try { await browser?.close() } catch {}
  process.exit(1)
}

await log('done')
console.log('\n=== RESPONSIVE RESULTS ===')
for (const r of results) console.log(r)
console.log(`\nScreenshots -> ${shotsDir}`)
process.exit(0)