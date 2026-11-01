import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { sendPushToUser } from '@/lib/push'
import type { Prisma } from '@prisma/client'
import {
  addDateDays,
  mondayKey,
  weeklyAllocation,
  weekTiming,
  reminderStage,
  dutyMessage,
} from './weekly-duty'

type Tx = Prisma.TransactionClient
export async function queueWeeklyNotice(
  tx: Tx,
  wgId: string,
  userIds: string[],
  key: string,
  title: string,
  message: string,
) {
  await tx.notification.createMany({
    data: userIds.map((userId) => ({
      wgId,
      userId,
      type: 'ASSIGNMENT' as const,
      deliveryKey: `weekly:${wgId}:${key}:${userId}`,
      pushTitle: title,
      message,
      link: '/duties',
    })),
    skipDuplicates: true,
  })
}
// Durable outbox: notifications survive a process stop before push delivery.
// Push is retried after failures; device delivery itself cannot be guaranteed exactly once.
export async function dispatchWeeklyPush(wgId: string) {
  const pending = await prisma.notification.findMany({
    where: {
      wgId,
      deliveryKey: { startsWith: 'weekly:' },
      pushTitle: { not: null },
      pushSentAt: null,
    },
    select: { id: true },
    take: 100,
    orderBy: { createdAt: 'asc' },
  })
  for (const { id } of pending) {
    try {
      await prisma.$transaction(
        async (tx) => {
          const rows = await tx.$queryRaw<
            { id: string }[]
          >`SELECT id FROM "Notification" WHERE id = ${id} AND "wgId" = ${wgId} AND "pushSentAt" IS NULL FOR UPDATE SKIP LOCKED`
          if (!rows.length) return
          const notice = await tx.notification.findUniqueOrThrow({
            where: { id, wgId },
          })
          const results = await sendPushToUser(notice.userId, {
            title: notice.pushTitle!,
            body: notice.message,
            url: '/duties',
          })
          if (results.some((result) => result.status === 'rejected'))
            throw new Error('Some push subscriptions failed')
          await tx.notification.update({
            where: { id, wgId },
            data: { pushSentAt: new Date() },
          })
        },
        { timeout: 15000 },
      )
    } catch (error) {
      logger.error('Wochenplan-Push bleibt zur Wiederholung vorgemerkt', {
        notificationId: id,
        error: String(error),
      })
    }
  }
}
export async function runWeeklyDutyPlan(wgId: string, now = new Date()) {
  const week = mondayKey(now)
  await prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "WGConfig" WHERE id = ${wgId} FOR UPDATE`
      const plan = await tx.weeklyDutyPlan.findUnique({ where: { wgId } })
      if (!plan) return
      const allocation = weeklyAllocation(
        plan.startMonday.toISOString().slice(0, 10),
        week,
        plan.memberOrder,
        plan.dutyOrder,
      )
      if (!allocation) return
      const members = await tx.user.findMany({
        where: { wgId, id: { in: plan.memberOrder } },
        select: { id: true, name: true },
      })
      const duties = await tx.duty.findMany({
        where: { wgId, id: { in: plan.dutyOrder } },
        select: { id: true, name: true },
      })
      if (members.length !== 5 || duties.length !== 4)
        throw new Error(
          'Wochenplan unvollständig; Mitglieder oder Dienste fehlen',
        )
      const weekStart = new Date(`${week}T00:00:00Z`)
      const missingAssignments = []
      for (
        let key = plan.startMonday.toISOString().slice(0, 10);
        key <= week;
        key = addDateDays(key, 7)
      ) {
        const round = weeklyAllocation(
          plan.startMonday.toISOString().slice(0, 10),
          key,
          plan.memberOrder,
          plan.dutyOrder,
        )!
        missingAssignments.push(
          ...round.assignments.map((a) => ({
            ...a,
            wgId,
            weekStart: new Date(`${key}T00:00:00Z`),
            dueDate: weekTiming(key).deadline,
          })),
        )
      }
      await tx.dutyAssignment.createMany({
        data: missingAssignments,
        skipDuplicates: true,
      })
      for (const member of members) {
        if (now < weekTiming(week).infoAt) continue
        const assignment = allocation.assignments.find(
          (a) => a.userId === member.id,
        )
        const duty = duties.find((d) => d.id === assignment?.dutyId)
        const message = duty
          ? `Dein Dienst in der Woche ab ${week}: ${duty.name}. Zeit bis Sonntagabend.`
          : `In der Woche ab ${week} hast du frei! 🎉`
        await queueWeeklyNotice(
          tx,
          wgId,
          [member.id],
          `week:${week}`,
          'Deine Dienstwoche',
          message,
        )
      }
      const open = await tx.dutyAssignment.findMany({
        where: {
          wgId,
          weekStart: { not: null, lte: weekStart },
          completedAt: null,
        },
        include: {
          user: { select: { name: true } },
          duty: { select: { name: true } },
        },
      })
      for (const assignment of open) {
        await tx.$queryRaw`SELECT id FROM "DutyAssignment" WHERE id = ${assignment.id} AND "wgId" = ${wgId} FOR UPDATE`
        const fresh = await tx.dutyAssignment.findUnique({
          where: { id: assignment.id, wgId },
        })
        if (!fresh || fresh.completedAt) continue
        const stage = reminderStage(
          assignment.weekStart!.toISOString().slice(0, 10),
          now,
        )
        if (!stage) continue
        const title =
          stage === 'reminder'
            ? 'Dienst noch offen'
            : stage === 'overdue'
              ? 'Nachholtag'
              : 'Komplette Eskalation'
        await queueWeeklyNotice(
          tx,
          wgId,
          members.map((m) => m.id),
          `${assignment.id}:${stage}`,
          title,
          dutyMessage(stage, assignment.user.name, assignment.duty.name),
        )
      }
    },
    { timeout: 15000 },
  )
  await dispatchWeeklyPush(wgId)
}
export async function runAllWeeklyDutyPlans() {
  const plans = await prisma.weeklyDutyPlan.findMany({ select: { wgId: true } })
  const errors: string[] = []
  for (const { wgId } of plans) {
    try {
      await runWeeklyDutyPlan(wgId)
    } catch (error) {
      errors.push(wgId)
      logger.error('Wochenplan fehlgeschlagen', { wgId, error: String(error) })
    }
  }
  return errors
}
