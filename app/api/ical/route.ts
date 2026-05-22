import { z } from 'zod'
import * as ical from 'node-ical'
import { requireWgSession } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

const createCalendarSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  emoji: z.string().min(1).max(10),
  icsContent: z.string().min(1),
})

function toStr(val: unknown): string | null {
  if (val == null) return null
  if (typeof val === 'string') return val
  if (typeof val === 'object' && 'val' in (val as object)) return String((val as { val: unknown }).val)
  return String(val)
}

export async function GET() {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { wgId } = auth

  const calendars = await prisma.iCalCalendar.findMany({
    where: { wgId },
    include: { _count: { select: { events: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return Response.json({ calendars })
}

export async function POST(request: Request) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { wgId } = auth

  const body = await request.json()
  const parsed = createCalendarSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Ungültige Eingaben', details: parsed.error.flatten() }, { status: 400 })
  }

  const { name, color, emoji, icsContent } = parsed.data

  let calData: ical.CalendarResponse
  try {
    calData = ical.sync.parseICS(icsContent)
  } catch {
    return Response.json({ error: 'Ungültige iCal-Datei' }, { status: 400 })
  }

  const calendar = await prisma.iCalCalendar.create({
    data: { wgId, name, color, emoji },
  })

  const eventsToCreate: {
    calendarId: string
    wgId: string
    uid: string
    title: string
    description: string | null
    startDate: Date
    endDate: Date | null
    allDay: boolean
  }[] = []

  for (const component of Object.values(calData)) {
    if (!component || component.type !== 'VEVENT') continue
    const event = component as ical.VEvent
    if (!event.uid || !event.start) continue

    const startDate = event.start instanceof Date ? event.start : new Date(event.start)
    const endDate = event.end
      ? event.end instanceof Date ? event.end : new Date(event.end)
      : null
    const allDay = event.datetype === 'date'
    const title = toStr(event.summary) ?? '(Kein Titel)'
    const description = toStr(event.description)

    eventsToCreate.push({
      calendarId: calendar.id,
      wgId,
      uid: String(event.uid),
      title,
      description,
      startDate,
      endDate,
      allDay,
    })
  }

  if (eventsToCreate.length > 0) {
    await prisma.iCalEvent.createMany({ data: eventsToCreate, skipDuplicates: true })
  }

  const calendarWithCount = await prisma.iCalCalendar.findUnique({
    where: { id: calendar.id },
    include: { _count: { select: { events: true } } },
  })

  return Response.json({ calendar: calendarWithCount }, { status: 201 })
}
