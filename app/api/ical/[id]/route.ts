import { requireWgSession } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { wgId } = auth
  const { id } = await params

  const calendar = await prisma.iCalCalendar.findFirst({ where: { id, wgId } })
  if (!calendar) {
    return Response.json({ error: 'Kalender nicht gefunden' }, { status: 404 })
  }

  await prisma.iCalCalendar.delete({ where: { id } })
  return Response.json({ ok: true })
}
