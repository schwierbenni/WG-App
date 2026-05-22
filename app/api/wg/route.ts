import { z } from 'zod'
import { requireWgSession } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

const patchWgSchema = z.object({
  name: z.string().min(1, 'Name darf nicht leer sein').max(100).optional(),
  avatarUrl: z.string().url('Ungültige URL').nullable().optional(),
})

export async function GET() {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { wgId } = auth

  try {
    const wg = await prisma.wGConfig.findUnique({
      where: { id: wgId },
      select: { id: true, name: true, avatarUrl: true, inviteCode: true, createdAt: true },
    })

    if (!wg) return Response.json({ error: 'WG nicht gefunden.' }, { status: 404 })

    return Response.json({ wg })
  } catch (error) {
    console.error('GET /api/wg error:', error)
    return Response.json({ error: 'WG konnte nicht geladen werden.' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { session, wgId } = auth

  if (session.user.role !== 'ADMIN') {
    return Response.json({ error: 'Nur Admins können die WG bearbeiten.' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const parsed = patchWgSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' }, { status: 400 })
    }

    const { name, avatarUrl } = parsed.data
    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (avatarUrl !== undefined) data.avatarUrl = avatarUrl

    const wg = await prisma.wGConfig.update({
      where: { id: wgId },
      data,
      select: { id: true, name: true, avatarUrl: true, inviteCode: true, createdAt: true },
    })

    return Response.json({ wg })
  } catch (error) {
    console.error('PATCH /api/wg error:', error)
    return Response.json({ error: 'WG konnte nicht aktualisiert werden.' }, { status: 500 })
  }
}
