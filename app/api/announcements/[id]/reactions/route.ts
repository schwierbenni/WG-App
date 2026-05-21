import { z } from 'zod'
import { requireWgSession } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

const reactionSchema = z.object({
  emoji: z.string().min(1, 'Emoji is required'),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { session, wgId } = auth

  const { id: announcementId } = await params

  try {
    const body = await request.json()
    const parsed = reactionSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const { emoji } = parsed.data
    const userId = session.user.id

    const announcement = await prisma.announcement.findUnique({ where: { id: announcementId, wgId } })
    if (!announcement) {
      return Response.json({ error: 'Announcement not found' }, { status: 404 })
    }

    const existing = await prisma.announcementReaction.findUnique({
      where: { announcementId_userId_emoji: { announcementId, userId, emoji } },
    })

    if (existing) {
      await prisma.announcementReaction.delete({ where: { id: existing.id } })
      return Response.json({ toggled: false, message: 'Reaction removed' })
    }

    const reaction = await prisma.announcementReaction.create({
      data: { announcementId, userId, emoji },
    })

    return Response.json({ toggled: true, reaction }, { status: 201 })
  } catch (error) {
    console.error('POST reaction error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
