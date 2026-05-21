import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: { id: string; role: string; wgId: string } & DefaultSession['user']
  }
  interface User {
    role?: string
    wgId?: string
  }
}

declare module '@auth/core/adapters' {
  interface AdapterUser {
    role: string
    wgId: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT { id?: string; role?: string; wgId?: string }
}
