import NextAuth from 'next-auth'
import { authConfig } from '@/auth.config'
import { NextResponse } from 'next/server'

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const { pathname } = req.nextUrl
  const cronPaths = new Set([
    '/api/duties/cron', '/api/calendar/cron', '/api/ical/cron',
    '/api/announcements/cron', '/api/duties/reminder-early', '/api/duties/reminder-late',
  ])
  if (cronPaths.has(pathname)) {
    return process.env.CRON_SECRET && req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`
      ? NextResponse.next()
      : new NextResponse('Unauthorized', { status: 401 })
  }

  const isAuthPage =
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password')
  const isApiAuth = pathname.startsWith('/api/auth')
  const isApiPublic =
    pathname === '/api/register' || pathname === '/api/invite'

  if (isApiAuth || isApiPublic) return NextResponse.next()

  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', req.nextUrl))
  }

  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', req.nextUrl))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\.png$|.*\.svg$).*)'],
}
