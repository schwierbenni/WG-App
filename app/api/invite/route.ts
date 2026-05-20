import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

const validateTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
})

export async function GET(request: Request) {
  const session = await auth()
  if (!session) return new Response('Unauthorized', { status: 401 })
  if (session.user.role !== 'ADMIN') return Response.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const inviteToken = await prisma.inviteToken.create({
      data: { createdBy: session.user.id, expiresAt },
    })

    const baseUrl = new URL(request.url).origin
    const url = `${baseUrl}/register?invite=${inviteToken.token}`

    return Response.json({ token: inviteToken.token, url })
  } catch (error) {
    console.error('GET invite error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = validateTokenSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const inviteToken = await prisma.inviteToken.findUnique({ where: { token: parsed.data.token } })

    if (!inviteToken) return Response.json({ valid: false, error: 'Invalid token' }, { status: 400 })
    if (inviteToken.usedAt) return Response.json({ valid: false, error: 'Token has already been used' }, { status: 400 })
    if (inviteToken.expiresAt < new Date()) return Response.json({ valid: false, error: 'Token has expired' }, { status: 400 })

    return Response.json({ valid: true })
  } catch (error) {
    console.error('POST invite error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
