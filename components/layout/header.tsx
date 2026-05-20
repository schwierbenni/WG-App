'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Bell, Moon, Sun, LogOut, User } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getInitials, cn } from '@/lib/utils'

interface Notification {
  id: string
  type: string
  message: string
  readAt: string | null
  createdAt: string
}

interface HeaderProps {
  userName?: string | null
  userEmail?: string | null
  userAvatar?: string | null
}

function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const stored = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const initial = stored === 'dark' || (!stored && prefersDark) ? 'dark' : 'light'
    setTheme(initial)
    document.documentElement.classList.toggle('dark', initial === 'dark')
  }, [])

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.classList.toggle('dark', next === 'dark')
    localStorage.setItem('theme', next)
  }

  return (
    <button
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Helles Design' : 'Dunkles Design'}
      className={cn(
        'relative h-8 w-14 rounded-full border-2 transition-colors duration-300',
        theme === 'dark'
          ? 'bg-[var(--brand-muted)] border-brand-600'
          : 'bg-surface-muted border-surface-border'
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 flex h-5 w-5 items-center justify-center rounded-full shadow-sm transition-all duration-300',
          theme === 'dark'
            ? 'left-[calc(100%-1.625rem)] bg-brand-600 text-white'
            : 'left-0.5 bg-white text-[var(--text-muted)]'
        )}
      >
        {theme === 'dark' ? <Moon className="h-3 w-3" /> : <Sun className="h-3 w-3" />}
      </span>
    </button>
  )
}

function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?unread=true&limit=10')
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications ?? [])
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60_000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  const unreadCount = notifications.filter((n) => !n.readAt).length

  async function markAllRead() {
    try {
      await fetch('/api/notifications/read-all', { method: 'POST' })
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: new Date().toISOString() })))
    } catch { /* ignore */ }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-muted)] hover:bg-surface-muted hover:text-foreground transition-colors"
          aria-label={`Benachrichtigungen${unreadCount > 0 ? ` (${unreadCount} ungelesen)` : ''}`}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent-500)] text-[10px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 rounded-2xl border-2 border-surface-border">
        <div className="flex items-center justify-between px-3 py-2.5">
          <DropdownMenuLabel
            className="p-0 font-bold text-foreground"
            style={{ fontFamily: 'var(--font-syne, system-ui)' }}
          >
            Benachrichtigungen
          </DropdownMenuLabel>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors"
            >
              Alle gelesen
            </button>
          )}
        </div>
        <DropdownMenuSeparator className="bg-surface-border" />
        {notifications.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <Bell className="h-8 w-8 text-[var(--text-subtle)] mx-auto mb-2 opacity-40" />
            <p className="text-sm text-[var(--text-muted)]">Alles ruhig hier</p>
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={cn(
                  'flex gap-3 px-3 py-2.5 text-sm border-b border-surface-border last:border-0',
                  !n.readAt && 'bg-brand-muted'
                )}
              >
                {!n.readAt && (
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />
                )}
                <p className={cn('text-[var(--text-muted)]', !n.readAt && 'font-medium text-foreground')}>
                  {n.message}
                </p>
              </div>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function Header({ userName, userEmail, userAvatar }: HeaderProps) {
  const router = useRouter()

  async function handleSignOut() {
    await signOut({ redirect: false })
    router.push('/login')
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b-2 border-surface-border bg-surface px-4 shadow-sm">
      {/* Brand – mobile only */}
      <Link
        href="/dashboard"
        className="lg:hidden"
        aria-label="FlatMate Dashboard"
      >
        <span
          className="text-lg font-extrabold text-brand-600"
          style={{ fontFamily: 'var(--font-syne, system-ui)' }}
        >
          FlatMate
        </span>
      </Link>

      {/* Desktop spacer */}
      <div className="hidden lg:block" />

      {/* Right controls */}
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <NotificationBell />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="ml-1 flex items-center gap-2 rounded-full ring-2 ring-transparent hover:ring-brand-600 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
              aria-label="Benutzermenü"
            >
              <Avatar className="h-8 w-8">
                {userAvatar && <AvatarImage src={userAvatar} alt={userName ?? 'Benutzer'} />}
                <AvatarFallback
                  className="text-xs font-bold bg-brand-muted text-brand-600"
                >
                  {userName ? getInitials(userName) : 'U'}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-52 rounded-2xl border-2 border-surface-border">
            <DropdownMenuLabel className="font-normal pb-2">
              <div className="flex flex-col gap-0.5">
                <p
                  className="text-sm font-bold text-foreground truncate"
                  style={{ fontFamily: 'var(--font-syne, system-ui)' }}
                >
                  {userName ?? 'Benutzer'}
                </p>
                <p className="text-xs text-[var(--text-muted)] truncate">{userEmail ?? ''}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-surface-border" />
            <DropdownMenuItem asChild>
              <Link href="/profile" className="cursor-pointer rounded-xl">
                <User className="mr-2 h-4 w-4 text-[var(--text-muted)]" />
                Profil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-surface-border" />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="text-[var(--danger)] focus:text-[var(--danger)] focus:bg-[var(--danger-bg)] cursor-pointer rounded-xl"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Abmelden
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
