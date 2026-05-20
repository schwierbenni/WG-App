import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

const rotateSchema = z.object({
  dutyId: z.string().min(1, 'dutyId is required'),
})

function getNextDueDate(interval: string, from: Date = new Date()): Date {
  const date = new Date(from)
  switch (interval) {
    case 'DAILY': date.setDate(date.getDate() + 1); break
    case 'WEEKLY': date.setDate(date.getDate() + 7); break
    case 'BIWEEKLY': date.setDate(date.getDate() + 14); break
    case 'MONTHLY': date.setMonth(date.getMonth() + 1); break
    default: date.setDate(date.getDate() + 7); break
  }
  return date
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return new Response('Unauthorized', { status: 401 })
  if (session.user.role !== 'ADMIN') return Response.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = rotateSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const { dutyId } = parsed.data

    const duty = await prisma.duty.findUnique({ where: { id: dutyId } })
    if (!duty) return Response.json({ error: 'Duty not found' }, { status: 404 })
    if (!duty.isActive || duty.isPaused) return Response.json({ error: 'Duty is not active or is paused' }, { status: 400 })

    const rotationOrder = duty.rotationOrder
    if (rotationOrder.length === 0) return Response.json({ error: 'No rotation order defined' }, { status: 400 })

    const lastAssignment = await prisma.dutyAssignment.findFirst({
      where: { dutyId },
      orderBy: { createdAt: 'desc' },
    })

    let nextUserId: string
    if (!lastAssignment) {
      nextUserId = rotationOrder[0]
    } else {
      const currentIndex = rotationOrder.indexOf(lastAssignment.userId)
      const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % rotationOrder.length
      nextUserId = rotationOrder[nextIndex]
    }

    const nextUser = await prisma.user.findUnique({ where: { id: nextUserId } })
    if (!nextUser) return Response.json({ error: 'Next user in rotation not found' }, { status: 404 })

    const dueDate = getNextDueDate(duty.rotationInterval)

    const assignment = await prisma.dutyAssignment.create({
      data: { dutyId, userId: nextUserId, dueDate },
      include: {
        duty: true,
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    })

    await prisma.notification.create({
      data: {
        userId: nextUserId,
        type: 'ASSIGNMENT',
        message: `You have been assigned to "${duty.name}". Due: ${dueDate.toLocaleDateString()}`,
      },
    })

    return Response.json({ assignment }, { status: 201 })
  } catch (error) {
    console.error('POST rotate error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
