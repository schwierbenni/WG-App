import { requireWgSession } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { wgId, session } = auth

  const { id } = await params

  const event = await prisma.wGEvent.findUnique({ where: { id } })
  if (!event || event.wgId !== wgId) {
    return Response.json({ error: 'Nicht gefunden' }, { status: 404 })
  }

  if (event.createdBy !== session.user.id && session.user.role !== 'ADMIN') {
    return Response.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  await prisma.wGEvent.delete({ where: { id } })
  return Response.json({ ok: true })
}
