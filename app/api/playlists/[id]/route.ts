import { z } from 'zod'
import { requireWgSession } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

const updateSchema = z.object({
  title: z.string().min(1, 'Titel fehlt').max(100).optional(),
  description: z.string().max(200).nullable().optional(),
  spotifyUrl: z
    .string()
    .url('Kein gültiger Link')
    .refine(
      (url) => url.startsWith('https://open.spotify.com/'),
      'Bitte füge einen Link von open.spotify.com ein'
    )
    .optional(),
})

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

export async function PATCH(
  req: Request,
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
      return Response.json({ error: 'Nur der Ersteller kann die Playlist bearbeiten' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const updated = await prisma.spotifyPlaylist.update({
      where: { id },
      data: {
        ...(parsed.data.title !== undefined && { title: parsed.data.title }),
        ...(parsed.data.description !== undefined && { description: parsed.data.description }),
        ...(parsed.data.spotifyUrl !== undefined && { spotifyUrl: parsed.data.spotifyUrl }),
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    })

    return Response.json({ playlist: updated })
  } catch (error) {
    console.error('PATCH playlist error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
