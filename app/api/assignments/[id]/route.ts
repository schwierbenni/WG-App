import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

const patchAssignmentSchema = z.union([
  z.object({ action: z.enum(['complete', 'uncomplete']) }),
  z.object({
    dutyId: z.string().optional(),
    userId: z.string().optional(),
    dueDate: z.string().datetime().optional(),
  }),
])

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return new Response('Unauthorized', { status: 401 })

  const { id } = await params

  try {
    const assignment = await prisma.dutyAssignment.findUnique({
      where: { id },
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
  const session = await auth()
  if (!session) return new Response('Unauthorized', { status: 401 })

  const { id } = await params

  try {
    const body = await request.json()
    const parsed = patchAssignmentSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const existing = await prisma.dutyAssignment.findUnique({ where: { id }, include: { duty: true } })
    if (!existing) return Response.json({ error: 'Assignment not found' }, { status: 404 })

    let updateData: Record<string, unknown> = {}
    let notificationMessage: string | null = null

    if ('action' in parsed.data) {
      if (parsed.data.action === 'complete') {
        updateData = { completedAt: new Date(), completedBy: session.user.id }
        notificationMessage = `Assignment "${existing.duty.name}" marked as complete.`
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

    if (notificationMessage) {
      await prisma.notification.create({
        data: { userId: existing.userId, type: 'ASSIGNMENT', message: notificationMessage },
      })
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
  const session = await auth()
  if (!session) return new Response('Unauthorized', { status: 401 })
  if (session.user.role !== 'ADMIN') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  try {
    await prisma.dutyAssignment.delete({ where: { id } })
    return new Response(null, { status: 204 })
  } catch (error) {
    console.error('DELETE assignment error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
