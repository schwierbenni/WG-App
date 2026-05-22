import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { requireWgSession } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

const updateExpenseSchema = z.object({
  amount: z.number().positive().optional(),
  description: z.string().min(1).optional(),
  category: z.enum(['LEBENSMITTEL', 'HAUSHALT', 'MIETE_NEBENKOSTEN', 'SONSTIGES']).optional(),
  paidBy: z.string().optional(),
  splitWith: z.array(z.string()).min(1).optional(),
  splitMode: z.enum(['EQUAL', 'INDIVIDUAL', 'PERCENTAGE']).optional(),
  splits: z.record(z.string(), z.number()).nullable().optional(),
  date: z.string().datetime().optional(),
})

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { session, wgId } = auth

  const { id } = await params

  try {
    const expense = await prisma.expense.findUnique({ where: { id } })
    if (!expense || expense.wgId !== wgId) {
      return Response.json({ error: 'Nicht gefunden' }, { status: 404 })
    }
    if (expense.paidBy !== session.user.id && session.user.role !== 'ADMIN') {
      return Response.json({ error: 'Nur der Zahler oder ein Admin kann bearbeiten' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = updateExpenseSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const { amount, description, category, splitWith, splitMode, splits, date, paidBy } = parsed.data

    const resolvedAmount = amount ?? expense.amount
    const resolvedMode = splitMode ?? expense.splitMode
    const resolvedPaidBy = paidBy ?? expense.paidBy

    if (resolvedMode === 'INDIVIDUAL' && splits) {
      const total = Object.values(splits).reduce((s, v) => s + v, 0)
      if (Math.abs(total - resolvedAmount) > 0.01) {
        return Response.json({ error: 'Individuelle Beträge müssen den Gesamtbetrag ergeben' }, { status: 400 })
      }
    }
    if (resolvedMode === 'PERCENTAGE' && splits) {
      const total = Object.values(splits).reduce((s, v) => s + v, 0)
      if (Math.abs(total - 100) > 0.01) {
        return Response.json({ error: 'Prozentsätze müssen in Summe 100% ergeben' }, { status: 400 })
      }
    }

    let splitWithFinal = splitWith ?? expense.splitWith
    if (!splitWithFinal.includes(resolvedPaidBy)) {
      splitWithFinal = [resolvedPaidBy, ...splitWithFinal]
    }

    if (splitWith || paidBy) {
      const userCount = await prisma.user.count({ where: { id: { in: splitWithFinal }, wgId } })
      if (userCount !== splitWithFinal.length) {
        return Response.json({ error: 'One or more users not found in this WG' }, { status: 400 })
      }
    }

    const updateData: Prisma.ExpenseUncheckedUpdateInput = { settledAt: null }
    if (amount !== undefined) updateData.amount = amount
    if (description !== undefined) updateData.description = description
    if (category !== undefined) updateData.category = category
    if (paidBy !== undefined) updateData.paidBy = resolvedPaidBy
    if (splitWith !== undefined) updateData.splitWith = splitWithFinal
    if (splitMode !== undefined) updateData.splitMode = resolvedMode
    if (date !== undefined) updateData.date = new Date(date)
    if (splits !== undefined) {
      updateData.splits = splits === null ? Prisma.DbNull : (splits as Prisma.InputJsonValue)
    }

    const updated = await prisma.expense.update({
      where: { id },
      data: updateData,
      include: { paidByUser: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    })

    return Response.json({ expense: updated })
  } catch (error) {
    console.error('PUT expense error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { session, wgId } = auth

  const { id } = await params

  try {
    const expense = await prisma.expense.findUnique({ where: { id } })
    if (!expense || expense.wgId !== wgId) {
      return Response.json({ error: 'Nicht gefunden' }, { status: 404 })
    }
    // Any WG member can delete WG expenses

    await prisma.expense.delete({ where: { id } })
    return new Response(null, { status: 204 })
  } catch (error) {
    console.error('DELETE expense error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
