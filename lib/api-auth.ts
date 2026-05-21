import { auth } from './auth'

export type WgSession = {
  user: {
    id: string
    role: string
    wgId: string
    name?: string | null
    email?: string | null
    image?: string | null
  }
  expires: string
}

type AuthResult =
  | { ok: true; session: WgSession; wgId: string }
  | { ok: false; response: Response }

export async function requireWgSession(): Promise<AuthResult> {
  const session = (await auth()) as unknown as WgSession | null

  if (!session) {
    return { ok: false, response: new Response('Unauthorized', { status: 401 }) }
  }
  if (!session.user.wgId) {
    return {
      ok: false,
      response: Response.json(
        { error: 'Kein WG-Kontext. Bitte erneut anmelden.' },
        { status: 403 }
      ),
    }
  }
  return { ok: true, session, wgId: session.user.wgId }
}
