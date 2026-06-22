import { z } from 'zod'
import { requireWgSession } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { sendPushToUser } from '@/lib/push'

const createTaskSchema = z.object({
  title: z.string().min(1, 'Titel ist erforderlich').max(200),
  content: z.string().max(500).optional(),
  dueDate: z.string().min(1, 'Stichtag ist erforderlich'),
  assignedUserId: z.string().min(1, 'Verantwortliche Person ist erforderlich'),
})

export async function GET() {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { wgId } = auth

  try {
    const announcements = await prisma.announcement.findMany({
      where: { wgId },
      include: {
        author: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        assignedUser: {
          select: { id: true, name: true, avatarUrl: true },
        },
        reactions: {
          select: { id: true, userId: true, emoji: true },
        },
      },
      orderBy: { dueDate: 'asc' },
    })

    const result = announcements.map((announcement: typeof announcements[number]) => {
      const reactionCounts: Record<string, number> = {}
      for (const r of announcement.reactions) {
        reactionCounts[r.emoji] = (reactionCounts[r.emoji] ?? 0) + 1
      }
      return { ...announcement, reactionCounts }
    })

    return Response.json({ announcements: result })
  } catch (error) {
    console.error('GET announcements error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { session, wgId } = auth

  try {
    const body = await request.json()
    const parsed = createTaskSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const { title, content, dueDate, assignedUserId } = parsed.data

    const assignedUser = await prisma.user.findFirst({
      where: { id: assignedUserId, wgId },
      select: { id: true, name: true },
    })
    if (!assignedUser) {
      return Response.json({ error: 'Zugewiesene Person nicht gefunden' }, { status: 400 })
    }

    const announcement = await prisma.announcement.create({
      data: {
        wgId,
        authorId: session.user.id,
        title,
        content: content ?? null,
        dueDate: new Date(dueDate),
        assignedUserId,
      },
      include: {
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
        assignedUser: { select: { id: true, name: true, avatarUrl: true } },
      },
    })

    const dueDateStr = new Date(dueDate).toLocaleDateString('de-DE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Europe/Berlin',
    })
    const creatorName = session.user.name ?? 'Jemand'
    const pushMsg = `${creatorName} hat dir eine Aufgabe zugewiesen: ${title} – fällig am ${dueDateStr}`

    await prisma.notification.create({
      data: {
        wgId,
        userId: assignedUserId,
        type: 'BULLETIN_TASK',
        message: pushMsg,
        link: '/announcements',
      },
    })

    sendPushToUser(assignedUserId, {
      title: '📋 Neue Aufgabe',
      body: pushMsg,
      url: '/announcements',
    }).catch(() => {})

    return Response.json({ announcement }, { status: 201 })
  } catch (error) {
    console.error('POST announcements error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
