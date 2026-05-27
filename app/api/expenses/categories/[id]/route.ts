import { z } from 'zod'
import { requireWgSession } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

const updateCategorySchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  emoji: z.string().max(4).nullable().optional(),
})

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { wgId } = auth

  const { id } = await params

  try {
    const cat = await prisma.wGExpenseCategory.findUnique({ where: { id } })
    if (!cat || cat.wgId !== wgId) {
      return Response.json({ error: 'Nicht gefunden' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = updateCategorySchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Validation failed' }, { status: 400 })
    }

    const updated = await prisma.wGExpenseCategory.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.color !== undefined && { color: parsed.data.color }),
        ...(parsed.data.emoji !== undefined && { emoji: parsed.data.emoji }),
      },
    })

    return Response.json({ category: updated })
  } catch (error) {
    console.error('PUT category error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { wgId } = auth

  const { id } = await params

  try {
    const cat = await prisma.wGExpenseCategory.findUnique({ where: { id } })
    if (!cat || cat.wgId !== wgId) {
      return Response.json({ error: 'Nicht gefunden' }, { status: 404 })
    }
    if (cat.isDefault) {
      return Response.json({ error: 'Standard-Kategorien können nicht gelöscht werden' }, { status: 403 })
    }

    await prisma.wGExpenseCategory.delete({ where: { id } })
    return new Response(null, { status: 204 })
  } catch (error) {
    console.error('DELETE category error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
