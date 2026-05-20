import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { randomBytes } from 'crypto'

const schema = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse'),
})

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    if (!body) return Response.json({ error: 'Ungültiger Anfrage-Body.' }, { status: 400 })

    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Ungültige E-Mail-Adresse.' }, { status: 400 })
    }

    const { email } = parsed.data
    logger.info('Passwort-Reset angefordert', { email })

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return Response.json({ message: 'Falls ein Konto mit dieser E-Mail existiert, wurde ein Reset-Link gesendet.' })
    }

    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

    await prisma.passwordResetToken.deleteMany({ where: { email } })
    await prisma.passwordResetToken.create({ data: { email, token, expiresAt } })

    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`

    if (process.env.RESEND_API_KEY) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM ?? 'noreply@flatmate.de',
            to: email,
            subject: 'Passwort zurücksetzen – FlatMate',
            html: `<p>Hallo ${user.name},</p><p>Klicke auf den Link, um dein Passwort zurückzusetzen:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>Der Link ist 1 Stunde gültig.</p>`,
          }),
        })
        if (!res.ok) {
          logger.warn('E-Mail-Versand fehlgeschlagen', { email, status: res.status })
        } else {
          logger.info('Reset-E-Mail gesendet', { email })
        }
      } catch (err) {
        logger.error('E-Mail-Versand Fehler', { email, error: err instanceof Error ? err.message : String(err) })
      }
    } else {
      logger.info('[DEV] Passwort-Reset-Link', { email, resetUrl })
    }

    return Response.json({ message: 'Falls ein Konto mit dieser E-Mail existiert, wurde ein Reset-Link gesendet.' })
  } catch (error) {
    logger.error('Forgot-password Fehler', { error: error instanceof Error ? error.message : String(error) })
    return Response.json({ error: 'Interner Serverfehler.' }, { status: 500 })
  }
}
