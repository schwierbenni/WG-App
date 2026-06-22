import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { sendPushToUser } from '@/lib/push'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  logger.info('Aufgaben-Cron gestartet')

  const now = new Date()

  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(now)
  todayEnd.setHours(23, 59, 59, 999)

  const inSevenDays = new Date(now)
  inSevenDays.setDate(now.getDate() + 7)
  const sevenDaysStart = new Date(inSevenDays)
  sevenDaysStart.setHours(0, 0, 0, 0)
  const sevenDaysEnd = new Date(inSevenDays)
  sevenDaysEnd.setHours(23, 59, 59, 999)

  let notified = 0
  const errors: string[] = []

  try {
    // Erinnerung am Stichtag selbst
    const tasksDueToday = await prisma.announcement.findMany({
      where: {
        dueDate: { gte: todayStart, lte: todayEnd },
        assignedUserId: { not: null },
        title: { not: null },
      },
      include: {
        assignedUser: { select: { id: true, name: true } },
      },
    })

    for (const task of tasksDueToday) {
      if (!task.assignedUserId || !task.title) continue
      try {
        const dueDateStr = task.dueDate!.toLocaleDateString('de-DE', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          timeZone: 'Europe/Berlin',
        })
        const msg = `Aufgabe fällig heute (${dueDateStr}): ${task.title}`

        await prisma.notification.create({
          data: {
            wgId: task.wgId,
            userId: task.assignedUserId,
            type: 'BULLETIN_TASK',
            message: msg,
            link: '/announcements',
          },
        })

        sendPushToUser(task.assignedUserId, {
          title: '📋 Aufgabe fällig heute',
          body: msg,
          url: '/announcements',
        }).catch(() => {})

        notified++
        logger.info('Heute-Erinnerung (Aufgabe) gesendet', { taskId: task.id, title: task.title })
      } catch (err) {
        errors.push(`Aufgabe heute - ${task.title}: ${String(err)}`)
        logger.error('Fehler bei Heute-Erinnerung (Aufgabe)', { taskId: task.id, error: String(err) })
      }
    }

    // Erinnerung eine Woche vor Stichtag
    const tasksDueInSevenDays = await prisma.announcement.findMany({
      where: {
        dueDate: { gte: sevenDaysStart, lte: sevenDaysEnd },
        assignedUserId: { not: null },
        title: { not: null },
      },
      include: {
        assignedUser: { select: { id: true, name: true } },
      },
    })

    for (const task of tasksDueInSevenDays) {
      if (!task.assignedUserId || !task.title) continue
      try {
        const dueDateStr = task.dueDate!.toLocaleDateString('de-DE', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          timeZone: 'Europe/Berlin',
        })
        const msg = `Aufgabe fällig in einer Woche (${dueDateStr}): ${task.title}`

        await prisma.notification.create({
          data: {
            wgId: task.wgId,
            userId: task.assignedUserId,
            type: 'BULLETIN_TASK',
            message: msg,
            link: '/announcements',
          },
        })

        sendPushToUser(task.assignedUserId, {
          title: '📋 Aufgabe in 7 Tagen fällig',
          body: msg,
          url: '/announcements',
        }).catch(() => {})

        notified++
        logger.info('7-Tage-Erinnerung (Aufgabe) gesendet', { taskId: task.id, title: task.title })
      } catch (err) {
        errors.push(`Aufgabe 7 Tage - ${task.title}: ${String(err)}`)
        logger.error('Fehler bei 7-Tage-Erinnerung (Aufgabe)', { taskId: task.id, error: String(err) })
      }
    }

    logger.info('Aufgaben-Cron abgeschlossen', { notified, errors: errors.length })
    return Response.json({ notified, errors })
  } catch (error) {
    logger.error('Aufgaben-Cron fehlgeschlagen', { error: String(error) })
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
