import { z } from 'zod'
import { requireWgSession } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { sendPushToUser } from '@/lib/push'
import { getAssignmentDueDate, withDueDate } from '@/lib/duty-rotation'

const createAssignmentSchema = z.object({
  dutyId: z.string().min(1, 'dutyId is required'),
  userId: z.string().min(1, 'userId is required'),
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
      where.completedAt = null
    }
    if (completed) {
      where.completedAt = { not: null }
    }

    const rows = await prisma.dutyAssignment.findMany({
      where,
      include: {
        duty: { select: { id: true, name: true, emoji: true, color: true, description: true, rotationInterval: true, dueWeekday: true } },
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    })

    // dueDate is derived, not a DB column, so upcoming-filtering and
    // due-date sorting both happen here in memory.
    let assignments = rows.map(withDueDate)
    if (upcoming) assignments = assignments.filter((a) => a.dueDate > new Date())
    assignments.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())

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

    const { dutyId, userId } = parsed.data

    const duty = await prisma.duty.findUnique({ where: { id: dutyId, wgId } })
    if (!duty) return Response.json({ error: 'Duty not found' }, { status: 404 })

    const user = await prisma.user.findUnique({ where: { id: userId, wgId } })
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 })

    const assignment = await prisma.dutyAssignment.create({
      data: { wgId, dutyId, userId },
      include: {
        duty: { select: { id: true, name: true, emoji: true, color: true, rotationInterval: true, dueWeekday: true } },
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    })
    const dueDate = getAssignmentDueDate(duty, assignment)

    const assignMsg = `Du wurdest für "${duty.name}" eingeteilt. Fällig: ${dueDate.toLocaleDateString('de-DE')}`

    await prisma.notification.create({
      data: { wgId, userId, type: 'ASSIGNMENT', message: assignMsg },
    })

    sendPushToUser(userId, { title: 'Neue Zuteilung', body: assignMsg, url: '/duties' }).catch(() => {})

    return Response.json({ assignment: { ...assignment, dueDate } }, { status: 201 })
  } catch (error) {
    console.error('POST assignments error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
