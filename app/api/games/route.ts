import { z } from 'zod'
import { requireWgSession } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { calculateDebts } from '@/lib/games'

const createGameSchema = z.object({
  gameType: z.enum(['SKAT', 'DOPPELKOPF']),
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

export async function GET() {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { wgId } = auth

  try {
    const sessions = await prisma.gameSession.findMany({
      where: { wgId },
      include: {
        results: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
      orderBy: { playedAt: 'desc' },
      take: 20,
    })
    return Response.json({ sessions })
  } catch (error) {
    console.error('GET /api/games error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { session, wgId } = auth

  try {
    const body = await request.json()
    const parsed = createGameSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const { gameType, multiplier, players } = parsed.data

    const minPlayers = gameType === 'SKAT' ? 3 : 4
    if (players.length < minPlayers) {
      return Response.json(
        { error: `${gameType === 'SKAT' ? 'Skat' : 'Doppelkopf'} erfordert mindestens ${minPlayers} Spieler` },
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
      const gameSession = await tx.gameSession.create({
        data: {
          wgId,
          gameType,
          multiplier,
          createdBy: session.user.id,
          results: {
            create: players.map((p) => ({ userId: p.userId, points: p.points })),
          },
        },
        include: {
          results: { include: { user: { select: { id: true, name: true } } } },
        },
      })

      const gameLabel = gameType === 'SKAT' ? 'Skat' : 'Doppelkopf'

      for (const debt of debts) {
        if (debt.amountEuro <= 0) continue
        await tx.expense.create({
          data: {
            wgId,
            amount: debt.amountEuro,
            description: `${gameLabel} – ${debt.fromName} → ${debt.toName}`,
            category: 'SONSTIGES',
            paidBy: debt.toUserId,
            splitWith: [debt.toUserId, debt.fromUserId],
            splitMode: 'INDIVIDUAL',
            splits: {
              [debt.toUserId]: 0,
              [debt.fromUserId]: debt.amountEuro,
            },
            date: new Date(),
          },
        })
      }

      return { gameSession, expensesCreated: debts.filter((d) => d.amountEuro > 0).length }
    })

    return Response.json({ ...result, debts }, { status: 201 })
  } catch (error) {
    console.error('POST /api/games error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
