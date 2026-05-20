import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST() {
  const session = await auth()
  if (!session) return new Response('Unauthorized', { status: 401 })

  try {
    await prisma.notification.updateMany({
      where: { userId: session.user.id, readAt: null },
      data: { readAt: new Date() },
    })
    return Response.json({ message: 'All notifications marked as read' })
  } catch (error) {
    console.error('POST read-all notifications error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
