import { z } from 'zod'
import { requireWgSession } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { parseICS } from '@/lib/ical-parser'

const createCalendarSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  emoji: z.string().min(1).max(10),
  icsContent: z.string().min(1),
})

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

  let parsedEvents: ReturnType<typeof parseICS>
  try {
    parsedEvents = parseICS(icsContent)
  } catch {
    return Response.json({ error: 'Ungültige iCal-Datei' }, { status: 400 })
  }

  if (parsedEvents.length === 0) {
    return Response.json({ error: 'Keine Ereignisse in der Datei gefunden' }, { status: 400 })
  }

  const calendar = await prisma.iCalCalendar.create({
    data: { wgId, name, color, emoji },
  })

  const eventsToCreate = parsedEvents.map((e) => ({
    calendarId: calendar.id,
    wgId,
    uid: e.uid,
    title: e.summary ?? '(Kein Titel)',
    description: e.description,
    startDate: e.startDate,
    endDate: e.endDate,
    allDay: e.allDay,
  }))

  await prisma.iCalEvent.createMany({ data: eventsToCreate, skipDuplicates: true })

  const calendarWithCount = await prisma.iCalCalendar.findUnique({
    where: { id: calendar.id },
    include: { _count: { select: { events: true } } },
  })

  return Response.json({ calendar: calendarWithCount }, { status: 201 })
}
