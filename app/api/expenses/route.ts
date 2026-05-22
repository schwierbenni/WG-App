import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { requireWgSession } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

const createExpenseSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  description: z.string().min(1, 'Description is required'),
  category: z.enum(['LEBENSMITTEL', 'HAUSHALT', 'MIETE_NEBENKOSTEN', 'SONSTIGES']).optional(),
  paidBy: z.string().optional(),
  splitWith: z.array(z.string()).min(1, 'splitWith must include at least one user'),
  splitMode: z.enum(['EQUAL', 'INDIVIDUAL', 'PERCENTAGE']).optional(),
  splits: z.record(z.string(), z.number()).optional(),
  date: z.string().datetime({ message: 'Invalid date format' }).optional(),
})

export async function GET() {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { wgId } = auth

  try {
    const expenses = await prisma.expense.findMany({
      where: { wgId },
      include: { paidByUser: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      orderBy: { date: 'desc' },
    })
    return Response.json({ expenses })
  } catch (error) {
    console.error('GET expenses error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { session, wgId } = auth

  try {
    const body = await request.json()
    const parsed = createExpenseSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const { amount, description, category, splitWith, splitMode, splits, date } = parsed.data
    const paidBy = parsed.data.paidBy ?? session.user.id

    // Ensure paidBy is in the WG
    const payer = await prisma.user.findFirst({ where: { id: paidBy, wgId } })
    if (!payer) {
      return Response.json({ error: 'Zahler nicht in dieser WG gefunden' }, { status: 400 })
    }

    // Ensure paidBy is included in splitWith
    const splitWithFinal = splitWith.includes(paidBy) ? splitWith : [paidBy, ...splitWith]

    const userCount = await prisma.user.count({ where: { id: { in: splitWithFinal }, wgId } })
    if (userCount !== splitWithFinal.length) {
      return Response.json({ error: 'One or more users not found in this WG' }, { status: 400 })
    }

    // Validate splits for INDIVIDUAL mode
    const resolvedMode = splitMode ?? 'EQUAL'
    if (resolvedMode === 'INDIVIDUAL' && splits) {
      const total = Object.values(splits).reduce((s, v) => s + v, 0)
      if (Math.abs(total - amount) > 0.01) {
        return Response.json({ error: 'Individuelle Beträge müssen den Gesamtbetrag ergeben' }, { status: 400 })
      }
    }
    if (resolvedMode === 'PERCENTAGE' && splits) {
      const total = Object.values(splits).reduce((s, v) => s + v, 0)
      if (Math.abs(total - 100) > 0.01) {
        return Response.json({ error: 'Prozentsätze müssen in Summe 100% ergeben' }, { status: 400 })
      }
    }

    const expense = await prisma.expense.create({
      data: {
        wgId,
        amount,
        description,
        category: category ?? 'SONSTIGES',
        paidBy,
        splitWith: splitWithFinal,
        splitMode: resolvedMode,
        splits: splits !== undefined ? (splits as Prisma.InputJsonValue) : Prisma.DbNull,
        date: date ? new Date(date) : new Date(),
      },
      include: { paidByUser: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    })

    return Response.json({ expense }, { status: 201 })
  } catch (error) {
    console.error('POST expenses error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
