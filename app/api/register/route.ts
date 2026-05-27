import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { DEFAULT_EXPENSE_CATEGORIES } from '@/lib/expense-categories'

const registerSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich'),
  email: z.string().email('Ungültige E-Mail-Adresse'),
  password: z.string().min(8, 'Passwort muss mindestens 8 Zeichen haben'),
  inviteToken: z.string().optional(),
})

const PREDEFINED_DUTIES = [
  {
    name: 'Küchendienst',
    emoji: '🍳',
    color: '#f59e0b',
    description: 'Küche putzen, Abwasch erledigen und Herd reinigen',
    rotationInterval: 'WEEKLY' as const,
  },
  {
    name: 'Mülldienst',
    emoji: '🗑️',
    color: '#10b981',
    description: 'Müll runterbringen und Mülleimer austauschen',
    rotationInterval: 'WEEKLY' as const,
  },
  {
    name: 'Flurdienst',
    emoji: '🧹',
    color: '#3b82f6',
    description: 'Flur und Eingangsbereich saugen und wischen',
    rotationInterval: 'BIWEEKLY' as const,
  },
  {
    name: 'Wohnzimmerdienst',
    emoji: '🛋️',
    color: '#8b5cf6',
    description: 'Wohnzimmer aufräumen und staubsaugen',
    rotationInterval: 'WEEKLY' as const,
  },
]

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = registerSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json({ error: 'Ungültige Eingaben', details: parsed.error.flatten() }, { status: 400 })
    }

    const { name, email, password, inviteToken } = parsed.data
    logger.info('Registrierungsversuch', { email })

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      logger.warn('E-Mail bereits vergeben', { email })
      return Response.json({ error: 'Diese E-Mail-Adresse ist bereits registriert.' }, { status: 409 })
    }

    const userCount = await prisma.user.count()
    const isFirstUser = userCount === 0

    let wgId: string
    let role: 'ADMIN' | 'MEMBER'

    if (isFirstUser) {
      const wgConfig = await prisma.wGConfig.findFirst()
      const wg = wgConfig ?? await prisma.wGConfig.create({ data: { name: 'Meine WG' } })
      wgId = wg.id
      role = 'ADMIN'
    } else {
      if (!inviteToken) {
        return Response.json(
          { error: 'Für die Registrierung ist ein Einladungslink erforderlich.' },
          { status: 403 }
        )
      }

      const token = await prisma.inviteToken.findUnique({ where: { token: inviteToken } })
      if (!token) {
        return Response.json({ error: 'Dieser Einladungslink ist ungültig.' }, { status: 400 })
      }
      if (token.usedAt) {
        logger.warn('Einladungstoken bereits verwendet', { email })
        return Response.json({ error: 'Dieser Einladungslink wurde bereits verwendet.' }, { status: 403 })
      }
      if (token.expiresAt < new Date()) {
        logger.warn('Einladungstoken abgelaufen', { email })
        return Response.json({ error: 'Dieser Einladungslink ist abgelaufen.' }, { status: 403 })
      }

      wgId = token.wgId

      const existingAdmin = await prisma.user.findFirst({
        where: { wgId: token.wgId, role: 'ADMIN' },
      })
      role = existingAdmin ? 'MEMBER' : 'ADMIN'

      await prisma.inviteToken.update({
        where: { token: inviteToken },
        data: { usedAt: new Date() },
      })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { wgId, name, email, passwordHash, role },
      select: { id: true, name: true, email: true, role: true, wgId: true, createdAt: true },
    })

    logger.info('Benutzer erstellt', { userId: user.id, email, role: user.role, wgId })

    if (isFirstUser) {
      await Promise.all(
        PREDEFINED_DUTIES.map((duty) =>
          prisma.duty.create({
            data: { ...duty, wgId, rotationOrder: [user.id] },
          })
        )
      )
      logger.info('Standard-Dienste erstellt', { userId: user.id, wgId })

      await Promise.all(
        DEFAULT_EXPENSE_CATEGORIES.map((cat) =>
          prisma.wGExpenseCategory.create({
            data: { wgId, name: cat.name, slug: cat.slug, color: cat.color, emoji: cat.emoji, isDefault: true, sortOrder: cat.sortOrder },
          })
        )
      )
      logger.info('Standard-Ausgabenkategorien erstellt', { userId: user.id, wgId })
    }

    return Response.json({ user }, { status: 201 })
  } catch (error) {
    logger.error('Registrierungsfehler', { error: String(error) })
    return Response.json({ error: 'Interner Serverfehler. Bitte versuche es erneut.' }, { status: 500 })
  }
}
