import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { sendPushToUser, sendPushToWG } from '@/lib/push'
import type { Duty } from '@prisma/client'

export function getNextDueDate(
  interval: string,
  from: Date = new Date(),
  weekday?: number | null
): Date {
  const date = new Date(from)
  switch (interval) {
    case 'DAILY': date.setDate(date.getDate() + 1); break
    case 'WEEKLY': date.setDate(date.getDate() + 7); break
    case 'BIWEEKLY': date.setDate(date.getDate() + 14); break
    case 'MONTHLY': date.setMonth(date.getMonth() + 1); break
    default: date.setDate(date.getDate() + 7); break
  }

  // Snap to the configured weekday (0=So..6=Sa, matches Date#getDay) so
  // weekly/biweekly duties always fall due on the same day, e.g. every Monday.
  if ((interval === 'WEEKLY' || interval === 'BIWEEKLY') && weekday !== null && weekday !== undefined) {
    const diff = (weekday - date.getDay() + 7) % 7
    date.setDate(date.getDate() + diff)
  }

  return date
}

interface RotationOutcome {
  rotated: boolean
  overdueNotified: boolean
  wgId: string
  dutyName: string
  assignedUserId?: string
  nextDueDate?: Date
}

async function rotateDutyIfDue(duty: Duty): Promise<RotationOutcome> {
  const noop: RotationOutcome = { rotated: false, overdueNotified: false, wgId: duty.wgId, dutyName: duty.name }

  if (duty.rotationOrder.length === 0) return noop
  if (duty.rotationInterval === 'MANUAL') return noop

  // Locks the duty row for the duration of the transaction so two concurrent
  // callers (e.g. two roommates opening the app at the same moment right
  // after the due date passes) can't both advance the rotation.
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Duty" WHERE id = ${duty.id} FOR UPDATE`

    const lastAssignment = await tx.dutyAssignment.findFirst({
      where: { dutyId: duty.id, wgId: duty.wgId },
      orderBy: { createdAt: 'desc' },
    })

    if (!lastAssignment) return noop

    const dueDate = new Date(lastAssignment.dueDate)
    if (dueDate > new Date()) return noop

    // The Stichtag has passed. Rotation only advances once the duty has
    // actually been marked erledigt — an overdue-but-uncompleted duty just
    // gets a (one-time) reminder and keeps waiting for completion.
    if (!lastAssignment.completedAt) {
      let overdueNotified = false
      if (!lastAssignment.overdueNotifiedAt) {
        const overdueMsg = `Der Dienst „${duty.name}" wurde nicht rechtzeitig erledigt.`
        const wgMembers = await tx.user.findMany({ where: { wgId: duty.wgId } })
        await Promise.all(
          wgMembers.map((m) =>
            tx.notification.create({
              data: { wgId: duty.wgId, userId: m.id, type: 'REMINDER', message: overdueMsg },
            })
          )
        )
        await tx.dutyAssignment.update({
          where: { id: lastAssignment.id },
          data: { overdueNotifiedAt: new Date() },
        })
        overdueNotified = true
      }
      return { ...noop, overdueNotified }
    }

    const currentIndex = duty.rotationOrder.indexOf(lastAssignment.userId)
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % duty.rotationOrder.length
    const scheduledUserId = duty.rotationOrder[nextIndex]

    const scheduledUser = await tx.user.findUnique({ where: { id: scheduledUserId, wgId: duty.wgId } })
    if (!scheduledUser) return noop

    // Check for an open IOU where the scheduled user is the creditor.
    // If found, the debitor steps in instead (pays back the duty swap).
    const pendingIOU = await tx.dutySwapIOU.findFirst({
      where: { dutyId: duty.id, creditorId: scheduledUserId, redeemedAt: null },
      orderBy: { createdAt: 'asc' },
    })

    const assignedUserId = pendingIOU ? pendingIOU.debitorId : scheduledUserId
    const nextDueDate = getNextDueDate(duty.rotationInterval, new Date(), duty.dueWeekday)

    await tx.dutyAssignment.create({
      data: { wgId: duty.wgId, dutyId: duty.id, userId: assignedUserId, dueDate: nextDueDate },
    })

    if (pendingIOU) {
      await tx.dutySwapIOU.update({
        where: { id: pendingIOU.id },
        data: { redeemedAt: new Date() },
      })
    }

    const msg = `Du wurdest für "${duty.name}" eingeteilt. Fällig: ${nextDueDate.toLocaleDateString('de-DE')}`
    await tx.notification.create({
      data: { wgId: duty.wgId, userId: assignedUserId, type: 'ASSIGNMENT', message: msg },
    })

    return { rotated: true, overdueNotified: false, wgId: duty.wgId, dutyName: duty.name, assignedUserId, nextDueDate }
  })
}

/**
 * Rotates every active, non-paused duty whose current assignment is past its
 * due date (Stichtag) *and* has been marked erledigt. Overdue-but-uncompleted
 * duties get a one-time reminder instead and keep waiting for completion.
 * Scope to a single WG via `where.wgId`, or omit it to
 * sweep all WGs (used by the daily cron).
 */
export async function rotateDueDuties(where: { wgId?: string } = {}): Promise<{ rotated: number; errors: string[] }> {
  const duties = await prisma.duty.findMany({
    where: { isActive: true, isPaused: false, ...where },
  })

  let rotated = 0
  const errors: string[] = []

  for (const duty of duties) {
    try {
      const outcome = await rotateDutyIfDue(duty)

      if (outcome.overdueNotified) {
        sendPushToWG(outcome.wgId, {
          title: 'Dienst überfällig ⚠️',
          body: `Der Dienst „${outcome.dutyName}" wurde nicht rechtzeitig erledigt.`,
          url: '/duties',
        }).catch(() => {})
      }

      if (outcome.rotated && outcome.assignedUserId && outcome.nextDueDate) {
        rotated++
        sendPushToUser(outcome.assignedUserId, {
          title: 'Neue Zuteilung',
          body: `Du wurdest für "${outcome.dutyName}" eingeteilt. Fällig: ${outcome.nextDueDate.toLocaleDateString('de-DE')}`,
          url: '/duties',
        }).catch(() => {})
        logger.info('Dienst rotiert', { dutyId: duty.id, dutyName: duty.name, assignedUserId: outcome.assignedUserId, wgId: duty.wgId })
      }
    } catch (err) {
      errors.push(`${duty.name}: ${String(err)}`)
      logger.error('Fehler bei Dienstrotation', { dutyId: duty.id, error: String(err) })
    }
  }

  return { rotated, errors }
}
