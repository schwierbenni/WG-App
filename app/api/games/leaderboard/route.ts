import { requireWgSession } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { wgId } = auth

  const url = new URL(request.url)
  const gameType = url.searchParams.get('gameType') ?? 'ALL'
  const month = url.searchParams.get('month')

  if (!['SKAT', 'DOPPELKOPF', 'ALL'].includes(gameType)) {
    return Response.json({ error: 'Invalid gameType' }, { status: 400 })
  }

  let dateFilter: { gte: Date; lt: Date } | undefined
  if (month) {
    const parts = month.split('-')
    const year = parseInt(parts[0] ?? '', 10)
    const m = parseInt(parts[1] ?? '', 10)
    if (!year || !m || m < 1 || m > 12) {
      return Response.json({ error: 'Invalid month format. Use YYYY-MM' }, { status: 400 })
    }
    dateFilter = { gte: new Date(year, m - 1, 1), lt: new Date(year, m, 1) }
  }

  try {
    const wgUsers = await prisma.user.findMany({
      where: { wgId },
      select: { id: true, name: true, avatarUrl: true },
    })

    const sessions = await prisma.gameSession.findMany({
      where: {
        wgId,
        ...(gameType !== 'ALL'
          ? { gameType: gameType as 'SKAT' | 'DOPPELKOPF' }
          : { gameType: { in: ['SKAT', 'DOPPELKOPF'] } }),
        ...(dateFilter ? { playedAt: dateFilter } : {}),
      },
      include: {
        results: { select: { userId: true, points: true } },
        gameExpenses: {
          select: { paidBy: true, splitWith: true, splits: true, amount: true, category: true },
        },
      },
    })

    type UserStats = {
      id: string
      name: string
      avatarUrl: string | null
      gamesPlayed: number
      totalPoints: number
      totalEuro: number
      skatEuro: number
      doppelkopfEuro: number
    }

    const statsMap = new Map<string, UserStats>(
      wgUsers.map((u) => [
        u.id,
        { id: u.id, name: u.name, avatarUrl: u.avatarUrl, gamesPlayed: 0, totalPoints: 0, totalEuro: 0, skatEuro: 0, doppelkopfEuro: 0 },
      ])
    )

    for (const session of sessions) {
      for (const result of session.results) {
        const stats = statsMap.get(result.userId)
        if (!stats) continue
        stats.gamesPlayed++
        stats.totalPoints += result.points
      }

      for (const expense of session.gameExpenses) {
        const splitsData = expense.splits as Record<string, number> | null
        const isSkat = expense.category === 'SKAT'

        // paidBy user is owed money (they won) → positive
        const winner = statsMap.get(expense.paidBy)
        if (winner) {
          winner.totalEuro += expense.amount
          if (isSkat) winner.skatEuro += expense.amount
          else winner.doppelkopfEuro += expense.amount
        }

        // splits entries with amount > 0 owe money (they lost) → negative
        if (splitsData) {
          for (const [userId, amount] of Object.entries(splitsData)) {
            if (userId === expense.paidBy || amount <= 0) continue
            const loser = statsMap.get(userId)
            if (!loser) continue
            loser.totalEuro -= amount
            if (isSkat) loser.skatEuro -= amount
            else loser.doppelkopfEuro -= amount
          }
        }
      }
    }

    const leaderboard = [...statsMap.values()]
      .filter((u) => u.gamesPlayed > 0)
      .map((u) => ({
        userId: u.id,
        name: u.name,
        avatarUrl: u.avatarUrl,
        gamesPlayed: u.gamesPlayed,
        totalPoints: gameType === 'ALL' ? null : u.totalPoints,
        totalEuro: Math.round(u.totalEuro * 100) / 100,
        ...(gameType === 'ALL'
          ? {
              skatEuro: Math.round(u.skatEuro * 100) / 100,
              doppelkopfEuro: Math.round(u.doppelkopfEuro * 100) / 100,
            }
          : {}),
      }))
      .sort((a, b) => a.totalEuro - b.totalEuro)

    return Response.json({ leaderboard })
  } catch (error) {
    console.error('GET /api/games/leaderboard error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
