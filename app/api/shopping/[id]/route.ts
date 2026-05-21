import { z } from 'zod'
import { requireWgSession } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

const patchItemSchema = z.object({
  action: z.enum(['buy', 'unbuy']),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { wgId } = auth

  const { id } = await params

  try {
    const body = await request.json()
    const parsed = patchItemSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const existing = await prisma.shoppingItem.findUnique({ where: { id, wgId } })
    if (!existing) return Response.json({ error: 'Shopping item not found' }, { status: 404 })

    const item = await prisma.shoppingItem.update({
      where: { id },
      data: { boughtAt: parsed.data.action === 'buy' ? new Date() : null },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    })

    return Response.json({ item })
  } catch (error) {
    console.error('PATCH shopping item error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { wgId } = auth

  const { id } = await params

  try {
    const existing = await prisma.shoppingItem.findUnique({ where: { id, wgId } })
    if (!existing) return Response.json({ error: 'Shopping item not found' }, { status: 404 })

    await prisma.shoppingItem.delete({ where: { id } })
    return new Response(null, { status: 204 })
  } catch (error) {
    console.error('DELETE shopping item error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
