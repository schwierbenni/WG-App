import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'

const registerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = registerSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const { name, email, password } = parsed.data

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return Response.json({ error: 'Email already in use' }, { status: 409 })

    const userCount = await prisma.user.count()
    const isFirstUser = userCount === 0
    const passwordHash = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: { name, email, passwordHash, role: isFirstUser ? 'ADMIN' : 'MEMBER' },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    })

    const wgConfig = await prisma.wGConfig.findFirst()
    if (!wgConfig) {
      await prisma.wGConfig.create({ data: { name: 'My WG' } })
    }

    return Response.json({ user }, { status: 201 })
  } catch (error) {
    console.error('Register error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
