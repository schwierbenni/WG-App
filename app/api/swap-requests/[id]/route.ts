import { z } from 'zod'
import { requireWgSession } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { sendPushToUser } from '@/lib/push'

const patchSwapSchema = z.object({
  action: z.enum(['accept', 'reject']),
  message: z.string().max(500).optional(),
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { session, wgId } = auth

  const { id } = await params

  try {
    const swapRequest = await prisma.swapRequest.findUnique({
      where: { id, wgId },
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
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { session, wgId } = auth

  const { id } = await params

  try {
    const body = await request.json()
    const parsed = patchSwapSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const swapRequest = await prisma.swapRequest.findUnique({
      where: { id, wgId },
      include: {
        assignment: { include: { duty: true } },
        fromUser: { select: { id: true, name: true } },
        toUser: { select: { id: true, name: true } },
      },
    })

    if (!swapRequest) return Response.json({ error: 'Swap request not found' }, { status: 404 })
    if (swapRequest.toUserId !== session.user.id) return Response.json({ error: 'Only the recipient can accept or reject' }, { status: 403 })
    if (swapRequest.status !== 'PENDING') return Response.json({ error: 'Swap request is no longer pending' }, { status: 409 })

    const { action, message } = parsed.data
    const newStatus = action === 'accept' ? 'ACCEPTED' : 'REJECTED'

    const updated = await prisma.swapRequest.update({
      where: { id },
      data: { status: newStatus, message: message ?? null },
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

      // Create a one-time IOU: debitor (fromUser/A) owes creditor (toUser/C) one duty back.
      // The next time C would be scheduled, A steps in instead, then both return to original rotation.
      await prisma.dutySwapIOU.create({
        data: {
          wgId,
          dutyId: swapRequest.assignment.dutyId,
          debitorId: swapRequest.fromUserId,
          creditorId: swapRequest.toUserId,
        },
      })

      const acceptMsg = `${swapRequest.toUser.name} hat deinen Tausch für "${swapRequest.assignment.duty.name}" angenommen.`
      const assignMsg = `Du wurdest nach dem Tausch für "${swapRequest.assignment.duty.name}" eingeteilt.`

      await prisma.notification.createMany({
        data: [
          { wgId, userId: swapRequest.fromUserId, type: 'SWAP_REQUEST', message: acceptMsg, link: '/duties' },
          { wgId, userId: swapRequest.toUserId, type: 'ASSIGNMENT', message: assignMsg, link: '/duties' },
        ],
      })

      sendPushToUser(swapRequest.fromUserId, { title: 'Tausch angenommen', body: acceptMsg, url: '/duties' }).catch(() => {})
      sendPushToUser(swapRequest.toUserId, { title: 'Neue Zuteilung', body: assignMsg, url: '/duties' }).catch(() => {})
    } else {
      const reasonSuffix = message ? `: „${message}"` : ''
      const rejectMsg = `${swapRequest.toUser.name} hat deinen Tausch für "${swapRequest.assignment.duty.name}" abgelehnt${reasonSuffix}.`

      await prisma.notification.create({
        data: { wgId, userId: swapRequest.fromUserId, type: 'SWAP_REQUEST', message: rejectMsg, link: '/duties' },
      })

      sendPushToUser(swapRequest.fromUserId, { title: 'Tausch abgelehnt', body: rejectMsg, url: '/duties' }).catch(() => {})
    }

    return Response.json({ swapRequest: updated })
  } catch (error) {
    console.error('PATCH swap-request error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
