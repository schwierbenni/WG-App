import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

const schema = z.object({
  currentPassword: z.string().min(1, 'Aktuelles Passwort ist erforderlich'),
  newPassword: z.string().min(8, 'Neues Passwort muss mindestens 8 Zeichen haben'),
})

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe' }, { status: 400 })
    }

    const { currentPassword, newPassword } = parsed.data

    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user) {
      return Response.json({ error: 'Benutzer nicht gefunden' }, { status: 404 })
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) {
      return Response.json({ error: 'Aktuelles Passwort ist falsch' }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } })

    return Response.json({ message: 'Passwort erfolgreich geändert' })
  } catch (error) {
    console.error('Change password error:', error)
    return Response.json({ error: 'Interner Serverfehler' }, { status: 500 })
  }
}
