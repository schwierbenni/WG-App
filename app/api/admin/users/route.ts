import { requireWgSession } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

function getSearchParams(request: Request): URLSearchParams {
  try {
    return new URL(request.url).searchParams
  } catch {
    const idx = request.url.indexOf('?')
    return new URLSearchParams(idx >= 0 ? request.url.slice(idx + 1) : '')
  }
}

export async function GET(request: Request) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { session } = auth

  if (session.user.role !== 'ADMIN') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const searchParams = getSearchParams(request)
  const wgId = searchParams.get('wgId')

  try {
    const users = await prisma.user.findMany({
      where: wgId ? { wgId } : undefined,
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        role: true,
        wgId: true,
        emailNotifications: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    })
    return Response.json({ users })
  } catch (error) {
    console.error('GET /api/admin/users error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
