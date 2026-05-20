import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session) return new Response('Unauthorized', { status: 401 })

  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, avatarUrl: true, role: true, emailNotifications: true, createdAt: true },
      orderBy: { name: 'asc' },
    })
    return Response.json({ users })
  } catch (error) {
    console.error('GET users error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
