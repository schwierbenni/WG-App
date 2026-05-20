import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

export async function GET() {
  const session = await auth()
  if (!session) return new Response('Unauthorized', { status: 401 })

  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, avatarUrl: true, role: true, emailNotifications: true, createdAt: true },
      orderBy: { name: 'asc' },
    })
    return Response.json({ users })
  } catch (error) {
    logger.error('GET /api/users fehlgeschlagen', { error: error instanceof Error ? error.message : String(error) })
    return Response.json({ error: 'Benutzerliste konnte nicht geladen werden.' }, { status: 500 })
  }
}
