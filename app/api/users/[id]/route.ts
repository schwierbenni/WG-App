import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  avatarUrl: z.string().url().nullable().optional(),
  emailNotifications: z.boolean().optional(),
  role: z.enum(['ADMIN', 'MEMBER']).optional(),
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return new Response('Unauthorized', { status: 401 })

  const { id } = await params

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, avatarUrl: true, role: true, emailNotifications: true, createdAt: true },
    })

    if (!user) return Response.json({ error: 'User not found' }, { status: 404 })

    return Response.json({ user })
  } catch (error) {
    console.error('GET user error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return new Response('Unauthorized', { status: 401 })

  const { id } = await params
  const isSelf = session.user.id === id
  const isAdmin = session.user.role === 'ADMIN'

  if (!isSelf && !isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = updateUserSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing) return Response.json({ error: 'User not found' }, { status: 404 })

    const { name, avatarUrl, emailNotifications, role } = parsed.data

    if (role !== undefined) {
      if (!isAdmin) return Response.json({ error: 'Only admins can change roles' }, { status: 403 })
      if (isSelf) return Response.json({ error: 'You cannot change your own role' }, { status: 403 })
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl
    if (emailNotifications !== undefined) updateData.emailNotifications = emailNotifications
    if (role !== undefined && isAdmin && !isSelf) updateData.role = role

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, email: true, avatarUrl: true, role: true, emailNotifications: true, createdAt: true },
    })

    return Response.json({ user })
  } catch (error) {
    console.error('PATCH user error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return new Response('Unauthorized', { status: 401 })

  const { id } = await params
  const isSelf = session.user.id === id
  const isAdmin = session.user.role === 'ADMIN'

  if (!isSelf && !isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing) return Response.json({ error: 'User not found' }, { status: 404 })

    await prisma.user.delete({ where: { id } })
    return new Response(null, { status: 204 })
  } catch (error) {
    console.error('DELETE user error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
