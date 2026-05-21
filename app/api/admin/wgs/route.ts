import { z } from 'zod'
import { requireWgSession } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

const createWgSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich').max(100),
})

export async function GET() {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { session } = auth

  if (session.user.role !== 'ADMIN') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const wgs = await prisma.wGConfig.findMany({
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: 'asc' },
    })
    return Response.json({ wgs })
  } catch (error) {
    console.error('GET /api/admin/wgs error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { session } = auth

  if (session.user.role !== 'ADMIN') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const parsed = createWgSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' }, { status: 400 })
    }

    const wg = await prisma.wGConfig.create({
      data: { name: parsed.data.name },
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: { select: { members: true } },
      },
    })

    return Response.json({ wg }, { status: 201 })
  } catch (error) {
    console.error('POST /api/admin/wgs error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
