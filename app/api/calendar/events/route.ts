import { z } from 'zod'
import { requireWgSession } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { sendPushToWG } from '@/lib/push'

const createEventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  startDate: z.string().min(1),
  endDate: z.string().optional(),
  allDay: z.boolean().default(false),
  notifyWG: z.boolean().default(false),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#6366f1'),
  emoji: z.string().min(1).max(10).default('📅'),
})

export async function GET() {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { wgId } = auth

  const events = await prisma.wGEvent.findMany({
    where: { wgId },
    include: { creator: { select: { id: true, name: true } } },
    orderBy: { startDate: 'asc' },
  })

  return Response.json({ events })
}

export async function POST(request: Request) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { wgId, session } = auth

  const body = await request.json()
  const parsed = createEventSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Ungültige Eingaben', details: parsed.error.flatten() }, { status: 400 })
  }

  const { title, description, startDate, endDate, allDay, notifyWG, color, emoji } = parsed.data

  const event = await prisma.wGEvent.create({
    data: {
      wgId,
      createdBy: session.user.id,
      title,
      description: description ?? null,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      allDay,
      notifyWG,
      color,
      emoji,
    },
    include: { creator: { select: { id: true, name: true } } },
  })

  if (notifyWG) {
    const dateStr = new Date(startDate).toLocaleDateString('de-DE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'Europe/Berlin',
    })
    const creatorName = session.user.name ?? 'Jemand'
    const msg = `${creatorName} hat ein neues Ereignis erstellt: ${title} – ${dateStr}`

    const wgMembers = await prisma.user.findMany({
      where: { wgId },
      select: { id: true },
    })

    await prisma.notification.createMany({
      data: wgMembers.map((u) => ({
        wgId,
        userId: u.id,
        type: 'WG_EVENT' as const,
        message: msg,
        link: '/calendar',
      })),
    })

    sendPushToWG(wgId, { title: `${emoji} Neues Ereignis`, body: msg, url: '/calendar' }).catch(() => {})
  }

  return Response.json({ event }, { status: 201 })
}
