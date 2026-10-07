// End-to-end smoke test + screenshot capture for Bug Tracker.
// Requires the backend (:4000) and the Vite dev server (:5173) running.
//   node smoke.mjs
// Screenshots are written to ../../docs/screenshots.
import { chromium } from 'playwright'
import { mkdir, rm, readdir, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const shotsDir = join(here, '..', '..', 'docs', 'screenshots')
const tmpDir = join(shotsDir, '.tmp')
const BASE = process.env.SMOKE_BASE || 'http://127.0.0.1:5173'

const tmpShot = (page, name) => page.screenshot({ path: join(tmpDir, `${name}.png`), clip: { x: 0, y: 0, width: 1200, height: 800 } })

const suffix = Math.random().toString(36).slice(2, 8)
const email = `demo-${suffix}@example.com`
const password = 'password123'
const NAME = 'Demo User'

const errors = []
const results = []
const record = (name, ok, detail = '') =>
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)

const shot = (page, name) => page.screenshot({ path: join(shotsDir, `${name}.png`) })

function wire(page) {
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(String(e)))
}

async function registerDesktop(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  wire(page)
  await page.goto(`${BASE}/register`)
  await shot(page, '01-register-desktop')
  await page.fill('#name', NAME)
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button[type=submit]')
  await page.waitForURL((u) => u.pathname === '/', { timeout: 20000 })
  await page.waitForSelector('text=Your bugs')
  return { context, page }
}

