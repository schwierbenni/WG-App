import { z } from 'zod'
import { requireWgSession } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

const validateSchema = z.object({
  token: z.string().min(1, 'Token ist erforderlich'),
})

export async function GET(request: Request) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { session, wgId: sessionWgId } = auth

  if (session.user.role !== 'ADMIN') {
    return Response.json({ error: 'Nur Admins können Einladungslinks erstellen.' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const targetWgId = searchParams.get('wgId') ?? sessionWgId

  if (targetWgId !== sessionWgId) {
    const targetWg = await prisma.wGConfig.findUnique({ where: { id: targetWgId }, select: { id: true } })
    if (!targetWg) return Response.json({ error: 'WG nicht gefunden.' }, { status: 404 })
  }

  try {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const invite = await prisma.inviteToken.create({
      data: { wgId: targetWgId, createdBy: session.user.id, expiresAt },
    })

    const baseUrl = (process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin).replace(/\/$/, '')
    const url = `${baseUrl}/register?token=${invite.token}`

    logger.info('Einladungslink erstellt', { by: session.user.id, token: invite.token, expiresAt, wgId: targetWgId })
    return Response.json({ token: invite.token, url, wgId: targetWgId })
  } catch (error) {
    logger.error('GET /api/invite fehlgeschlagen', { error: error instanceof Error ? error.message : String(error) })
    return Response.json({ error: 'Einladungslink konnte nicht erstellt werden.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = validateSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Token fehlt oder ist ungültig.' }, { status: 400 })
    }

    const { token } = parsed.data
    const invite = await prisma.inviteToken.findUnique({ where: { token } })

    if (!invite) return Response.json({ valid: false, error: 'Ungültiger Einladungslink.' }, { status: 400 })
    if (invite.usedAt) return Response.json({ valid: false, error: 'Dieser Link wurde bereits verwendet.' }, { status: 400 })
    if (invite.expiresAt < new Date()) return Response.json({ valid: false, error: 'Dieser Link ist abgelaufen.' }, { status: 400 })

    return Response.json({ valid: true })
  } catch (error) {
    logger.error('POST /api/invite fehlgeschlagen', { error: error instanceof Error ? error.message : String(error) })
    return Response.json({ error: 'Einladungslink konnte nicht geprüft werden.' }, { status: 500 })
  }
}
