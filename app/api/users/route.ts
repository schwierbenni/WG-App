import { requireWgSession } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

export async function GET() {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { wgId } = auth

  try {
    const users = await prisma.user.findMany({
      where: { wgId },
      select: { id: true, name: true, email: true, avatarUrl: true, role: true, wgId: true, emailNotifications: true, createdAt: true },
      orderBy: { name: 'asc' },
    })
    return Response.json({ users })
  } catch (error) {
    logger.error('GET /api/users fehlgeschlagen', { error: error instanceof Error ? error.message : String(error) })
    return Response.json({ error: 'Benutzerliste konnte nicht geladen werden.' }, { status: 500 })
  }
}
