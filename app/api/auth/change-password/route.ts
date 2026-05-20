import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

const schema = z.object({
  currentPassword: z.string().min(1, 'Aktuelles Passwort ist erforderlich'),
  newPassword: z.string().min(8, 'Neues Passwort muss mindestens 8 Zeichen haben').max(100),
})

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Nicht eingeloggt.' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.'
      return Response.json({ error: msg }, { status: 400 })
    }

    const { currentPassword, newPassword } = parsed.data
    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user) return Response.json({ error: 'Benutzer nicht gefunden.' }, { status: 404 })

    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) {
      logger.warn('Passwortänderung: falsches aktuelles Passwort', { userId: session.user.id })
      return Response.json({ error: 'Das aktuelle Passwort ist falsch.' }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } })

    logger.info('Passwort geändert', { userId: user.id })
    return Response.json({ message: 'Passwort erfolgreich geändert.' })
  } catch (error) {
    logger.error('Passwortänderung fehlgeschlagen', {
      userId: session.user.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return Response.json({ error: 'Interner Serverfehler. Bitte versuche es erneut.' }, { status: 500 })
  }
}
