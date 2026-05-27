import { z } from 'zod'
import { requireWgSession } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

const createCategorySchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Ungültiges Farbformat'),
  emoji: z.string().max(4).optional(),
})

export async function GET() {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { wgId } = auth

  try {
    const categories = await prisma.wGExpenseCategory.findMany({
      where: { wgId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
    return Response.json({ categories })
  } catch (error) {
    console.error('GET categories error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { wgId } = auth

  try {
    const body = await request.json()
    const parsed = createCategorySchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const { name, color, emoji } = parsed.data
    const slug = name.toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') + '_' + Date.now()

    const existing = await prisma.wGExpenseCategory.findFirst({ where: { wgId, slug } })
    if (existing) {
      return Response.json({ error: 'Kategorie mit diesem Namen existiert bereits' }, { status: 409 })
    }

    const maxOrder = await prisma.wGExpenseCategory.aggregate({ where: { wgId }, _max: { sortOrder: true } })
    const sortOrder = (maxOrder._max.sortOrder ?? 0) + 1

    const category = await prisma.wGExpenseCategory.create({
      data: { wgId, name, slug, color, emoji: emoji ?? null, isDefault: false, sortOrder },
    })

    return Response.json({ category }, { status: 201 })
  } catch (error) {
    console.error('POST category error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
