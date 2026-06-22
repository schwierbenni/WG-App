import { requireWgSession } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { session, wgId } = auth
  const { id } = await params

  const announcement = await prisma.announcement.findFirst({
    where: { id, wgId },
    select: { authorId: true },
  })

  if (!announcement) {
    return Response.json({ error: 'Nicht gefunden' }, { status: 404 })
  }

  const userRole = (session.user as { role?: string }).role
  if (announcement.authorId !== session.user.id && userRole !== 'ADMIN') {
    return Response.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  await prisma.announcement.delete({ where: { id } })
  return new Response(null, { status: 204 })
}
