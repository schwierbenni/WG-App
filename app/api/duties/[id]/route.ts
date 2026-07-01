import { z } from 'zod'
import { requireWgSession } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

const updateDutySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  emoji: z.string().optional(),
  color: z.string().optional(),
  rotationInterval: z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'MANUAL']).optional(),
  dueWeekday: z.number().int().min(0).max(6).nullable().optional(),
  isActive: z.boolean().optional(),
  isPaused: z.boolean().optional(),
  checklistItems: z.array(z.string()).optional(),
  rotationOrder: z.array(z.string()).optional(),
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { wgId } = auth

  const { id } = await params

  try {
    const duty = await prisma.duty.findUnique({
      where: { id, wgId },
      include: {
        assignments: {
          include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
          orderBy: { dueDate: 'desc' },
          take: 10,
        },
      },
    })

    if (!duty) return Response.json({ error: 'Duty not found' }, { status: 404 })

    return Response.json({ duty })
  } catch (error) {
    console.error('GET duty error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { session, wgId } = auth

  if (session.user.role !== 'ADMIN') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  try {
    const body = await request.json()
    const parsed = updateDutySchema.safeParse(body)

    if (!parsed.success) {
      return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const existing = await prisma.duty.findUnique({ where: { id, wgId } })
    if (!existing) return Response.json({ error: 'Duty not found' }, { status: 404 })

    const duty = await prisma.duty.update({ where: { id }, data: parsed.data })

    return Response.json({ duty })
  } catch (error) {
    console.error('PATCH duty error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { session, wgId } = auth

  if (session.user.role !== 'ADMIN') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  try {
    const existing = await prisma.duty.findUnique({ where: { id, wgId } })
    if (!existing) return Response.json({ error: 'Duty not found' }, { status: 404 })

    await prisma.duty.delete({ where: { id } })
    return new Response(null, { status: 204 })
  } catch (error) {
    console.error('DELETE duty error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
