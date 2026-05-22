import { z } from 'zod'
import { requireWgSession } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { sendPushToUser } from '@/lib/push'

const patchAssignmentSchema = z.union([
  z.object({ action: z.enum(['complete', 'uncomplete']) }),
  z.object({
    dutyId: z.string().optional(),
    userId: z.string().optional(),
    dueDate: z.string().datetime().optional(),
  }),
])

function getNextDueDate(interval: string, from: Date = new Date()): Date {
  const date = new Date(from)
  switch (interval) {
    case 'DAILY':    date.setDate(date.getDate() + 1);    break
    case 'WEEKLY':   date.setDate(date.getDate() + 7);    break
    case 'BIWEEKLY': date.setDate(date.getDate() + 14);   break
    case 'MONTHLY':  date.setMonth(date.getMonth() + 1);  break
    default:         date.setDate(date.getDate() + 7);    break
  }
  return date
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { wgId } = auth

  const { id } = await params

  try {
    const assignment = await prisma.dutyAssignment.findUnique({
      where: { id, wgId },
      include: {
        duty: true,
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    })

    if (!assignment) return Response.json({ error: 'Assignment not found' }, { status: 404 })

    return Response.json({ assignment })
  } catch (error) {
    console.error('GET assignment error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { session, wgId } = auth

  const { id } = await params

  try {
    const body = await request.json()
    const parsed = patchAssignmentSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const existing = await prisma.dutyAssignment.findUnique({ where: { id, wgId }, include: { duty: true } })
    if (!existing) return Response.json({ error: 'Assignment not found' }, { status: 404 })

    let updateData: Record<string, unknown> = {}

    if ('action' in parsed.data) {
      if (parsed.data.action === 'complete') {
        updateData = { completedAt: new Date(), completedBy: session.user.id }
      } else {
        updateData = { completedAt: null, completedBy: null }
      }
    } else {
      const { dutyId, userId, dueDate } = parsed.data
      if (dutyId) updateData.dutyId = dutyId
      if (userId) updateData.userId = userId
      if (dueDate) updateData.dueDate = new Date(dueDate)
    }

    const assignment = await prisma.dutyAssignment.update({
      where: { id },
      data: updateData,
      include: {
        duty: { select: { id: true, name: true, emoji: true, color: true } },
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    })

    if ('action' in parsed.data && parsed.data.action === 'complete') {
      const duty = existing.duty

      // Notify the person who completed it
      const doneMsg = `Du hast den Dienst „${duty.name}" als erledigt markiert.`
      await prisma.notification.create({
        data: { wgId, userId: existing.userId, type: 'ASSIGNMENT', message: doneMsg },
      })
      sendPushToUser(existing.userId, { title: 'Dienst erledigt ✓', body: doneMsg, url: '/duties' }).catch(() => {})

      // Auto-rotate: assign next person in rotation order
      const shouldRotate =
        duty.isActive &&
        !duty.isPaused &&
        duty.rotationInterval !== 'MANUAL' &&
        duty.rotationOrder.length > 0

      if (shouldRotate) {
        // Skip if another open assignment already exists for this duty
        const alreadyOpen = await prisma.dutyAssignment.findFirst({
          where: { dutyId: duty.id, wgId, completedAt: null, id: { not: id } },
        })

        if (!alreadyOpen) {
          const order = duty.rotationOrder
          const currentIndex = order.indexOf(existing.userId)
          const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % order.length
          const nextUserId = order[nextIndex]

          const nextUser = await prisma.user.findUnique({ where: { id: nextUserId, wgId } })
          if (nextUser) {
            const dueDate = getNextDueDate(duty.rotationInterval)
            await prisma.dutyAssignment.create({
              data: { wgId, dutyId: duty.id, userId: nextUserId, dueDate },
            })

            const assignMsg = `Du bist als Nächstes für „${duty.name}" eingeteilt. Fällig: ${dueDate.toLocaleDateString('de-DE')}`
            await prisma.notification.create({
              data: { wgId, userId: nextUserId, type: 'ASSIGNMENT', message: assignMsg },
            })
            sendPushToUser(nextUserId, { title: 'Neue Zuteilung', body: assignMsg, url: '/duties' }).catch(() => {})
          }
        }
      }
    }

    return Response.json({ assignment })
  } catch (error) {
    console.error('PATCH assignment error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { session, wgId } = auth

  if (session.user.role !== 'ADMIN') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  try {
    const existing = await prisma.dutyAssignment.findUnique({ where: { id, wgId } })
    if (!existing) return Response.json({ error: 'Assignment not found' }, { status: 404 })

    await prisma.dutyAssignment.delete({ where: { id } })
    return new Response(null, { status: 204 })
  } catch (error) {
    console.error('DELETE assignment error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
