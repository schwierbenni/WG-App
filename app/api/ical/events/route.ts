import { requireWgSession } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { wgId } = auth

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const events = await prisma.iCalEvent.findMany({
    where: {
      wgId,
      ...(from || to
        ? {
            startDate: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    },
    include: {
      calendar: { select: { id: true, name: true, color: true, emoji: true } },
    },
    orderBy: { startDate: 'asc' },
  })

  return Response.json({ events })
}
