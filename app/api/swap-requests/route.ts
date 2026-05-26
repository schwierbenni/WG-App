import { z } from 'zod'
import { requireWgSession } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { sendPushToUser } from '@/lib/push'

const createSwapSchema = z.object({
  toUserId: z.string().min(1, 'toUserId is required'),
  assignmentId: z.string().min(1, 'assignmentId is required'),
})

export async function GET(request: Request) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { session, wgId } = auth

  const { searchParams } = new URL(request.url)
  const direction = searchParams.get('direction')

  try {
    const userId = session.user.id
    let userFilter: Record<string, unknown> = {}
    if (direction === 'sent') userFilter = { fromUserId: userId }
    else if (direction === 'received') userFilter = { toUserId: userId }
    else userFilter = { OR: [{ fromUserId: userId }, { toUserId: userId }] }

    const swapRequests = await prisma.swapRequest.findMany({
      where: { wgId, ...userFilter },
      include: {
        fromUser: { select: { id: true, name: true, email: true, avatarUrl: true } },
        toUser: { select: { id: true, name: true, email: true, avatarUrl: true } },
        assignment: { include: { duty: { select: { id: true, name: true, emoji: true, color: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return Response.json({ swapRequests })
  } catch (error) {
    console.error('GET swap-requests error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { session, wgId } = auth

  try {
    const body = await request.json()
    const parsed = createSwapSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const { toUserId, assignmentId } = parsed.data
    const fromUserId = session.user.id

    if (fromUserId === toUserId) return Response.json({ error: 'Cannot swap with yourself' }, { status: 400 })

    const assignment = await prisma.dutyAssignment.findUnique({ where: { id: assignmentId, wgId }, include: { duty: true } })
    if (!assignment) return Response.json({ error: 'Assignment not found' }, { status: 404 })
    if (assignment.userId !== fromUserId) return Response.json({ error: 'This assignment does not belong to you' }, { status: 403 })

    const toUser = await prisma.user.findUnique({ where: { id: toUserId, wgId } })
    if (!toUser) return Response.json({ error: 'Target user not found in this WG' }, { status: 404 })

    const existingPending = await prisma.swapRequest.findFirst({ where: { assignmentId, status: 'PENDING', wgId } })
    if (existingPending) return Response.json({ error: 'A pending swap request already exists for this assignment' }, { status: 409 })

    const swapRequest = await prisma.swapRequest.create({
      data: { wgId, fromUserId, toUserId, assignmentId, status: 'PENDING' },
      include: {
        fromUser: { select: { id: true, name: true, email: true, avatarUrl: true } },
        toUser: { select: { id: true, name: true, email: true, avatarUrl: true } },
        assignment: { include: { duty: { select: { id: true, name: true, emoji: true, color: true } } } },
      },
    })

    const fromUser = await prisma.user.findUnique({ where: { id: fromUserId }, select: { name: true } })

    const swapMessage = `${fromUser?.name ?? 'Jemand'} möchte den Dienst "${assignment.duty.name}" mit dir tauschen.`

    await prisma.notification.create({
      data: { wgId, userId: toUserId, type: 'SWAP_REQUEST', message: swapMessage, link: `/duties?swap=${swapRequest.id}` },
    })

    sendPushToUser(toUserId, { title: 'Tausch-Anfrage', body: swapMessage, url: `/duties?swap=${swapRequest.id}` }).catch(() => {})

    return Response.json({ swapRequest }, { status: 201 })
  } catch (error) {
    console.error('POST swap-requests error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
