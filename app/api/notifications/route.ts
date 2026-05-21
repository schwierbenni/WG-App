import { z } from 'zod'
import { requireWgSession } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

const patchNotificationsSchema = z.object({
  action: z.literal('markAllRead'),
})

export async function GET() {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { session, wgId } = auth

  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: session.user.id, wgId },
      orderBy: [{ readAt: 'asc' }, { createdAt: 'desc' }],
      take: 50,
    })

    const sorted = [
      ...notifications.filter((n: { readAt: Date | null }) => !n.readAt),
      ...notifications.filter((n: { readAt: Date | null }) => n.readAt),
    ]

    return Response.json({ notifications: sorted })
  } catch (error) {
    console.error('GET notifications error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { session, wgId } = auth

  try {
    const body = await request.json()
    const parsed = patchNotificationsSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    await prisma.notification.updateMany({
      where: { userId: session.user.id, wgId, readAt: null },
      data: { readAt: new Date() },
    })

    return Response.json({ message: 'All notifications marked as read' })
  } catch (error) {
    console.error('PATCH notifications error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
