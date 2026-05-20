import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

const createExpenseSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  description: z.string().min(1, 'Description is required'),
  category: z.enum(['LEBENSMITTEL', 'HAUSHALT', 'MIETE_NEBENKOSTEN', 'SONSTIGES']).optional(),
  splitWith: z.array(z.string()).min(1, 'splitWith must include at least one user'),
  date: z.string().datetime({ message: 'Invalid date format' }).optional(),
})

export async function GET() {
  const session = await auth()
  if (!session) return new Response('Unauthorized', { status: 401 })

  try {
    const expenses = await prisma.expense.findMany({
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
  const session = await auth()
  if (!session) return new Response('Unauthorized', { status: 401 })

  try {
    const body = await request.json()
    const parsed = createExpenseSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const { amount, description, category, splitWith, date } = parsed.data
    const paidBy = session.user.id
    const splitWithFinal = splitWith.includes(paidBy) ? splitWith : [paidBy, ...splitWith]

    const userCount = await prisma.user.count({ where: { id: { in: splitWithFinal } } })
    if (userCount !== splitWithFinal.length) {
      return Response.json({ error: 'One or more users in splitWith not found' }, { status: 400 })
    }

    const expense = await prisma.expense.create({
      data: { amount, description, category: category ?? 'SONSTIGES', paidBy, splitWith: splitWithFinal, date: date ? new Date(date) : new Date() },
      include: { paidByUser: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    })

    return Response.json({ expense }, { status: 201 })
  } catch (error) {
    console.error('POST expenses error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
