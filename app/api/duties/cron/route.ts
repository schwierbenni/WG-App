import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { sendPushToUser } from '@/lib/push'

function getNextDueDate(interval: string, from: Date = new Date()): Date {
  const date = new Date(from)
  switch (interval) {
    case 'DAILY': date.setDate(date.getDate() + 1); break
    case 'WEEKLY': date.setDate(date.getDate() + 7); break
    case 'BIWEEKLY': date.setDate(date.getDate() + 14); break
    case 'MONTHLY': date.setMonth(date.getMonth() + 1); break
    default: date.setDate(date.getDate() + 7); break
  }
  return date
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  logger.info('Automatische Dienstrotation gestartet')

  try {
    const duties = await prisma.duty.findMany({
      where: { isActive: true, isPaused: false },
    })

    let rotated = 0
    const errors: string[] = []

    for (const duty of duties) {
      if (duty.rotationOrder.length === 0) continue
      if (duty.rotationInterval === 'MANUAL') continue

      const lastAssignment = await prisma.dutyAssignment.findFirst({
        where: { dutyId: duty.id, wgId: duty.wgId },
        orderBy: { createdAt: 'desc' },
      })

      if (!lastAssignment) continue

      const dueDate = new Date(lastAssignment.dueDate)
      if (dueDate > new Date()) continue

      try {
        const currentIndex = duty.rotationOrder.indexOf(lastAssignment.userId)
        const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % duty.rotationOrder.length
        const scheduledUserId = duty.rotationOrder[nextIndex]

        const scheduledUser = await prisma.user.findUnique({ where: { id: scheduledUserId, wgId: duty.wgId } })
        if (!scheduledUser) continue

        // Check for an open IOU where the scheduled user is the creditor.
        // If found, the debitor steps in instead (pays back the duty swap).
        const pendingIOU = await prisma.dutySwapIOU.findFirst({
          where: { dutyId: duty.id, creditorId: scheduledUserId, redeemedAt: null },
          orderBy: { createdAt: 'asc' },
        })

        const assignedUserId = pendingIOU ? pendingIOU.debitorId : scheduledUserId
        const nextDueDate = getNextDueDate(duty.rotationInterval)

        await prisma.dutyAssignment.create({
          data: { wgId: duty.wgId, dutyId: duty.id, userId: assignedUserId, dueDate: nextDueDate },
        })

        if (pendingIOU) {
          await prisma.dutySwapIOU.update({
            where: { id: pendingIOU.id },
            data: { redeemedAt: new Date() },
          })
          logger.info('IOU eingelöst', { iouId: pendingIOU.id, debitorId: assignedUserId, creditorId: scheduledUserId, dutyId: duty.id })
        }

        const cronMsg = `Du wurdest für "${duty.name}" eingeteilt. Fällig: ${nextDueDate.toLocaleDateString('de-DE')}`

        await prisma.notification.create({
          data: { wgId: duty.wgId, userId: assignedUserId, type: 'ASSIGNMENT', message: cronMsg },
        })

        sendPushToUser(assignedUserId, { title: 'Neue Zuteilung', body: cronMsg, url: '/duties' }).catch(() => {})

        rotated++
        logger.info('Dienst rotiert', { dutyId: duty.id, dutyName: duty.name, assignedUserId, wgId: duty.wgId })
      } catch (err) {
        errors.push(`${duty.name}: ${String(err)}`)
        logger.error('Fehler bei Dienstrotation', { dutyId: duty.id, error: String(err) })
      }
    }

    logger.info('Automatische Dienstrotation abgeschlossen', { rotated, errors: errors.length })
    return Response.json({ rotated, errors })
  } catch (error) {
    logger.error('Cron-Job fehlgeschlagen', { error: String(error) })
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
