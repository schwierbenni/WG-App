import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return new Response('Unauthorized', { status: 401 })

  const { id } = await params

  try {
    await prisma.notification.updateMany({
      where: { id, userId: session.user.id, readAt: null },
      data: { readAt: new Date() },
    })
    return Response.json({ ok: true })
  } catch (error) {
    console.error('POST notification read error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
