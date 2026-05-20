import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

const schema = z.object({
  name: z.string().min(2, 'Name muss mindestens 2 Zeichen haben').max(100),
  email: z.string().email('Ungültige E-Mail-Adresse'),
  password: z.string().min(8, 'Passwort muss mindestens 8 Zeichen haben').max(100),
  inviteToken: z.string().optional(),
})

export async function POST(request: Request) {
  let email = '(unbekannt)'
  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return Response.json({ error: 'Ungültiger Anfrage-Body.' }, { status: 400 })
    }

    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.'
      return Response.json({ error: msg }, { status: 400 })
    }

    const { name, inviteToken } = parsed.data
    email = parsed.data.email
    const password = parsed.data.password

    logger.info('Registrierungsversuch', { email })

    const userCount = await prisma.user.count()
    const isFirstUser = userCount === 0

    if (!isFirstUser) {
      if (!inviteToken) {
        logger.warn('Registrierung ohne Einladungstoken abgelehnt', { email })
        return Response.json({
          error: 'Registrierung ist nur per Einladungslink möglich. Bitte wende dich an einen Admin.'
        }, { status: 403 })
      }

      const token = await prisma.inviteToken.findUnique({ where: { token: inviteToken } })
      if (!token) {
        logger.warn('Registrierung mit ungültigem Einladungstoken', { email })
        return Response.json({ error: 'Dieser Einladungslink ist ungültig.' }, { status: 400 })
      }
      if (token.usedAt) {
        return Response.json({ error: 'Dieser Einladungslink wurde bereits verwendet.' }, { status: 400 })
      }
      if (token.expiresAt < new Date()) {
        return Response.json({ error: 'Dieser Einladungslink ist abgelaufen.' }, { status: 400 })
      }
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      logger.warn('Registrierung: E-Mail bereits vergeben', { email })
      return Response.json({ error: 'Diese E-Mail-Adresse wird bereits verwendet.' }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role: isFirstUser ? 'ADMIN' : 'MEMBER' },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    })

    if (!isFirstUser && inviteToken) {
      await prisma.inviteToken.update({
        where: { token: inviteToken },
        data: { usedAt: new Date() },
      })
    }

    if (isFirstUser) {
      const cfg = await prisma.wGConfig.findFirst()
      if (!cfg) await prisma.wGConfig.create({ data: { name: 'Meine WG' } })
    }

    logger.info('Benutzer registriert', { userId: user.id, email, role: user.role })
    return Response.json({ user }, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    logger.error('Registrierungsfehler', { email, error: msg, stack })

    if (msg.includes('DATABASE_URL')) {
      return Response.json({
        error: 'Datenbankverbindung nicht konfiguriert. Bitte wende dich an den Administrator.'
      }, { status: 503 })
    }
    if (msg.toLowerCase().includes('connect') || msg.toLowerCase().includes('econnrefused')) {
      return Response.json({
        error: 'Datenbankverbindung fehlgeschlagen. Bitte versuche es später erneut.'
      }, { status: 503 })
    }
    return Response.json({ error: 'Interner Serverfehler. Bitte versuche es erneut.' }, { status: 500 })
  }
}
