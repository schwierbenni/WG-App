import { prisma } from '@/lib/db'
import { z } from 'zod'
import { randomBytes } from 'crypto'

const schema = z.object({
  email: z.email('Ungültige E-Mail-Adresse'),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Ungültige E-Mail-Adresse' }, { status: 400 })
    }

    const { email } = parsed.data

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
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM ?? 'noreply@flatmate.de',
            to: email,
            subject: 'Passwort zurücksetzen – FlatMate',
            html: `<p>Hallo ${user.name},</p><p>klicke auf den folgenden Link, um dein Passwort zurückzusetzen:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>Der Link ist 1 Stunde gültig.</p>`,
          }),
        })
      } catch {
        console.log(`Password reset URL (email send failed): ${resetUrl}`)
      }
    } else {
      console.log(`[DEV] Password reset URL for ${email}: ${resetUrl}`)
    }

    return Response.json({ message: 'Falls ein Konto mit dieser E-Mail existiert, wurde ein Reset-Link gesendet.' })
  } catch (error) {
    console.error('Forgot password error:', error)
    return Response.json({ error: 'Interner Serverfehler' }, { status: 500 })
  }
}
