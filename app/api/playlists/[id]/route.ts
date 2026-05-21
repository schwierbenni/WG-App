import { requireWgSession } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { session, wgId } = auth

  const { id } = await params

  try {
    const playlist = await prisma.spotifyPlaylist.findUnique({ where: { id } })
    if (!playlist || playlist.wgId !== wgId) {
      return Response.json({ error: 'Not found' }, { status: 404 })
    }
    if (playlist.userId !== session.user.id) {
      return Response.json({ error: 'Nur der Ersteller kann die Playlist löschen' }, { status: 403 })
    }

    await prisma.spotifyPlaylist.delete({ where: { id } })
    return new Response(null, { status: 204 })
  } catch (error) {
    console.error('DELETE playlist error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
