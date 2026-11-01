import { createRequire } from 'node:module'
import { resolve } from 'node:path'
const require = createRequire(
  resolve(process.env.WG_TEST_TOOLCHAIN ?? '.tools/browser-test/package.json'),
)
const { chromium, webkit } = require('@playwright/test')
import assert from 'node:assert/strict'
for (const [engine, type] of [
  ['edge', chromium],
  ['webkit', webkit],
]) {
  const browser = await type.launch(
    engine === 'edge' ? { channel: 'msedge' } : {},
  )
  for (const width of [390, 820, 1440]) {
    const page = await browser.newPage({
      viewport: { width, height: 1000 },
      hasTouch: true,
      reducedMotion: 'reduce',
    })
    let active = true,
      posts = []
    const members = Array.from({ length: 5 }, (_, i) => ({
      id: `p${i}`,
      name: `Person ${i}`,
    }))
    const duties = ['Bad', 'Wohnzimmer', 'Supply', 'Küche'].map((name, i) => ({
      id: `d${i}`,
      name,
      isPaused: false,
    }))
    let assignments = duties.map((duty, i) => ({
      id: `a${i}`,
      user: members[i + 1],
      duty,
      weekStart: '2026-11-02T00:00:00Z',
      dueDate: '2026-11-08T22:59:59Z',
      completedAt: null,
    }))
    let backlog = [
      { ...assignments[1], id: 'old', weekStart: '2026-10-26T00:00:00Z' },
    ]
    const plan = {
      startMonday: '2026-11-02',
      memberOrder: members.map((m) => m.id),
      dutyOrder: duties.map((d) => d.id),
    }
    await page.route('**/api/**', async (route) => {
      const req = route.request(),
        url = new URL(req.url())
      if (url.pathname === '/api/duties/weekly') {
        if (req.method() === 'POST') {
          posts.push(req.postDataJSON())
          active = true
          return route.fulfill({ status: 201, json: { created: true } })
        }
        return route.fulfill({
          json: {
            plan: active ? plan : null,
            week: '2026-11-02',
            freeMemberId: active ? 'p0' : null,
            members,
            duties,
            assignments: active ? assignments : [],
            backlog: active ? backlog : [],
            isAdmin: true,
          },
        })
      }
      if (url.pathname.startsWith('/api/assignments/')) {
        const id = url.pathname.split('/').pop(),
          done = req.postDataJSON().action === 'complete'
        const update = (a) =>
          a.id === id
            ? { ...a, completedAt: done ? new Date().toISOString() : null }
            : a
        assignments = assignments.map(update)
        backlog = backlog.map(update).filter((a) => !a.completedAt)
        return route.fulfill({ json: { assignment: {} } })
      }
      return route.fulfill({
        json: { duties: [], users: members, swapRequests: [] },
      })
    })
    await page.goto('http://127.0.0.1:3096')
    const board = page.getByRole('region', { name: 'Gemeinsamer Wochenplan' })
    await board.waitFor()
    await page
      .getByText('🎉 Person 0 hat diese Woche frei.', { exact: true })
      .waitFor()
    assert.equal(await board.getByRole('article').count(), 5)
    assert.equal(
      await board
        .getByRole('button', { name: 'Als erledigt markieren', exact: true })
        .count(),
      2,
    )
    const own = board
      .getByRole('article')
      .filter({ hasText: 'Wohnzimmer' })
      .filter({ hasText: '2. November' })
    await own
      .getByRole('button', { name: 'Als erledigt markieren', exact: true })
      .tap()
    await own.getByText('✓ Erledigt', { exact: true }).waitFor()
    await own
      .getByRole('button', { name: 'Wieder öffnen', exact: true })
      .click()
    await own.getByText('○ Noch offen', { exact: true }).waitFor()
    await board.getByText(/Nächste Woche/).click()
    await board.getByText('Person 1: Frei 🎉', { exact: true }).waitFor()
    await board.getByText('Person 0: Küche', { exact: true }).waitFor()
    const old = page.getByRole('region', {
      name: 'Offene Dienste aus Vorwochen',
    })
    await old
      .getByRole('button', { name: 'Als erledigt markieren', exact: true })
      .click()
    await old.waitFor({ state: 'detached' })
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    )
    await page.screenshot({
      path: `tmp/weekly-${engine}-${width}.png`,
      fullPage: true,
    })
    await page.goto('http://127.0.0.1:3096#dark')
    await board.waitFor()
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    )
    await page.screenshot({
      path: `tmp/weekly-${engine}-${width}-dark.png`,
      fullPage: true,
    })
    if (width === 390) {
      active = false
      await page.reload()
      await page
        .getByText('Gemeinsamen Wochenplan einrichten', { exact: true })
        .click()
      await page.getByLabel('Startmontag', { exact: true }).fill('2026-11-02')
      const selects = page.locator('form select')
      for (let i = 0; i < 5; i++) await selects.nth(i).selectOption(`p${i}`)
      for (let i = 0; i < 4; i++) await selects.nth(5 + i).selectOption(`d${i}`)
      await page
        .getByRole('button', {
          name: 'Wochenplan verbindlich starten',
          exact: true,
        })
        .click()
      await board.waitFor()
      assert.deepEqual(posts[0], {
        startMonday: '2026-11-02',
        memberOrder: plan.memberOrder,
        dutyOrder: plan.dutyOrder,
      })
    }
    await page.close()
    console.log(
      `${engine} ${width}: current/free/backlog, own-only completion/undo, next week, no overflow, light/dark, setup passed`,
    )
  }
  await browser.close()
}
