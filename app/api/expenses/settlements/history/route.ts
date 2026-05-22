import { requireWgSession } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { wgId } = auth

  try {
    const settlements = await prisma.settlement.findMany({
      where: { wgId },
      include: {
        fromUser: { select: { id: true, name: true, avatarUrl: true } },
        toUser: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return Response.json({ settlements })
  } catch (error) {
    console.error('GET settlements history error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
