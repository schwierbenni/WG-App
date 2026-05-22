import { requireWgSession } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { wgId } = auth

  const { id } = await params

  try {
    const expense = await prisma.expense.findUnique({ where: { id } })
    if (!expense || expense.wgId !== wgId) {
      return Response.json({ error: 'Nicht gefunden' }, { status: 404 })
    }

    await prisma.expense.update({
      where: { id },
      data: { settledAt: new Date() },
    })

    return Response.json({ ok: true })
  } catch (error) {
    console.error('POST settle expense error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
