import { z } from 'zod'
import { requireWgSession } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { calculateDebts } from '@/lib/games'

const updateGameSchema = z.object({
  multiplier: z.number().positive('Multiplikator muss positiv sein'),
  players: z
    .array(
      z.object({
        userId: z.string(),
        points: z.number().int().min(0, 'Punkte müssen >= 0 sein'),
      })
    )
    .min(3, 'Mindestens 3 Spieler erforderlich')
    .max(4, 'Maximal 4 Spieler erlaubt'),
})

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { wgId } = auth
  const { id } = await params

  try {
    const existing = await prisma.gameSession.findFirst({ where: { id, wgId } })
    if (!existing) {
      return Response.json({ error: 'Spielrunde nicht gefunden' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = updateGameSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const { multiplier, players } = parsed.data
    const minPlayers = existing.gameType === 'SKAT' ? 3 : 4
    if (players.length < minPlayers) {
      return Response.json(
        { error: `${existing.gameType === 'SKAT' ? 'Skat' : 'Doppelkopf'} erfordert mindestens ${minPlayers} Spieler` },
        { status: 400 }
      )
    }

    const userIds = players.map((p) => p.userId)
    const wgUsers = await prisma.user.findMany({
      where: { id: { in: userIds }, wgId },
      select: { id: true, name: true },
    })
    if (wgUsers.length !== userIds.length) {
      return Response.json({ error: 'Ein oder mehrere Spieler gehören nicht zu dieser WG' }, { status: 400 })
    }

    const userMap = new Map(wgUsers.map((u) => [u.id, u.name]))
    const playerResults = players.map((p) => ({
      userId: p.userId,
      name: userMap.get(p.userId) ?? p.userId,
      points: p.points,
    }))
    const debts = calculateDebts(playerResults, multiplier)

    const result = await prisma.$transaction(async (tx) => {
      await tx.expense.deleteMany({ where: { gameSessionId: id } })
      await tx.gameResult.deleteMany({ where: { gameSessionId: id } })

      const updatedSession = await tx.gameSession.update({
        where: { id },
        data: {
          multiplier,
          results: {
            create: players.map((p) => ({ userId: p.userId, points: p.points })),
          },
        },
        include: {
          results: { include: { user: { select: { id: true, name: true } } } },
        },
      })

      const gameLabel = existing.gameType === 'SKAT' ? 'Skat' : 'Doppelkopf'
      let expensesCreated = 0
      for (const debt of debts) {
        if (debt.amountEuro <= 0) continue
        await tx.expense.create({
          data: {
            wgId,
            amount: debt.amountEuro,
            description: `${gameLabel} – ${debt.fromName} → ${debt.toName}`,
            category: existing.gameType,
            paidBy: debt.toUserId,
            splitWith: [debt.toUserId, debt.fromUserId],
            splitMode: 'INDIVIDUAL',
            splits: { [debt.toUserId]: 0, [debt.fromUserId]: debt.amountEuro },
            date: new Date(),
            gameSessionId: id,
          },
        })
        expensesCreated++
      }

      return { session: updatedSession, expensesCreated }
    })

    return Response.json({ ...result, debts })
  } catch (error) {
    console.error('PUT /api/games/[id] error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { wgId } = auth
  const { id } = await params

  try {
    const existing = await prisma.gameSession.findFirst({ where: { id, wgId } })
    if (!existing) {
      return Response.json({ error: 'Spielrunde nicht gefunden' }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.expense.deleteMany({ where: { gameSessionId: id } })
      await tx.gameSession.delete({ where: { id } })
    })

    return Response.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/games/[id] error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
