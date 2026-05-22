import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { sendPushToWG } from '@/lib/push'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  logger.info('iCal Erinnerungscron gestartet')

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const dayStart = new Date(tomorrow)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(tomorrow)
  dayEnd.setHours(23, 59, 59, 999)

  try {
    const events = await prisma.iCalEvent.findMany({
      where: {
        startDate: { gte: dayStart, lte: dayEnd },
      },
      include: {
        calendar: { select: { id: true, name: true, emoji: true, wgId: true } },
      },
    })

    let notified = 0
    const errors: string[] = []

    for (const event of events) {
      try {
        const { wgId, emoji, name: calName } = event.calendar
        const dateStr = event.startDate.toLocaleDateString('de-DE', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })
        const msg = `${event.title} – morgen, ${dateStr}`

        const wgMembers = await prisma.user.findMany({
          where: { wgId },
          select: { id: true },
        })

        await prisma.notification.createMany({
          data: wgMembers.map((u) => ({
            wgId,
            userId: u.id,
            type: 'ICAL_REMINDER' as const,
            message: msg,
          })),
        })

        sendPushToWG(
          wgId,
          { title: `${emoji} ${calName}`, body: msg, url: '/calendar' }
        ).catch(() => {})

        notified++
        logger.info('iCal-Erinnerung gesendet', { eventId: event.id, title: event.title, wgId })
      } catch (err) {
        errors.push(`${event.title}: ${String(err)}`)
        logger.error('Fehler bei iCal-Erinnerung', { eventId: event.id, error: String(err) })
      }
    }

    logger.info('iCal Erinnerungscron abgeschlossen', { notified, errors: errors.length })
    return Response.json({ notified, errors })
  } catch (error) {
    logger.error('iCal Cron fehlgeschlagen', { error: String(error) })
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
