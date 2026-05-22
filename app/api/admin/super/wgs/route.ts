import { requireSuperAdminSession } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const auth = await requireSuperAdminSession()
  if (!auth.ok) return auth.response

  const wgs = await prisma.wGConfig.findMany({
    include: {
      members: {
        select: { id: true, name: true, email: true, role: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      },
      _count: {
        select: {
          duties: true,
          assignments: true,
          announcements: true,
          icalCalendars: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  return Response.json({ wgs })
}
