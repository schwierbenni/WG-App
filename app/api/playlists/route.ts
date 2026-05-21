import { z } from 'zod'
import { requireWgSession } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

const createSchema = z.object({
  title: z.string().min(1, 'Titel fehlt').max(100),
  description: z.string().max(200).optional(),
  spotifyUrl: z
    .string()
    .url('Kein gültiger Link')
    .refine(
      (url) => url.startsWith('https://open.spotify.com/'),
      'Bitte füge einen Link von open.spotify.com ein'
    ),
})

export async function GET() {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { wgId } = auth

  try {
    const playlists = await prisma.spotifyPlaylist.findMany({
      where: { wgId },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return Response.json({ playlists })
  } catch (error) {
    console.error('GET playlists error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { session, wgId } = auth

  try {
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const playlist = await prisma.spotifyPlaylist.create({
      data: {
        userId: session.user.id,
        wgId,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        spotifyUrl: parsed.data.spotifyUrl,
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    })

    return Response.json({ playlist }, { status: 201 })
  } catch (error) {
    console.error('POST playlists error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
