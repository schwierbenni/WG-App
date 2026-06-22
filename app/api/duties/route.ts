import { z } from 'zod'
import { requireWgSession } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

const createDutySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  emoji: z.string().optional(),
  color: z.string().optional(),
  rotationInterval: z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'MANUAL']).optional(),
  checklistItems: z.array(z.string()).optional(),
  rotationOrder: z.array(z.string()).optional(),
})

export async function GET() {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { wgId } = auth

  try {
    const duties = await prisma.duty.findMany({
      where: { wgId, isActive: true },
      include: {
        assignments: {
          orderBy: [
            { completedAt: { sort: 'asc', nulls: 'first' } },
            { dueDate: 'desc' },
          ],
          take: 1,
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    return Response.json({ duties })
  } catch (error) {
    console.error('GET duties error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { session, wgId } = auth

  if (session.user.role !== 'ADMIN') return Response.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = createDutySchema.safeParse(body)

    if (!parsed.success) {
      return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const duty = await prisma.duty.create({
      data: {
        wgId,
        name: parsed.data.name,
        description: parsed.data.description,
        emoji: parsed.data.emoji,
        color: parsed.data.color ?? '#6366f1',
        rotationInterval: parsed.data.rotationInterval ?? 'WEEKLY',
        checklistItems: parsed.data.checklistItems ?? [],
        rotationOrder: parsed.data.rotationOrder ?? [],
      },
    })

    return Response.json({ duty }, { status: 201 })
  } catch (error) {
    console.error('POST duties error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
