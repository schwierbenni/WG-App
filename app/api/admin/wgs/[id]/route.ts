import { z } from 'zod'
import { requireWgSession } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

const renameSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich').max(100),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { session } = auth

  if (session.user.role !== 'ADMIN') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  try {
    const body = await request.json()
    const parsed = renameSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' }, { status: 400 })
    }

    const existing = await prisma.wGConfig.findUnique({ where: { id } })
    if (!existing) return Response.json({ error: 'WG nicht gefunden.' }, { status: 404 })

    const wg = await prisma.wGConfig.update({
      where: { id },
      data: { name: parsed.data.name },
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: { select: { members: true } },
      },
    })

    return Response.json({ wg })
  } catch (error) {
    console.error('PATCH /api/admin/wgs/[id] error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
