export interface ICalEventParsed {
  uid: string
  summary: string | null
  description: string | null
  startDate: Date
  endDate: Date | null
  allDay: boolean
}

function unfoldLines(raw: string): string {
  return raw.replace(/\r\n[ \t]/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

function parseICalDate(value: string, tzid?: string): { date: Date; allDay: boolean } {
  const allDay = value.length === 8 && !value.includes('T')
  if (allDay) {
    const y = parseInt(value.slice(0, 4), 10)
    const m = parseInt(value.slice(4, 6), 10) - 1
    const d = parseInt(value.slice(6, 8), 10)
    return { date: new Date(y, m, d), allDay: true }
  }
  // e.g. 20240101T120000Z or 20240101T120000
  const utc = value.endsWith('Z')
  const clean = value.replace('Z', '').replace('T', '')
  const y = parseInt(clean.slice(0, 4), 10)
  const mo = parseInt(clean.slice(4, 6), 10) - 1
  const d = parseInt(clean.slice(6, 8), 10)
  const h = parseInt(clean.slice(8, 10), 10)
  const mi = parseInt(clean.slice(10, 12), 10)
  const s = parseInt(clean.slice(12, 14) || '0', 10)
  const date = utc
    ? new Date(Date.UTC(y, mo, d, h, mi, s))
    : new Date(y, mo, d, h, mi, s)
  return { date, allDay: false }
}

function unescapeValue(val: string): string {
  return val
    .replace(/\\n/g, '\n')
    .replace(/\\N/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
}

export function parseICS(raw: string): ICalEventParsed[] {
  const lines = unfoldLines(raw).split('\n')
  const events: ICalEventParsed[] = []
  let inEvent = false
  let current: Partial<ICalEventParsed> & { parsedStart?: { date: Date; allDay: boolean } } = {}

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === 'BEGIN:VEVENT') {
      inEvent = true
      current = {}
      continue
    }
    if (trimmed === 'END:VEVENT') {
      inEvent = false
      if (current.uid && current.parsedStart) {
        events.push({
          uid: current.uid,
          summary: current.summary ?? null,
          description: current.description ?? null,
          startDate: current.parsedStart.date,
          endDate: current.endDate ?? null,
          allDay: current.parsedStart.allDay,
        })
      }
      continue
    }
    if (!inEvent) continue

    // Split name;params:value
    const colonIdx = trimmed.indexOf(':')
    if (colonIdx === -1) continue
    const nameAndParams = trimmed.slice(0, colonIdx)
    const value = trimmed.slice(colonIdx + 1)

    // Extract property name (before first ';')
    const semiIdx = nameAndParams.indexOf(';')
    const propName = semiIdx === -1 ? nameAndParams : nameAndParams.slice(0, semiIdx)
    const params = semiIdx === -1 ? '' : nameAndParams.slice(semiIdx + 1)

    // Extract TZID from params if present
    const tzidMatch = params.match(/TZID=([^;]+)/)
    const tzid = tzidMatch ? tzidMatch[1] : undefined
    const valueType = params.match(/VALUE=([^;]+)/)?.[1]

    switch (propName.toUpperCase()) {
      case 'UID':
        current.uid = unescapeValue(value)
        break
      case 'SUMMARY':
        current.summary = unescapeValue(value)
        break
      case 'DESCRIPTION':
        current.description = unescapeValue(value)
        break
      case 'DTSTART': {
        const isDateOnly = valueType === 'DATE' || (value.length === 8 && !value.includes('T'))
        const parsed = parseICalDate(isDateOnly ? value.slice(0, 8) : value, tzid)
        current.parsedStart = parsed
        break
      }
      case 'DTEND': {
        const isDateOnly = valueType === 'DATE' || (value.length === 8 && !value.includes('T'))
        const parsed = parseICalDate(isDateOnly ? value.slice(0, 8) : value, tzid)
        current.endDate = parsed.date
        break
      }
    }
  }

  return events
}