try {
  await rm(shotsDir, { recursive: true, force: true }) // clean slate
  await mkdir(tmpDir, { recursive: true })
  const browser = await chromium.launch()

  // ---------- Desktop: register -> full lifecycle ----------
  const { context, page } = await registerDesktop(browser)
  await shot(page, '02-dashboard-empty-desktop')
  await tmpShot(page, 'upload-red') // a realistic PNG for the screenshot upload
  record('register + empty dashboard', await page.isVisible('text=No bugs yet'))

  // 404 page
  await page.goto(`${BASE}/definitely-not-a-route`)
  await shot(page, '03-notfound')
  await tmpShot(page, 'upload-blue') // a second, different PNG for the "replace" step
  record('404 page', await page.isVisible('text=This page doesn\'t exist'))

  // New bug + screenshot upload
  await page.goto(`${BASE}/bugs/new`)
  await page.fill('#title', 'Save button does nothing')
  await page.fill(
    '#description',
    'Clicking "Save" on the invoice screen does nothing.\n\nSteps:\n1. Open the invoice\n2. Click Save\n3. Nothing happens'
  )
  await page.click('button:has-text("High")')
  await page.setInputFiles('input[type=file]', join(tmpDir, 'upload-red.png'))
  await page.waitForSelector('img[alt="Selected screenshot"]')
  await shot(page, '04-bug-new-filled')
  await page.click('button:has-text("Report bug")')
  await page.waitForURL((u) => /\/bugs\/[0-9a-f-]+$/.test(u.pathname), { timeout: 20000 })
  await page.waitForSelector('text=Save button does nothing')
  await page.waitForFunction(() => {
    const i = document.querySelector('img[alt="Screenshot attached to this bug"]')
    return i && i.complete && i.naturalHeight > 0
  })
  await shot(page, '05-bug-detail-light')
  const bugId = new URL(page.url()).pathname.split('/').pop()
  record('create bug with real S3 screenshot', await page.isVisible('img[alt="Screenshot attached to this bug"]'))

  // Lightbox
  await page.click('button[aria-label="View screenshot"]')
  await page.waitForSelector('.fixed img', { timeout: 10000 })
  await page.waitForFunction(() => {
    const i = document.querySelector('.fixed img')
    return i && i.complete && i.naturalHeight > 0
  })
  await shot(page, '06-lightbox')
  await page.keyboard.press('Escape')
  record('lightbox opens', true)

  // Dark mode on detail
  await page.click('button[aria-label="Switch to dark mode"]')
  await page.waitForTimeout(300)
  await shot(page, '07-bug-detail-dark')
  record('dark mode detail', await page.evaluate(() => document.documentElement.classList.contains('dark')))
  await page.click('button[aria-label="Switch to light mode"]')
  await page.waitForTimeout(200)

  // List
  await page.goto(`${BASE}/`)
  await page.waitForSelector('text=Save button does nothing')
  await shot(page, '08-dashboard-list')
  record('dashboard list', await page.isVisible('text=Save button does nothing'))

  // Edit: status + replace image
  await page.goto(`${BASE}/bugs/${bugId}/edit`)
  await page.waitForSelector('text=Edit bug')
  await page.click('button:has-text("In progress")')
  const chooserPromise = page.waitForEvent('filechooser')
  await page.click('button:has-text("Replace")')
  const chooser = await chooserPromise
  await chooser.setFiles(join(tmpDir, 'upload-blue.png'))
  await page.waitForSelector('img[alt="Selected screenshot"]')
  await shot(page, '09-bug-edit')
  await page.click('button:has-text("Save changes")')
  await page.waitForSelector('text=In progress', { timeout: 20000 })
  await page.waitForFunction(() => {
    const i = document.querySelector('img[alt="Screenshot attached to this bug"]')
    return i && i.complete && i.naturalHeight > 0
  })
  await shot(page, '10-bug-detail-after-edit')
  record('edit bug (status + replace image)', await page.isVisible('img[alt="Screenshot attached to this bug"]'))

  // Delete
  await page.click('button:has-text("Delete")')
  await page.waitForSelector('text=Delete this bug?')
  await shot(page, '11-delete-confirm')
  await page.locator('[role="dialog"] button', { hasText: 'Delete bug' }).click()
  await page.waitForSelector('text=No bugs yet', { timeout: 20000 })
  record('delete bug', await page.isVisible('text=No bugs yet'))

  // ---------- Mobile viewport: same user, responsive UI ----------
  // Create one more (image-less) bug so the mobile list has content.
  await page.goto(`${BASE}/bugs/new`)
  await page.fill('#title', 'Buttons overlap on small screens')
  await page.click('button:has-text("Report bug")')
  await page.waitForURL((u) => /\/bugs\/[0-9a-f-]+$/.test(u.pathname), { timeout: 20000 })
  await page.goto(`${BASE}/`)

  const desktopViewport = page.viewportSize()
  await page.setViewportSize({ width: 375, height: 800 })
  await page.waitForFunction((t) => document.body.innerText.includes(t), 'Buttons overlap on small screens', { timeout: 15000 })
  await shot(page, '14-dashboard-mobile')
  record('mobile dashboard (responsive)', true)
  await page.click('button[aria-label="Switch to dark mode"]')
  await page.waitForTimeout(300)
  await shot(page, '15-dashboard-mobile-dark')
  await page.goto(`${BASE}/bugs/new`)
  await page.waitForFunction(() => document.body.innerText.includes('Report a bug'), null, { timeout: 15000 })
  await shot(page, '16-bug-new-mobile')
  record('mobile new-bug form', await page.isVisible('button:has-text("Report bug")'))
  await page.click('button[aria-label="Switch to light mode"]')
  await page.setViewportSize(desktopViewport)

  // Logout -> login
  await page.click('button[aria-label="Log out"]')
  await page.waitForURL((u) => u.pathname === '/login', { timeout: 20000 })
  await shot(page, '12-login')
  record('logout -> login', await page.isVisible('text=Log in to manage your bugs.'))

  // Mobile login page screenshot (no login needed; rate limiter left intact)
  const mobile = await browser.newContext({ viewport: { width: 375, height: 800 } })
  const mp = await mobile.newPage()
  wire(mp)
  await mp.goto(`${BASE}/login`)
  await shot(mp, '13-login-mobile')
  record('mobile login page renders', await mp.isVisible('text=Log in to manage your bugs.'))
  await mobile.close()

  const filtered = errors.filter((e) => !/favicon|net::|Failed to load resource/i.test(e))
  record('no console/page errors', filtered.length === 0, filtered.slice(0, 2).join(' | '))

  await context.close()
  await browser.close()
} catch (err) {
  record('run', false, String(err).split('\n')[0])
}

console.log('\n=== SMOKE RESULTS ===')
for (const line of results) console.log(line)
try {
  const files = (await readdir(shotsDir)).filter((f) => f.endsWith('.png'))
  const sizes = await Promise.all(files.map(async (f) => `${f} (${await (await stat(join(shotsDir, f))).size} B)`))
  console.log(`\nScreenshots (${files.length}):\n  ${sizes.join('\n  ')}`)
} catch {}
console.log(`\nOutput -> ${shotsDir}`)
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0)