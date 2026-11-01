import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { resolve, dirname } from 'node:path'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
mkdirSync('tmp', { recursive: true })
const require = createRequire(resolve('package.json'))
const { build } = await import(
  pathToFileURL(
    require.resolve('esbuild', {
      paths: [dirname(require.resolve('tsx/package.json'))],
    }),
  )
)
const realDate = Date
globalThis.Date = class extends realDate {
  constructor(...args) {
    super(...(args.length ? args : ['2026-11-01T12:00:00Z']))
  }
  static now() {
    return new realDate('2026-11-01T12:00:00Z').getTime()
  }
}
const calendar = {
  wgId: 'test-wg',
  name: 'Abfall',
  emoji: '🗑️',
  id: 'test-cal',
}
const events = [
  ['yellow', 'Gelber Sack', '2026-11-02T00:00:00Z'],
  ['yellow2', 'Gelbe Säcke', '2026-11-02T08:00:00Z'],
  ['bio', 'Biotonne', '2026-11-02T00:00:00Z'],
  ['tonne', 'Gelbe Tonne', '2026-11-02T00:00:00Z'],
  ['paper', 'Papier', '2026-11-01T00:00:00Z'],
].map(([id, title, date]) => ({
  id,
  title,
  startDate: new Date(date),
  calendar,
}))
let writes = [],
  pushes = [],
  queries = []
globalThis.__testDb = {
  iCalEvent: {
    findMany: async (q) => {
      queries.push(q)
      return events.filter(
        (e) =>
          e.startDate >= q.where.startDate.gte &&
          e.startDate < q.where.startDate.lt &&
          (!q.where.title ||
            e.title.toLowerCase().includes(q.where.title.contains)),
      )
    },
  },
  wGEvent: { findMany: async () => [] },
  user: { findMany: async () => [{ id: 'test-user' }] },
  notification: { createMany: async (q) => writes.push(...q.data) },
}
globalThis.__testPush = async (wg, payload) => pushes.push({ wg, ...payload })
for (const [name, file] of [
  ['calendar', 'app/api/calendar/cron/route.ts'],
  ['ical', 'app/api/ical/cron/route.ts'],
]) {
  await build({
    entryPoints: [file],
    outfile: `tmp/cron-${name}.cjs`,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    plugins: [
      {
        name: 'test-doubles',
        setup(b) {
          b.onResolve({ filter: /^@\/lib\/(db|logger|push)$/ }, (a) => ({
            path: a.path,
            namespace: 'mock',
          }))
          b.onLoad({ filter: /.*/, namespace: 'mock' }, (a) => ({
            contents: a.path.endsWith('/db')
              ? 'export const prisma=globalThis.__testDb'
              : a.path.endsWith('/push')
                ? 'export const sendPushToWG=globalThis.__testPush'
                : 'export const logger={info(){},error(){}}',
            loader: 'js',
          }))
        },
      },
    ],
  })
  const { GET } = require(resolve(`tmp/cron-${name}.cjs`))
  delete process.env.CRON_SECRET
  assert.equal(
    (
      await GET(
        new Request('http://local', {
          headers: { authorization: 'Bearer undefined' },
        }),
      )
    ).status,
    401,
  )
  process.env.CRON_SECRET = 'fixture-only'
  assert.equal((await GET(new Request('http://local'))).status, 401)
  const res = await GET(
    new Request('http://local', {
      headers: { authorization: 'Bearer fixture-only' },
    }),
  )
  assert.equal(res.status, 200)
  const result = await res.json()
  assert.deepEqual(result.errors, [])
  assert.equal(result.notified, name === 'calendar' ? 2 : 1)
}
assert.equal(writes.length, 3)
assert.equal(pushes.length, 3)
assert.equal(writes.filter((w) => w.message.includes('morgen früh')).length, 2)
assert.equal(writes.filter((w) => w.message.includes('Papier')).length, 1)
assert(
  !writes.some(
    (w) => w.message.includes('Biotonne') || w.message.includes('Gelbe Tonne'),
  ),
)
console.log(
  'Cron integration passed: only yellow-bag events tomorrow; other waste excluded; today iCal once across both crons; unauthorized/unconfigured rejected; no real database or push requests.',
)
