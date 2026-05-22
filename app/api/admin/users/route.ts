import { requireWgSession, isSuperAdmin } from '@/lib/api-auth'
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
  const { session, wgId: sessionWgId } = auth

  if (session.user.role !== 'ADMIN') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Regular admins always see only their own WG – ignore any wgId param
  const superAdmin = isSuperAdmin(session.user.email)
  const searchParams = getSearchParams(request)
  const requestedWgId = searchParams.get('wgId')
  const wgId = superAdmin ? (requestedWgId ?? undefined) : sessionWgId

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
