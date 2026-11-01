import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  berlinDayRange,
  isYellowBagCollection,
  yellowBagReminder,
} from '../lib/calendar-reminders'

for (const title of [
  'Gelber Sack',
  'Abholung Gelber Sack',
  'GELBER SACK',
  'Gelben Sack bereitstellen',
  'Gelbe Säcke',
  'Gelbe Saecke',
  'Gelber\u00a0Sack',
]) {
  test(`yellow bag: ${title}`, () =>
    assert.equal(isYellowBagCollection(title), true))
}
for (const title of [
  'Restmüll',
  'Biotonne',
  'Papier',
  'Gelbe Tonne',
  'Müllabfuhr',
  'Sack',
  'Gelber Sackhalter',
]) {
  test(`no extra day-before reminder: ${title}`, () =>
    assert.equal(isYellowBagCollection(title), false))
}
for (const [now, ahead, start, end] of [
  ['2026-11-01T23:30:00Z', 0, '2026-11-01T23:00:00Z', '2026-11-02T23:00:00Z'],
  ['2026-12-31T11:00:00Z', 1, '2026-12-31T23:00:00Z', '2027-01-01T23:00:00Z'],
  ['2026-03-28T11:00:00Z', 1, '2026-03-28T23:00:00Z', '2026-03-29T22:00:00Z'],
  ['2026-10-24T11:00:00Z', 1, '2026-10-24T22:00:00Z', '2026-10-25T23:00:00Z'],
  ['2026-07-01T22:30:00Z', 1, '2026-07-02T22:00:00Z', '2026-07-03T22:00:00Z'],
] as const) {
  test(`Berlin day ${now} + ${ahead}`, () => {
    const range = berlinDayRange(new Date(now), ahead)
    assert.equal(range.gte.toISOString(), new Date(start).toISOString())
    assert.equal(range.lt.toISOString(), new Date(end).toISOString())
  })
}
test('message explains next-morning collection and uses Berlin date', () => {
  assert.match(
    yellowBagReminder('Gelber Sack', new Date('2026-11-01T23:00:00Z')),
    /morgen früh abgeholt.*Montag, 2. November/,
  )
})
