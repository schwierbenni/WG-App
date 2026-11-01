import { isSundayReminderWindow } from '@/lib/weekly-duty'
import { runAllWeeklyDutyPlans } from '@/lib/weekly-duty-service'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
  if (
    !process.env.CRON_SECRET ||
    request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`
  )
    return new Response('Unauthorized', { status: 401 })
  if (!isSundayReminderWindow(new Date()))
    return Response.json({ skipped: true })
  try {
    const errors = await runAllWeeklyDutyPlans()
    return Response.json({ errors })
  } catch (error) {
    logger.error('Sonntags-Erinnerung fehlgeschlagen', { error: String(error) })
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
