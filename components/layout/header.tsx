'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Bell, Moon, Sun, LogOut, User, ArrowLeftRight, ClipboardList, Megaphone, Calendar } from 'lucide-react'
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
  link: string | null
  readAt: string | null
  createdAt: string
}

const NOTIFICATION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  SWAP_REQUEST: ArrowLeftRight,
  ASSIGNMENT: ClipboardList,
  REMINDER: ClipboardList,
  ANNOUNCEMENT: Megaphone,
  ICAL_REMINDER: Calendar,
}

interface HeaderProps {
  userName?: string | null
  userEmail?: string | null
  userAvatar?: string | null
  wgName?: string
  wgAvatarUrl?: string | null
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
  const router = useRouter()
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

  async function handleNotificationClick(n: Notification) {
    setOpen(false)
    if (!n.readAt) {
      try {
        await fetch(`/api/notifications/${n.id}/read`, { method: 'POST' })
        setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x))
      } catch { /* ignore */ }
    }
    if (n.link) router.push(n.link)
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
            {notifications.map((n) => {
              const Icon = NOTIFICATION_ICONS[n.type] ?? Bell
              return (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={cn(
                    'w-full flex gap-3 px-3 py-2.5 text-sm border-b border-surface-border last:border-0 text-left transition-colors',
                    !n.readAt ? 'bg-brand-muted hover:bg-brand-muted/80' : 'hover:bg-surface-muted',
                    n.link && 'cursor-pointer',
                    !n.link && 'cursor-default',
                  )}
                >
                  <span className={cn(
                    'mt-0.5 shrink-0 flex h-6 w-6 items-center justify-center rounded-full',
                    !n.readAt ? 'bg-brand-600 text-white' : 'bg-surface-muted text-[var(--text-muted)]',
                  )}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <p className={cn('flex-1 text-[var(--text-muted)] leading-snug', !n.readAt && 'font-medium text-foreground')}>
                    {n.message}
                  </p>
                </button>
              )
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function Header({ userName, userEmail, userAvatar, wgName, wgAvatarUrl }: HeaderProps) {
  const router = useRouter()

  async function handleSignOut() {
    await signOut({ redirect: false })
    router.push('/login')
  }

  const displayName = wgName ?? 'Meine WG'

  return (
    <header className="z-10 flex h-12 lg:h-14 shrink-0 items-center justify-between gap-4 border-b-2 border-surface-border bg-surface px-4 shadow-sm">
      {/* WG identity – mobile only */}
      <Link
        href="/dashboard"
        className="lg:hidden flex items-center gap-2.5"
        aria-label="Dashboard"
      >
        {wgAvatarUrl ? (
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarImage src={wgAvatarUrl} alt={displayName} className="object-cover" />
            <AvatarFallback className="text-[10px] font-bold bg-brand-muted text-brand-600">
              {getInitials(displayName)}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-muted shrink-0">
            <span className="text-[10px] font-extrabold text-brand-600">{getInitials(displayName)}</span>
          </div>
        )}
        <span
          className="text-base font-extrabold text-brand-600 truncate max-w-[140px]"
          style={{ fontFamily: 'var(--font-syne, system-ui)' }}
        >
          {displayName}
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
