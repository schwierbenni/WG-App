import { berlinDayRange } from './calendar-reminders'

export function dateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)!.value
  return `${get('year')}-${get('month')}-${get('day')}`
}
export function addDateDays(key: string, days: number): string {
  const date = new Date(`${key}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
export function mondayKey(now: Date): string {
  const key = dateKey(now),
    day = new Date(`${key}T00:00:00Z`).getUTCDay()
  return addDateDays(key, -((day + 6) % 7))
}
export function weekTiming(week: string) {
  const noon = new Date(`${week}T12:00:00Z`)
  const end = berlinDayRange(noon, 6).lt
  return {
    infoAt: new Date(+berlinDayRange(noon).gte + 7 * 60 * 60 * 1000),
    reminder: new Date(+end - 15 * 60 * 60 * 1000),
    end,
    deadline: new Date(+end - 1),
    graceEnd: berlinDayRange(noon, 7).lt,
  }
}
export function weeklyAllocation(
  start: string,
  week: string,
  members: string[],
  duties: string[],
) {
  if (
    members.length !== 5 ||
    new Set(members).size !== 5 ||
    duties.length !== 4 ||
    new Set(duties).size !== 4
  )
    throw new Error(
      'Exactly five different members and four different duties are required',
    )
  const rounds = (Date.parse(week) - Date.parse(start)) / (7 * 86400000)
  if (!Number.isInteger(rounds))
    throw new Error('Week must be aligned to the start Monday')
  if (rounds < 0) return null
  return {
    freeMemberId: members[rounds % 5],
    assignments: duties.map((dutyId, index) => ({
      dutyId,
      userId: members[(index + 1 + rounds) % 5],
    })),
  }
}
export function reminderStage(
  week: string,
  now: Date,
): 'reminder' | 'overdue' | 'escalation' | null {
  const time = weekTiming(week)
  return now >= time.graceEnd
    ? 'escalation'
    : now >= time.end
      ? 'overdue'
      : now >= time.reminder
        ? 'reminder'
        : null
}
export function dutyMessage(
  stage: 'reminder' | 'overdue' | 'escalation' | 'complete' | 'late',
  name: string,
  duty: string,
): string {
  switch (stage) {
    case 'reminder':
      return `Eieiei, ${name} hat noch keinen ${duty} gemacht.`
    case 'overdue':
      return `${name} ist ein Hurensohn und hat den ${duty} nicht geschafft.`
    case 'escalation':
      return `${name} ist der größte Wichser auf Erden und hat „${duty}“ auch am Nachholtag nicht erledigt.`
    case 'complete':
      return `${name} ist ein Good Boy und hat „${duty}“ erledigt! 🎉`
    case 'late':
      return `${name} hat „${duty}“ nachgeholt. Endlich! ✓`
  }
}

export function weeklyRoleMessage(duty?: string): string {
  return duty
    ? `Glückwunsch! Du hast diese Woche ${duty}.`
    : 'Mashallah einfach frei 🍻'
}

export function isSundayReminderWindow(now: Date): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin',
    weekday: 'short',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  return (
    parts.find((p) => p.type === 'weekday')?.value === 'Sun' &&
    parts.find((p) => p.type === 'hour')?.value === '09'
  )
}
