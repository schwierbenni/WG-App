import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface Settlement {
  fromUserId: string
  fromUserName: string
  toUserId: string
  toUserName: string
  amount: number
}

export async function GET() {
  const session = await auth()
  if (!session) return new Response('Unauthorized', { status: 401 })

  try {
    const expenses = await prisma.expense.findMany({
      where: { settledAt: null },
      include: { paidByUser: { select: { id: true, name: true } } },
    })

    const allUserIds = new Set<string>()
    for (const expense of expenses) {
      allUserIds.add(expense.paidBy)
      for (const userId of expense.splitWith) allUserIds.add(userId)
    }

    const users = await prisma.user.findMany({
      where: { id: { in: Array.from(allUserIds) } },
      select: { id: true, name: true },
    })
    const userMap = new Map<string, string>(users.map((u: { id: string; name: string }) => [u.id, u.name] as [string, string]))

    const net: Record<string, Record<string, number>> = {}

    for (const expense of expenses) {
      const { paidBy, splitWith, amount } = expense
      const share = amount / splitWith.length

      for (const userId of splitWith) {
        if (userId === paidBy) continue
        if (!net[paidBy]) net[paidBy] = {}
        if (!net[userId]) net[userId] = {}
        net[paidBy][userId] = (net[paidBy][userId] ?? 0) + share
        net[userId][paidBy] = (net[userId][paidBy] ?? 0) - share
      }
    }

    const settlements: Settlement[] = []
    const processed = new Set<string>()

    for (const [creditor, debtors] of Object.entries(net)) {
      for (const [debtor] of Object.entries(debtors)) {
        const key = [creditor, debtor].sort().join('_')
        if (processed.has(key)) continue
        processed.add(key)

        const netAmount = (net[creditor]?.[debtor] ?? 0) - (net[debtor]?.[creditor] ?? 0)
        if (Math.abs(netAmount) < 0.01) continue

        if (netAmount > 0) {
          settlements.push({ fromUserId: debtor, fromUserName: userMap.get(debtor) ?? debtor, toUserId: creditor, toUserName: userMap.get(creditor) ?? creditor, amount: Math.round(netAmount * 100) / 100 })
        } else {
          settlements.push({ fromUserId: creditor, fromUserName: userMap.get(creditor) ?? creditor, toUserId: debtor, toUserName: userMap.get(debtor) ?? debtor, amount: Math.round(Math.abs(netAmount) * 100) / 100 })
        }
      }
    }

    return Response.json({ settlements })
  } catch (error) {
    console.error('GET settlements error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
