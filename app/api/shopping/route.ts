import { z } from 'zod'
import { requireWgSession } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

const createItemSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  category: z.enum(['LEBENSMITTEL', 'HAUSHALT', 'SONSTIGES']).optional(),
  note: z.string().optional(),
})

export async function GET() {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { wgId } = auth

  try {
    const items = await prisma.shoppingItem.findMany({
      where: { wgId },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      orderBy: [{ boughtAt: 'asc' }, { createdAt: 'asc' }],
    })

    const sorted = [
      ...items.filter((i: { boughtAt: Date | null }) => !i.boughtAt),
      ...items.filter((i: { boughtAt: Date | null }) => i.boughtAt),
    ]

    return Response.json({ items: sorted })
  } catch (error) {
    console.error('GET shopping error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { session, wgId } = auth

  try {
    const body = await request.json()
    const parsed = createItemSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const item = await prisma.shoppingItem.create({
      data: { wgId, name: parsed.data.name, category: parsed.data.category ?? 'LEBENSMITTEL', note: parsed.data.note, addedBy: session.user.id },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    })

    return Response.json({ item }, { status: 201 })
  } catch (error) {
    console.error('POST shopping error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
