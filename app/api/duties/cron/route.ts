import { logger } from '@/lib/logger'
import { rotateDueDuties } from '@/lib/duty-rotation'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  logger.info('Automatische Dienstrotation gestartet')

  try {
    const { rotated, errors } = await rotateDueDuties()
    logger.info('Automatische Dienstrotation abgeschlossen', { rotated, errors: errors.length })
    return Response.json({ rotated, errors })
  } catch (error) {
    logger.error('Cron-Job fehlgeschlagen', { error: String(error) })
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
