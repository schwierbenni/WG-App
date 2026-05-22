import { requireWgSession } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

interface NetSettlement {
  fromUserId: string
  fromUserName: string
  toUserId: string
  toUserName: string
  amount: number
}

function computeShareForExpense(
  expense: { amount: number; splitWith: string[]; splitMode: string; splits: unknown },
  userId: string
): number {
  if (expense.splitMode === 'INDIVIDUAL') {
    const s = expense.splits as Record<string, number> | null
    return s?.[userId] ?? 0
  }
  if (expense.splitMode === 'PERCENTAGE') {
    const s = expense.splits as Record<string, number> | null
    return expense.amount * ((s?.[userId] ?? 0) / 100)
  }
  // EQUAL
  return expense.amount / expense.splitWith.length
}

function greedySettlements(
  balances: Map<string, number>,
  userMap: Map<string, string>
): NetSettlement[] {
  const creditors: [string, number][] = []
  const debtors: [string, number][] = []

  for (const [userId, balance] of balances) {
    const rounded = Math.round(balance * 100) / 100
    if (rounded > 0.01) creditors.push([userId, rounded])
    else if (rounded < -0.01) debtors.push([userId, -rounded])
  }

  creditors.sort((a, b) => b[1] - a[1])
  debtors.sort((a, b) => b[1] - a[1])

  const settlements: NetSettlement[] = []
  let i = 0
  let j = 0

  while (i < creditors.length && j < debtors.length) {
    const [creditorId, creditorAmt] = creditors[i]
    const [debtorId, debtorAmt] = debtors[j]
    const amount = Math.round(Math.min(creditorAmt, debtorAmt) * 100) / 100

    if (amount >= 0.01) {
      settlements.push({
        fromUserId: debtorId,
        fromUserName: userMap.get(debtorId) ?? debtorId,
        toUserId: creditorId,
        toUserName: userMap.get(creditorId) ?? creditorId,
        amount,
      })
    }

    creditors[i] = [creditorId, Math.round((creditorAmt - amount) * 100) / 100]
    debtors[j] = [debtorId, Math.round((debtorAmt - amount) * 100) / 100]

    if (creditors[i][1] < 0.01) i++
    if (debtors[j][1] < 0.01) j++
  }

  return settlements
}

export async function GET() {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { wgId } = auth

  try {
    const expenses = await prisma.expense.findMany({
      where: { wgId, settledAt: null },
      select: { paidBy: true, splitWith: true, amount: true, splitMode: true, splits: true },
    })

    const allUserIds = new Set<string>()
    for (const e of expenses) {
      allUserIds.add(e.paidBy)
      for (const uid of e.splitWith) allUserIds.add(uid)
    }

    const users = await prisma.user.findMany({
      where: { id: { in: Array.from(allUserIds) }, wgId },
      select: { id: true, name: true },
    })
    const userMap = new Map<string, string>(users.map((u) => [u.id, u.name]))

    // Compute net balance per person: positive = is owed money, negative = owes money
    const balances = new Map<string, number>()
    for (const e of expenses) {
      // Payer gets credited the full amount
      balances.set(e.paidBy, (balances.get(e.paidBy) ?? 0) + e.amount)
      // Each participant is debited their share
      for (const uid of e.splitWith) {
        const share = computeShareForExpense(e, uid)
        balances.set(uid, (balances.get(uid) ?? 0) - share)
      }
    }

    const settlements = greedySettlements(balances, userMap)

    // Per-person breakdown: how much each user owes/is owed
    const personBreakdown: Record<string, number> = {}
    for (const [uid, balance] of balances) {
      personBreakdown[uid] = Math.round(balance * 100) / 100
    }

    return Response.json({ settlements, personBreakdown })
  } catch (error) {
    console.error('GET settlements error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { wgId } = auth

  try {
    const { fromUserId, toUserId, amount, comment } = await req.json()
    if (!fromUserId || !toUserId || typeof amount !== 'number') {
      return Response.json({ error: 'fromUserId, toUserId und amount erforderlich' }, { status: 400 })
    }

    // Create settlement record for history
    const settlement = await prisma.settlement.create({
      data: { wgId, fromUserId, toUserId, amount, comment: comment || null },
      include: {
        fromUser: { select: { id: true, name: true } },
        toUser: { select: { id: true, name: true } },
      },
    })

    // Mark all unsettled expenses between these two users as settled
    await prisma.expense.updateMany({
      where: {
        wgId,
        settledAt: null,
        OR: [
          { paidBy: toUserId, splitWith: { has: fromUserId } },
          { paidBy: fromUserId, splitWith: { has: toUserId } },
        ],
      },
      data: { settledAt: new Date() },
    })

    return Response.json({ ok: true, settlement })
  } catch (error) {
    console.error('POST settlements error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
