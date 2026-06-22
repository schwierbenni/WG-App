import { z } from 'zod'
import { requireWgSession } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { sendPushToUser } from '@/lib/push'

const createAssignmentSchema = z.object({
  dutyId: z.string().min(1, 'dutyId is required'),
  userId: z.string().min(1, 'userId is required'),
  dueDate: z.string().datetime({ message: 'Invalid date format' }),
})

export async function GET(request: Request) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { wgId } = auth

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  const dutyId = searchParams.get('dutyId')
  const upcoming = searchParams.get('upcoming') === 'true'
  const completed = searchParams.get('completed') === 'true'

  try {
    const where: Record<string, unknown> = { wgId }
    if (userId) where.userId = userId
    if (dutyId) where.dutyId = dutyId
    if (upcoming) {
      where.dueDate = { gt: new Date() }
      where.completedAt = null
    }
    if (completed) {
      where.completedAt = { not: null }
    }

    const assignments = await prisma.dutyAssignment.findMany({
      where,
      include: {
        duty: { select: { id: true, name: true, emoji: true, color: true, description: true } },
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
      orderBy: { dueDate: 'asc' },
    })

    return Response.json({ assignments })
  } catch (error) {
    console.error('GET assignments error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { session, wgId } = auth

  try {
    const body = await request.json()
    const parsed = createAssignmentSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const { dutyId, userId, dueDate } = parsed.data

    const duty = await prisma.duty.findUnique({ where: { id: dutyId, wgId } })
    if (!duty) return Response.json({ error: 'Duty not found' }, { status: 404 })

    const user = await prisma.user.findUnique({ where: { id: userId, wgId } })
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 })

    const assignment = await prisma.dutyAssignment.create({
      data: { wgId, dutyId, userId, dueDate: new Date(dueDate) },
      include: {
        duty: { select: { id: true, name: true, emoji: true, color: true } },
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    })

    const assignMsg = `Du wurdest für "${duty.name}" eingeteilt. Fällig: ${new Date(dueDate).toLocaleDateString('de-DE')}`

    await prisma.notification.create({
      data: { wgId, userId, type: 'ASSIGNMENT', message: assignMsg },
    })

    sendPushToUser(userId, { title: 'Neue Zuteilung', body: assignMsg, url: '/duties' }).catch(() => {})

    return Response.json({ assignment }, { status: 201 })
  } catch (error) {
    console.error('POST assignments error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
