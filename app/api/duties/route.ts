import { z } from 'zod'
import { requireWgSession } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { rotateDueDuties } from '@/lib/duty-rotation'

const createDutySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  emoji: z.string().optional(),
  color: z.string().optional(),
  rotationInterval: z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'MANUAL']).optional(),
  dueWeekday: z.number().int().min(0).max(6).nullable().optional(),
  checklistItems: z.array(z.string()).optional(),
  rotationOrder: z.array(z.string()).optional(),
})

export async function GET() {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { wgId } = auth

  try {
    // Self-healing rotation: whenever the duty board is opened, any duty past
    // its Stichtag (due date) is rotated to the next person automatically.
    // This does not depend on the external Vercel Cron actually being wired
    // up, so rotation reliably happens without a manual admin action.
    try {
      await rotateDueDuties({ wgId })
    } catch (error) {
      logger.error('Automatische Dienstrotation (on-read) fehlgeschlagen', { wgId, error: String(error) })
    }

    const duties = await prisma.duty.findMany({
      where: { wgId, isActive: true },
      include: {
        assignments: {
          orderBy: [
            { completedAt: { sort: 'desc', nulls: 'first' } },
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
        dueWeekday: parsed.data.dueWeekday ?? null,
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
