import { z } from 'zod'
import { requireWgSession } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { mondayKey, weeklyAllocation } from '@/lib/weekly-duty'
import { runWeeklyDutyPlan } from '@/lib/weekly-duty-service'

const schema = z.object({
  startMonday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  memberOrder: z.array(z.string().min(1)).length(5),
  dutyOrder: z.array(z.string().min(1)).length(4),
})
export async function GET() {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { wgId, session } = auth
  try {
    const plan = await prisma.weeklyDutyPlan.findUnique({ where: { wgId } })
    if (plan) await runWeeklyDutyPlan(wgId)
    const week = mondayKey(new Date()),
      weekStart = new Date(`${week}T00:00:00Z`)
    const [members, duties, assignments, backlog, legacyBacklog] =
      await Promise.all([
        prisma.user.findMany({
          where: { wgId },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        }),
        prisma.duty.findMany({
          where: { wgId, isActive: true },
          select: { id: true, name: true, isPaused: true },
          orderBy: { name: 'asc' },
        }),
        prisma.dutyAssignment.findMany({
          where: { wgId, weekStart },
          include: {
            user: { select: { id: true, name: true } },
            duty: { select: { id: true, name: true, emoji: true } },
          },
          orderBy: { dutyId: 'asc' },
        }),
        prisma.dutyAssignment.findMany({
          where: {
            wgId,
            weekStart: { not: null, lt: weekStart },
            completedAt: null,
          },
          include: {
            user: { select: { id: true, name: true } },
            duty: { select: { id: true, name: true, emoji: true } },
          },
          orderBy: { weekStart: 'desc' },
        }),
        prisma.dutyAssignment.findMany({
          where: { wgId, weekStart: null, completedAt: null },
          include: {
            user: { select: { id: true, name: true } },
            duty: { select: { id: true, name: true, emoji: true } },
          },
          orderBy: { dueDate: 'asc' },
        }),
      ])
    const allocation = plan
      ? weeklyAllocation(
          plan.startMonday.toISOString().slice(0, 10),
          week,
          plan.memberOrder,
          plan.dutyOrder,
        )
      : null
    return Response.json({
      plan,
      week,
      freeMemberId: allocation?.freeMemberId,
      assignments,
      backlog,
      legacyBacklog,
      members,
      duties,
      isAdmin: session.user.role === 'ADMIN',
    })
  } catch (error) {
    logger.error('Wochenplan konnte nicht geladen werden', {
      wgId,
      error: String(error),
    })
    return Response.json(
      { error: 'Wochenplan konnte nicht geladen werden.' },
      { status: 500 },
    )
  }
}
export async function POST(request: Request) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { wgId, session } = auth
  if (session.user.role !== 'ADMIN')
    return Response.json(
      { error: 'Nur ein WG-Admin darf den Wochenplan einrichten.' },
      { status: 403 },
    )
  try {
    const parsed = schema.safeParse(await request.json())
    if (!parsed.success)
      return Response.json(
        {
          error:
            'Bitte fünf Personen, vier Dienste und einen Startmontag auswählen.',
        },
        { status: 400 },
      )
    const { memberOrder, dutyOrder, startMonday } = parsed.data
    const start = new Date(`${startMonday}T00:00:00Z`)
    if (
      !Number.isFinite(+start) ||
      start.toISOString().slice(0, 10) !== startMonday ||
      start.getUTCDay() !== 1 ||
      new Set(memberOrder).size !== 5 ||
      new Set(dutyOrder).size !== 4
    )
      return Response.json(
        {
          error:
            'Startdatum muss ein Montag sein; Personen und Dienste dürfen nicht doppelt vorkommen.',
        },
        { status: 400 },
      )
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "WGConfig" WHERE id = ${wgId} FOR UPDATE`
      if (await tx.weeklyDutyPlan.findUnique({ where: { wgId } }))
        return 'exists'
      const members = await tx.user.count({
        where: { wgId, id: { in: memberOrder } },
      })
      const duties = await tx.duty.count({
        where: { wgId, id: { in: dutyOrder }, isActive: true, isPaused: false },
      })
      if (members !== 5 || duties !== 4) return 'invalid'
      await tx.weeklyDutyPlan.create({
        data: { wgId, memberOrder, dutyOrder, startMonday: start },
      })
      return 'created'
    })
    if (result === 'exists')
      return Response.json(
        {
          error:
            'Wochenplan ist bereits eingerichtet. Seine feste Reihenfolge bleibt erhalten.',
        },
        { status: 409 },
      )
    if (result === 'invalid')
      return Response.json(
        {
          error:
            'Alle Personen und aktiven Dienste müssen zu dieser WG gehören.',
        },
        { status: 400 },
      )
    await runWeeklyDutyPlan(wgId)
    return Response.json({ created: true }, { status: 201 })
  } catch (error) {
    logger.error('Wochenplan konnte nicht eingerichtet werden', {
      wgId,
      error: String(error),
    })
    return Response.json(
      {
        error:
          'Einrichtung fehlgeschlagen. Bitte den gespeicherten Plan prüfen.',
      },
      { status: 500 },
    )
  }
}
