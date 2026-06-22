import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { sendPushToWG } from '@/lib/push'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  logger.info('Kalender-Cron gestartet')

  const now = new Date()

  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(now)
  todayEnd.setHours(23, 59, 59, 999)

  const tomorrowStart = new Date(todayStart)
  tomorrowStart.setDate(tomorrowStart.getDate() + 1)
  const tomorrowEnd = new Date(todayEnd)
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1)

  let notified = 0
  const errors: string[] = []

  try {
    // Vorab-Erinnerung (1 Tag vorher) für Gelber Sack
    const tomorrowGelberSackEvents = await prisma.iCalEvent.findMany({
      where: {
        startDate: { gte: tomorrowStart, lte: tomorrowEnd },
        title: { contains: 'Gelber Sack', mode: 'insensitive' },
      },
      include: { calendar: { select: { id: true, name: true, emoji: true, wgId: true } } },
    })

    for (const event of tomorrowGelberSackEvents) {
      try {
        const { wgId } = event.calendar
        const dateStr = event.startDate.toLocaleDateString('de-DE', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          timeZone: 'Europe/Berlin',
        })
        const msg = `${event.title} – morgen, ${dateStr}`

        const wgMembers = await prisma.user.findMany({ where: { wgId }, select: { id: true } })
        await prisma.notification.createMany({
          data: wgMembers.map((u) => ({
            wgId,
            userId: u.id,
            type: 'ICAL_REMINDER' as const,
            message: msg,
            link: '/calendar',
          })),
        })
        sendPushToWG(wgId, { title: `🗑️ Gelber Sack morgen`, body: msg, url: '/calendar' }).catch(() => {})
        notified++
        logger.info('Morgen-Erinnerung (Gelber Sack) gesendet', { eventId: event.id, title: event.title, wgId })
      } catch (err) {
        errors.push(`GelberSack morgen - ${event.title}: ${String(err)}`)
        logger.error('Fehler bei Morgen-Erinnerung (Gelber Sack)', { eventId: event.id, error: String(err) })
      }
    }

    const todayIcalEvents = await prisma.iCalEvent.findMany({
      where: { startDate: { gte: todayStart, lte: todayEnd } },
      include: { calendar: { select: { id: true, name: true, emoji: true, wgId: true } } },
    })

    for (const event of todayIcalEvents) {
      try {
        const { wgId, emoji, name: calName } = event.calendar
        const dateStr = event.startDate.toLocaleDateString('de-DE', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          timeZone: 'Europe/Berlin',
        })
        const msg = `${event.title} – heute, ${dateStr}`

        const wgMembers = await prisma.user.findMany({ where: { wgId }, select: { id: true } })
        await prisma.notification.createMany({
          data: wgMembers.map((u) => ({
            wgId,
            userId: u.id,
            type: 'ICAL_REMINDER' as const,
            message: msg,
            link: '/calendar',
          })),
        })
        sendPushToWG(wgId, { title: `${emoji} ${calName}`, body: msg, url: '/calendar' }).catch(() => {})
        notified++
        logger.info('Heute-Erinnerung (iCal) gesendet', { eventId: event.id, title: event.title, wgId })
      } catch (err) {
        errors.push(`iCal heute - ${event.title}: ${String(err)}`)
        logger.error('Fehler bei Heute-Erinnerung (iCal)', { eventId: event.id, error: String(err) })
      }
    }

    const todayWgEvents = await prisma.wGEvent.findMany({
      where: { startDate: { gte: todayStart, lte: todayEnd } },
    })

    for (const event of todayWgEvents) {
      try {
        const dateStr = event.startDate.toLocaleDateString('de-DE', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          timeZone: 'Europe/Berlin',
        })
        const msg = `${event.title} – heute, ${dateStr}`

        const wgMembers = await prisma.user.findMany({ where: { wgId: event.wgId }, select: { id: true } })
        await prisma.notification.createMany({
          data: wgMembers.map((u) => ({
            wgId: event.wgId,
            userId: u.id,
            type: 'WG_EVENT' as const,
            message: msg,
            link: '/calendar',
          })),
        })
        sendPushToWG(event.wgId, { title: `${event.emoji} WG-Ereignis`, body: msg, url: '/calendar' }).catch(() => {})
        notified++
        logger.info('Heute-Erinnerung (WGEvent) gesendet', { eventId: event.id, title: event.title, wgId: event.wgId })
      } catch (err) {
        errors.push(`WGEvent heute - ${event.title}: ${String(err)}`)
        logger.error('Fehler bei Heute-Erinnerung (WGEvent)', { eventId: event.id, error: String(err) })
      }
    }

    logger.info('Kalender-Cron abgeschlossen', { notified, errors: errors.length })
    return Response.json({ notified, errors })
  } catch (error) {
    logger.error('Kalender-Cron fehlgeschlagen', { error: String(error) })
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
