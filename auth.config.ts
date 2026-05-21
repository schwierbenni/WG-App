import type { NextAuthConfig } from 'next-auth'
import { prisma } from '@/lib/db'

export const authConfig: NextAuthConfig = {
  session: { strategy: 'jwt' },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Fresh sign-in: copy fields from the authorize() return value
        token.id = user.id
        token.role = (user as { role?: string }).role
        token.wgId = (user as { wgId?: string }).wgId
      } else if (token.id && !token.wgId) {
        // Existing session without wgId (users who signed in before the
        // wgId migration). Fetch once from DB so they don't need to re-login.
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { wgId: true, role: true },
        })
        if (dbUser) {
          token.wgId = dbUser.wgId
          token.role = dbUser.role
        }
      }
      return token
    },
    async session({ session, token }) {
      return {
        ...session,
        user: {
          ...session.user,
          id: (token.id ?? '') as string,
          role: (token.role ?? '') as string,
          wgId: (token.wgId ?? '') as string,
        },
      }
    },
  },
  pages: {
    signIn: '/login',
  },
}
