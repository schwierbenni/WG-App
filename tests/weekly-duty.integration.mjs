import { createTestDatabase } from './support/prisma-pglite.mjs'
import { createRequire } from 'node:module'
import { resolve, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
const require = createRequire(resolve('package.json'))
mkdirSync('tmp', { recursive: true })
writeFileSync(
  'tmp/weekly-baseline.prisma',
  execFileSync('git', [
    'show',
    'd8407a18bf61bee95ae55e720fbf35d91524286f:prisma/schema.prisma',
  ]),
)
const baseline = execFileSync(
  process.execPath,
  [
    require.resolve('prisma/build/index.js'),
    'migrate',
    'diff',
    '--from-empty',
    '--to-schema',
    'tmp/weekly-baseline.prisma',
    '--script',
  ],
  { encoding: 'utf8' },
)
const { db, prisma, close } = await createTestDatabase()
const RealDate = Date
let clock = '2026-11-01T12:00:00Z'
globalThis.Date = class extends RealDate {
  constructor(...args) {
    super(...(args.length ? args : [clock]))
  }
  static now() {
    return +new RealDate(clock)
  }
}
await db.exec(baseline)
await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;')
await db.exec(
  readFileSync(
    'prisma/migrations/20261101230000_weekly_duty_plan/migration.sql',
    'utf8',
  ),
)
await prisma.wGConfig.createMany({
  data: [
    { id: 'wg', name: 'Synthetic WG', inviteCode: 'test' },
    { id: 'other', name: 'Other WG', inviteCode: 'other' },
  ],
})
for (let i = 0; i < 5; i++)
  await prisma.user.create({
    data: {
      id: `p${i}`,
      wgId: 'wg',
      name: `Person ${i}`,
      email: `person${i}@example.invalid`,
      passwordHash: 'fixture',
    },
  })
await prisma.user.create({
  data: {
    id: 'outsider',
    wgId: 'other',
    name: 'Other Person',
    email: 'other@example.invalid',
    passwordHash: 'fixture',
  },
})
const dutyOrder = ['bath', 'living', 'supply', 'kitchen'],
  memberOrder = ['p0', 'p1', 'p2', 'p3', 'p4']
for (const id of dutyOrder)
  await prisma.duty.create({
    data: {
      id,
      wgId: 'wg',
      name: id,
      rotationOrder: memberOrder,
      checklistItems: [],
    },
  })
await prisma.dutyAssignment.create({
  data: {
    id: 'legacy',
    wgId: 'wg',
    dutyId: 'bath',
    userId: 'p0',
    dueDate: new Date('2026-11-01T00:00:00Z'),
  },
})
await prisma.weeklyDutyPlan.create({
  data: {
    wgId: 'wg',
    startMonday: new Date('2026-11-02T00:00:00Z'),
    memberOrder,
    dutyOrder,
  },
})
let pushes = [],
  failPush = false
globalThis.__testDb = prisma
globalThis.__testPush = async (userId, payload) => {
  pushes.push({ userId, ...payload })
  return failPush ? [{ status: 'rejected', reason: 'fixture failure' }] : []
}
globalThis.__testSession = {
  user: { id: 'p0', wgId: 'wg', role: 'ADMIN', name: 'Person 0' },
}
const { build } = await import(
  pathToFileURL(
    require.resolve('esbuild', {
      paths: [dirname(require.resolve('tsx/package.json'))],
    }),
  )
)
for (const [name, file] of [
  ['service', 'lib/weekly-duty-service.ts'],
  ['assignment', 'app/api/assignments/[id]/route.ts'],
  ['weekly', 'app/api/duties/weekly/route.ts'],
]) {
  await build({
    entryPoints: [file],
    outfile: `tmp/weekly-${name}.cjs`,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    plugins: [
      {
        name: 'test-doubles',
        setup(b) {
          b.onResolve(
            { filter: /^@\/lib\/(db|logger|push|api-auth)$/ },
            (a) => ({ path: a.path, namespace: 'mock' }),
          )
          b.onLoad({ filter: /.*/, namespace: 'mock' }, (a) => ({
            contents: a.path.endsWith('/db')
              ? 'export const prisma=globalThis.__testDb'
              : a.path.endsWith('/push')
                ? 'export const sendPushToUser=globalThis.__testPush; export const sendPushToWG=async()=>[]'
                : a.path.endsWith('/api-auth')
                  ? 'export const requireWgSession=async()=>({ok:true,session:globalThis.__testSession,wgId:globalThis.__testSession.user.wgId})'
                  : 'export const logger={info(){},error(){}}',
            loader: 'js',
          }))
        },
      },
    ],
  })
}
const service = require(resolve('tmp/weekly-service.cjs')),
  api = require(resolve('tmp/weekly-assignment.cjs')),
  weekly = require(resolve('tmp/weekly-weekly.cjs'))
const run = async (time) => {
  clock = time
  await service.runWeeklyDutyPlan('wg', new Date(clock))
}
const patch = async (id, body) =>
  api.PATCH(
    new Request('http://local', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  )
await run('2026-11-01T12:00:00Z')
assert.equal(
  await prisma.dutyAssignment.count({ where: { weekStart: { not: null } } }),
  0,
)
await run('2026-11-01T23:01:00Z')
assert.equal(
  await prisma.dutyAssignment.count({ where: { weekStart: { not: null } } }),
  4,
)
assert.equal(await prisma.notification.count(), 0)
await run('2026-11-02T07:00:00Z')
assert.equal(
  await prisma.dutyAssignment.count({ where: { weekStart: { not: null } } }),
  4,
)
assert.equal(await prisma.notification.count(), 5)
assert.equal(pushes.length, 5)
assert.match(
  (await prisma.notification.findFirst({ where: { userId: 'p0' } })).message,
  /frei/,
)
await run(clock)
assert.equal(await prisma.notification.count(), 5)
assert.equal(pushes.length, 5)
const first = await prisma.dutyAssignment.findMany({
    where: { weekStart: new Date('2026-11-02T00:00:00Z') },
  }),
  bath = first.find((a) => a.dutyId === 'bath'),
  living = first.find((a) => a.dutyId === 'living')
assert.equal((await patch(bath.id, { action: 'complete' })).status, 403)
globalThis.__testSession.user = {
  id: 'outsider',
  wgId: 'other',
  role: 'ADMIN',
  name: 'Other',
}
assert.equal((await patch(bath.id, { action: 'complete' })).status, 404)
globalThis.__testSession.user = {
  id: 'p1',
  wgId: 'wg',
  role: 'MEMBER',
  name: 'Person 1',
}
assert.equal((await patch(bath.id, { userId: 'p0' })).status, 409)
assert.equal((await patch(bath.id, { action: 'complete' })).status, 200)
assert.equal(await prisma.notification.count(), 10)
await patch(bath.id, { action: 'complete' })
assert.equal(await prisma.notification.count(), 10)
assert.equal(
  await prisma.notification.count({
    where: { message: { contains: 'Good Boy' } },
  }),
  5,
)
await run('2026-11-07T07:00:00Z')
assert.equal(
  await prisma.notification.count({
    where: { deliveryKey: { contains: ':reminder:' } },
  }),
  15,
)
await run(clock)
assert.equal(
  await prisma.notification.count({
    where: { deliveryKey: { contains: ':reminder:' } },
  }),
  15,
)
await run('2026-11-09T07:00:00Z')
assert.equal(
  await prisma.dutyAssignment.count({ where: { weekStart: { not: null } } }),
  8,
)
assert.equal(
  await prisma.notification.count({
    where: { deliveryKey: { contains: ':overdue:' } },
  }),
  15,
)
assert.equal(
  await prisma.dutyAssignment.count({
    where: { weekStart: new Date('2026-11-02T00:00:00Z'), completedAt: null },
  }),
  3,
)
globalThis.__testSession.user = {
  id: 'p2',
  wgId: 'wg',
  role: 'MEMBER',
  name: 'Person 2',
}
assert.equal((await patch(living.id, { action: 'complete' })).status, 200)
assert.equal(
  await prisma.notification.count({
    where: { message: { contains: 'nachgeholt' } },
  }),
  5,
)
await run('2026-11-10T07:00:00Z')
assert.equal(
  await prisma.notification.count({
    where: { deliveryKey: { contains: ':escalation:' } },
  }),
  10,
)
await run(clock)
assert.equal(
  await prisma.notification.count({
    where: { deliveryKey: { contains: ':escalation:' } },
  }),
  10,
)
assert.equal(await prisma.notification.count({ where: { wgId: 'other' } }), 0)
await run('2026-11-30T07:00:00Z')
assert.equal(
  await prisma.dutyAssignment.count({ where: { weekStart: { not: null } } }),
  20,
)
assert.equal(
  (await prisma.dutyAssignment.findUnique({ where: { id: 'legacy' } }))
    .weekStart,
  null,
)
await assert.rejects(
  prisma.dutyAssignment.create({
    data: {
      wgId: 'wg',
      dutyId: 'bath',
      userId: 'p0',
      weekStart: new Date('2026-11-02T00:00:00Z'),
      dueDate: new Date(clock),
    },
  }),
)
await prisma.$transaction((tx) =>
  service.queueWeeklyNotice(
    tx,
    'wg',
    ['p0'],
    'test-retry',
    'Test',
    'Retry message',
  ),
)
failPush = true
await service.dispatchWeeklyPush('wg')
assert.equal(
  await prisma.notification.count({
    where: { deliveryKey: { contains: 'test-retry' }, pushSentAt: null },
  }),
  1,
)
failPush = false
await service.dispatchWeeklyPush('wg')
assert.equal(
  await prisma.notification.count({
    where: { deliveryKey: { contains: 'test-retry' }, pushSentAt: null },
  }),
  0,
)
const post = (body) =>
  weekly.POST(
    new Request('http://local', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
assert.equal(
  (await post({ startMonday: '2026-11-02', memberOrder, dutyOrder })).status,
  403,
)
globalThis.__testSession.user.role = 'ADMIN'
assert.equal(
  (await post({ startMonday: '2026-11-03', memberOrder, dutyOrder })).status,
  400,
)
assert.equal(
  (
    await post({
      startMonday: '2026-11-02',
      memberOrder: ['p0', 'p0', 'p2', 'p3', 'p4'],
      dutyOrder,
    })
  ).status,
  400,
)
assert.equal(
  (await post({ startMonday: '2026-11-02', memberOrder, dutyOrder })).status,
  409,
)
await prisma.wGConfig.create({
  data: { id: 'fresh', name: 'Fresh test WG', inviteCode: 'fresh' },
})
for (let i = 0; i < 5; i++)
  await prisma.user.create({
    data: {
      id: `f${i}`,
      wgId: 'fresh',
      name: `Fresh ${i}`,
      email: `fresh${i}@example.invalid`,
      passwordHash: 'fixture',
    },
  })
for (let i = 0; i < 4; i++)
  await prisma.duty.create({
    data: {
      id: `fd${i}`,
      wgId: 'fresh',
      name: `Fresh duty ${i}`,
      rotationOrder: [],
      checklistItems: [],
    },
  })
globalThis.__testSession.user = {
  id: 'f0',
  wgId: 'fresh',
  role: 'ADMIN',
  name: 'Fresh 0',
}
assert.equal(
  (await post({ startMonday: '2026-11-02', memberOrder, dutyOrder })).status,
  400,
)
assert.equal(await prisma.weeklyDutyPlan.count({ where: { wgId: 'fresh' } }), 0)
assert.equal(
  (
    await post({
      startMonday: '2026-11-02',
      memberOrder: ['f0', 'f1', 'f2', 'f3', 'f4'],
      dutyOrder: ['fd0', 'fd1', 'fd2', 'fd3'],
    })
  ).status,
  201,
)
assert.equal(
  await prisma.dutyAssignment.count({
    where: { wgId: 'fresh', weekStart: { not: null } },
  }),
  20,
)
globalThis.__testSession.user = {
  id: 'p2',
  wgId: 'wg',
  role: 'MEMBER',
  name: 'Person 2',
}
const read = await weekly.GET()
assert.equal(read.status, 200)
const board = await read.json()
assert.equal(board.assignments.length, 4)
assert.equal(board.legacyBacklog.length, 1)
assert.equal(board.legacyBacklog[0].id, 'legacy')
assert(board.members.every((m) => m.id !== 'outsider'))
const rls = (
  await db.query(
    `SELECT relrowsecurity FROM pg_class WHERE relname = 'WeeklyDutyPlan'`,
  )
).rows[0].relrowsecurity
assert.equal(rls, true)
await db.exec('SET ROLE anon')
await assert.rejects(db.query('SELECT * FROM "WeeklyDutyPlan"'))
await db.exec('RESET ROLE')
console.log(
  'PASS: real PostgreSQL/Prisma migration; original data retained; 5-person weekly cycle; current week despite previous backlog; own-only completion; WG boundary; idempotent notifications; full Monday grace; catch-up; durable push retry; invalid setup; unique slots; RLS.',
)
await close()
