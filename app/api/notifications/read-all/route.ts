import { requireWgSession } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

export async function POST() {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { session, wgId } = auth

  try {
    await prisma.notification.updateMany({
      where: { userId: session.user.id, wgId, readAt: null },
      data: { readAt: new Date() },
    })
    return Response.json({ message: 'All notifications marked as read' })
  } catch (error) {
    console.error('POST read-all notifications error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
