import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

const schema = z.object({
  token: z.string().min(1, 'Token ist erforderlich'),
  password: z.string().min(8, 'Passwort muss mindestens 8 Zeichen haben').max(100),
})

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    if (!body) return Response.json({ error: 'Ungültiger Anfrage-Body.' }, { status: 400 })

    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.'
      return Response.json({ error: msg }, { status: 400 })
    }

    const { token, password } = parsed.data

    const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } })
    if (!resetToken) {
      logger.warn('Reset-Passwort: ungültiger Token verwendet')
      return Response.json({ error: 'Ungültiger oder abgelaufener Link.' }, { status: 400 })
    }

    if (resetToken.expiresAt < new Date()) {
      await prisma.passwordResetToken.delete({ where: { token } })
      return Response.json({ error: 'Der Link ist abgelaufen. Bitte fordere einen neuen an.' }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    await prisma.user.update({ where: { email: resetToken.email }, data: { passwordHash } })
    await prisma.passwordResetToken.delete({ where: { token } })

    logger.info('Passwort zurückgesetzt', { email: resetToken.email })
    return Response.json({ message: 'Passwort erfolgreich zurückgesetzt.' })
  } catch (error) {
    logger.error('Reset-Passwort Fehler', { error: error instanceof Error ? error.message : String(error) })
    return Response.json({ error: 'Interner Serverfehler.' }, { status: 500 })
  }
}
