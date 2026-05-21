import { requireWgSession } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { session, wgId } = auth

  const { id } = await params

  try {
    const expense = await prisma.expense.findUnique({ where: { id } })
    if (!expense || expense.wgId !== wgId) {
      return Response.json({ error: 'Nicht gefunden' }, { status: 404 })
    }
    if (expense.paidBy !== session.user.id && session.user.role !== 'ADMIN') {
      return Response.json({ error: 'Nur der Zahler oder ein Admin kann löschen' }, { status: 403 })
    }

    await prisma.expense.delete({ where: { id } })
    return new Response(null, { status: 204 })
  } catch (error) {
    console.error('DELETE expense error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
