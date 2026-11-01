const berlin = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

function parts(date: Date) {
  return Object.fromEntries(
    berlin.formatToParts(date).map(({ type, value }) => [type, value]),
  )
}

// Convert a Berlin wall-clock midnight to UTC, including DST transitions.
function midnight(year: number, month: number, day: number): Date {
  const target = Date.UTC(year, month - 1, day)
  let instant = target
  for (let i = 0; i < 3; i++) {
    const p = parts(new Date(instant))
    const wallClock = Date.UTC(
      +p.year,
      +p.month - 1,
      +p.day,
      +p.hour,
      +p.minute,
      +p.second,
    )
    instant += target - wallClock
  }
  return new Date(instant)
}

/** Half-open local-day range; independent of the server's configured timezone. */
export function berlinDayRange(now: Date, daysAhead = 0) {
  const p = parts(now)
  const date = new Date(Date.UTC(+p.year, +p.month - 1, +p.day + daysAhead))
  const year = date.getUTCFullYear(),
    month = date.getUTCMonth() + 1,
    day = date.getUTCDate()
  return { gte: midnight(year, month, day), lt: midnight(year, month, day + 1) }
}

export function isYellowBagCollection(title: string): boolean {
  return /\bgelb(?:er|en|e)\s+(?:sack|säcke|saecke)\b/iu.test(
    title.normalize('NFKC'),
  )
}

export function yellowBagReminder(title: string, startDate: Date): string {
  const date = startDate.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Berlin',
  })
  return `${title} – wird morgen früh abgeholt (${date}). Bitte bereitstellen.`
}
