import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  mondayKey,
  weeklyAllocation,
  weekTiming,
  reminderStage,
  addDateDays,
  dutyMessage,
} from '../lib/weekly-duty'
const members = ['p0', 'p1', 'p2', 'p3', 'p4'],
  duties = ['bath', 'living', 'supply', 'kitchen']
test('five-person/four-duty start and following week', () => {
  const first = weeklyAllocation('2026-11-02', '2026-11-02', members, duties)!
  assert.equal(first.freeMemberId, 'p0')
  assert.deepEqual(
    first.assignments.map((a) => a.userId),
    ['p1', 'p2', 'p3', 'p4'],
  )
  const next = weeklyAllocation('2026-11-02', '2026-11-09', members, duties)!
  assert.equal(next.freeMemberId, 'p1')
  assert.deepEqual(
    next.assignments.map((a) => a.userId),
    ['p2', 'p3', 'p4', 'p0'],
  )
})
test('each person gets each duty and exactly one free week per five-week cycle', () => {
  const history = members.map(() => new Set<string>())
  for (let i = 0; i < 20; i++) {
    const week = addDateDays('2026-11-02', i * 7),
      round = weeklyAllocation('2026-11-02', week, members, duties)!
    assert.equal(
      new Set([...round.assignments.map((a) => a.userId), round.freeMemberId])
        .size,
      5,
    )
    if (i < 5) {
      history[members.indexOf(round.freeMemberId)].add('free')
      round.assignments.forEach((a) =>
        history[members.indexOf(a.userId)].add(a.dutyId),
      )
    }
    if (i >= 5)
      assert.deepEqual(
        round,
        weeklyAllocation(
          '2026-11-02',
          addDateDays('2026-11-02', (i % 5) * 7),
          members,
          duties,
        ),
      )
  }
  history.forEach((roles) => assert.equal(roles.size, 5))
})
test('no plan before anchor; reject duplicate people/duties and misaligned weeks', () => {
  assert.equal(
    weeklyAllocation('2026-11-02', '2026-10-26', members, duties),
    null,
  )
  assert.throws(() =>
    weeklyAllocation('2026-11-02', '2026-11-03', members, duties),
  )
  assert.throws(() =>
    weeklyAllocation(
      '2026-11-02',
      '2026-11-02',
      ['p0', 'p0', 'p2', 'p3', 'p4'],
      duties,
    ),
  )
  assert.throws(() =>
    weeklyAllocation('2026-11-02', '2026-11-02', members, [
      'bath',
      'bath',
      'supply',
      'kitchen',
    ]),
  )
})
test('Berlin week switches independently of host timezone', () => {
  assert.equal(mondayKey(new Date('2026-11-01T22:59:59Z')), '2026-10-26')
  assert.equal(mondayKey(new Date('2026-11-01T23:00:00Z')), '2026-11-02')
})
for (const week of ['2026-11-02', '2026-03-23', '2026-10-19', '2026-12-28'])
  test(`deadline and full Monday grace: ${week}`, () => {
    const timing = weekTiming(week)
    assert.equal(reminderStage(week, new Date(+timing.reminder - 1)), null)
    assert.equal(reminderStage(week, timing.reminder), 'reminder')
    assert.equal(reminderStage(week, timing.deadline), 'reminder')
    assert.equal(reminderStage(week, timing.end), 'overdue')
    assert.equal(reminderStage(week, new Date(+timing.graceEnd - 1)), 'overdue')
    assert.equal(reminderStage(week, timing.graceEnd), 'escalation')
    assert.equal(mondayKey(timing.end), addDateDays(week, 7))
  })
test('requested message wording and late completion are distinct', () => {
  assert.match(dutyMessage('complete', 'Testperson', 'Bad'), /Good Boy/)
  assert.match(dutyMessage('overdue', 'Testperson', 'Bad'), /Hurensohn/)
  assert.match(dutyMessage('escalation', 'Testperson', 'Bad'), /größte Wichser/)
  assert.match(dutyMessage('late', 'Testperson', 'Bad'), /nachgeholt/)
})
