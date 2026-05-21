import { z } from 'zod'
import { requireWgSession } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

const updateSchema = z.object({
  name: z.string().min(1, 'Name darf nicht leer sein').max(100).optional(),
  avatarUrl: z.string().url('Ungültige URL').nullable().optional(),
  emailNotifications: z.boolean().optional(),
  role: z.enum(['ADMIN', 'MEMBER']).optional(),
})

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { wgId } = auth

  const { id } = await params
  try {
    const user = await prisma.user.findUnique({
      where: { id, wgId },
      select: { id: true, name: true, email: true, avatarUrl: true, role: true, emailNotifications: true, createdAt: true },
    })
    if (!user) return Response.json({ error: 'Benutzer nicht gefunden.' }, { status: 404 })
    return Response.json({ user })
  } catch (error) {
    logger.error('GET /api/users/[id] fehlgeschlagen', { id, error: error instanceof Error ? error.message : String(error) })
    return Response.json({ error: 'Benutzer konnte nicht geladen werden.' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { session, wgId } = auth

  const { id } = await params
  const isSelf = session.user.id === id
  const isAdmin = session.user.role === 'ADMIN'

  if (!isSelf && !isAdmin) {
    return Response.json({ error: 'Keine Berechtigung.' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.'
      return Response.json({ error: msg }, { status: 400 })
    }

    const { name, avatarUrl, emailNotifications, role } = parsed.data

    if (role !== undefined) {
      if (!isAdmin) return Response.json({ error: 'Nur Admins können Rollen ändern.' }, { status: 403 })
      if (isSelf) return Response.json({ error: 'Du kannst deine eigene Rolle nicht ändern.' }, { status: 403 })
    }

    const existing = await prisma.user.findUnique({ where: { id, wgId } })
    if (!existing) return Response.json({ error: 'Benutzer nicht gefunden.' }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (avatarUrl !== undefined) data.avatarUrl = avatarUrl
    if (emailNotifications !== undefined) data.emailNotifications = emailNotifications
    if (role !== undefined && isAdmin && !isSelf) data.role = role

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, avatarUrl: true, role: true, emailNotifications: true, createdAt: true },
    })

    logger.info('Benutzer aktualisiert', { updatedId: id, by: session.user.id, fields: Object.keys(data) })
    return Response.json({ user })
  } catch (error) {
    logger.error('PATCH /api/users/[id] fehlgeschlagen', { id, error: error instanceof Error ? error.message : String(error) })
    return Response.json({ error: 'Benutzer konnte nicht aktualisiert werden.' }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { session, wgId } = auth

  const { id } = await params
  const isSelf = session.user.id === id
  const isAdmin = session.user.role === 'ADMIN'

  if (!isSelf && !isAdmin) {
    return Response.json({ error: 'Keine Berechtigung.' }, { status: 403 })
  }

  try {
    const existing = await prisma.user.findUnique({ where: { id, wgId } })
    if (!existing) return Response.json({ error: 'Benutzer nicht gefunden.' }, { status: 404 })

    await prisma.user.delete({ where: { id } })
    logger.info('Benutzer gelöscht', { deletedId: id, by: session.user.id })
    return new Response(null, { status: 204 })
  } catch (error) {
    logger.error('DELETE /api/users/[id] fehlgeschlagen', { id, error: error instanceof Error ? error.message : String(error) })
    return Response.json({ error: 'Benutzer konnte nicht gelöscht werden.' }, { status: 500 })
  }
}
