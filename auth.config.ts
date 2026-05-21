import type { NextAuthConfig } from 'next-auth'

export const authConfig: NextAuthConfig = {
  session: { strategy: 'jwt' },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role?: string }).role
        token.wgId = (user as { wgId?: string }).wgId
      }
      return token
    },
    async session({ session, token }) {
      return {
        ...session,
        user: {
          ...session.user,
          id: token.id as string,
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
