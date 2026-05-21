import { z } from 'zod'
import { requireWgSession } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

const moveUserSchema = z.object({
  wgId: z.string().min(1, 'wgId ist erforderlich'),
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

  if (id === session.user.id) {
    return Response.json({ error: 'Du kannst dich nicht selbst verschieben.' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const parsed = moveUserSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' }, { status: 400 })
    }

    const { wgId } = parsed.data

    const targetWg = await prisma.wGConfig.findUnique({ where: { id: wgId }, select: { id: true, name: true } })
    if (!targetWg) return Response.json({ error: 'Ziel-WG nicht gefunden.' }, { status: 404 })

    const user = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true } })
    if (!user) return Response.json({ error: 'Benutzer nicht gefunden.' }, { status: 404 })

    const updated = await prisma.user.update({
      where: { id },
      data: { wgId },
      select: { id: true, name: true, email: true, wgId: true, role: true },
    })

    return Response.json({ user: updated, wgName: targetWg.name })
  } catch (error) {
    console.error('PATCH /api/admin/users/[id] error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
