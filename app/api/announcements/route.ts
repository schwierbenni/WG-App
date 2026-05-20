import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

const createAnnouncementSchema = z.object({
  content: z.string().min(1, 'Content is required').max(500, 'Content must be 500 characters or less'),
})

export async function GET() {
  const session = await auth()
  if (!session) return new Response('Unauthorized', { status: 401 })

  try {
    const announcements = await prisma.announcement.findMany({
      include: {
        author: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        reactions: {
          select: { id: true, userId: true, emoji: true },
        },
      },
      orderBy: { createdAt: 'desc' },
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
  const session = await auth()
  if (!session) return new Response('Unauthorized', { status: 401 })

  try {
    const body = await request.json()
    const parsed = createAnnouncementSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const announcement = await prisma.announcement.create({
      data: { content: parsed.data.content, authorId: session.user.id },
      include: {
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    })

    const allUsers = await prisma.user.findMany({
      where: { id: { not: session.user.id } },
      select: { id: true },
    })

    if (allUsers.length > 0) {
      await prisma.notification.createMany({
        data: allUsers.map((user: { id: string }) => ({
          userId: user.id,
          type: 'ANNOUNCEMENT' as const,
          message: `New announcement: "${parsed.data.content.slice(0, 80)}${parsed.data.content.length > 80 ? '...' : ''}"`,
        })),
      })
    }

    return Response.json({ announcement }, { status: 201 })
  } catch (error) {
    console.error('POST announcements error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
