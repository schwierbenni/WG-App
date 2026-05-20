import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

const patchSwapSchema = z.object({
  action: z.enum(['accept', 'reject']),
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return new Response('Unauthorized', { status: 401 })

  const { id } = await params

  try {
    const swapRequest = await prisma.swapRequest.findUnique({
      where: { id },
      include: {
        fromUser: { select: { id: true, name: true, email: true, avatarUrl: true } },
        toUser: { select: { id: true, name: true, email: true, avatarUrl: true } },
        assignment: { include: { duty: { select: { id: true, name: true, emoji: true, color: true } } } },
      },
    })

    if (!swapRequest) return Response.json({ error: 'Swap request not found' }, { status: 404 })

    const userId = session.user.id
    if (swapRequest.fromUserId !== userId && swapRequest.toUserId !== userId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    return Response.json({ swapRequest })
  } catch (error) {
    console.error('GET swap-request error:', error)
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
    const parsed = patchSwapSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const swapRequest = await prisma.swapRequest.findUnique({
      where: { id },
      include: {
        assignment: { include: { duty: true } },
        fromUser: { select: { id: true, name: true } },
        toUser: { select: { id: true, name: true } },
      },
    })

    if (!swapRequest) return Response.json({ error: 'Swap request not found' }, { status: 404 })
    if (swapRequest.toUserId !== session.user.id) return Response.json({ error: 'Only the recipient can accept or reject' }, { status: 403 })
    if (swapRequest.status !== 'PENDING') return Response.json({ error: 'Swap request is no longer pending' }, { status: 409 })

    const { action } = parsed.data
    const newStatus = action === 'accept' ? 'ACCEPTED' : 'REJECTED'

    const updated = await prisma.swapRequest.update({
      where: { id },
      data: { status: newStatus },
      include: {
        fromUser: { select: { id: true, name: true, email: true, avatarUrl: true } },
        toUser: { select: { id: true, name: true, email: true, avatarUrl: true } },
        assignment: { include: { duty: { select: { id: true, name: true, emoji: true, color: true } } } },
      },
    })

    if (action === 'accept') {
      await prisma.dutyAssignment.update({
        where: { id: swapRequest.assignmentId },
        data: { userId: swapRequest.toUserId },
      })

      await prisma.notification.createMany({
        data: [
          { userId: swapRequest.fromUserId, type: 'SWAP_REQUEST', message: `${swapRequest.toUser.name} accepted your swap request for "${swapRequest.assignment.duty.name}".` },
          { userId: swapRequest.toUserId, type: 'ASSIGNMENT', message: `You are now assigned to "${swapRequest.assignment.duty.name}" after accepting the swap.` },
        ],
      })
    } else {
      await prisma.notification.create({
        data: { userId: swapRequest.fromUserId, type: 'SWAP_REQUEST', message: `${swapRequest.toUser.name} rejected your swap request for "${swapRequest.assignment.duty.name}".` },
      })
    }

    return Response.json({ swapRequest: updated })
  } catch (error) {
    console.error('PATCH swap-request error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
