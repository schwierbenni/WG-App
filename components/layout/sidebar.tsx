'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home, ClipboardList, Calendar, BarChart2, Megaphone,
  ShoppingCart, CreditCard, User, Settings, Users,
  Grid3X3, X, ListMusic, Shield, ChevronRight, Dices,
} from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  adminOnly?: boolean
}

const mainNavItems: NavItem[] = [
  { href: '/dashboard',     label: 'Dashboard',      icon: Home },
  { href: '/duties',        label: 'Dienste',         icon: ClipboardList },
  { href: '/calendar',      label: 'Kalender',        icon: Calendar },
  { href: '/statistics',    label: 'Statistiken',     icon: BarChart2 },
  { href: '/announcements', label: 'Schwarzes Brett', icon: Megaphone },
  { href: '/shopping',      label: 'Einkaufsliste',   icon: ShoppingCart },
  { href: '/expenses',      label: 'Ausgaben',        icon: CreditCard },
  { href: '/games',         label: 'Spiele',          icon: Dices },
  { href: '/playlists',     label: 'Playlists',       icon: ListMusic },
  { href: '/profile',       label: 'Profil',          icon: User },
]

const adminNavItems: NavItem[] = [
  { href: '/admin/duties',   label: 'Dienste verwalten', icon: Settings, adminOnly: true },
  { href: '/admin/members',  label: 'Mitglieder',        icon: Users,    adminOnly: true },
  { href: '/admin/wg',       label: 'WG-Einstellungen',  icon: Home,     adminOnly: true },
]

const SUPER_ADMIN_EMAIL = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL ?? 'schwier.b@gmail.com'

interface SidebarProps {
  userRole?: string
  userName?: string
  userEmail?: string
  userAvatar?: string | null
  wgName?: string
  wgAvatarUrl?: string | null
}

/* ─── Desktop sidebar nav link ──────────────────────────────────────────── */
function SidebarNavLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  const pathname = usePathname()
  const isActive = item.href === '/dashboard'
    ? pathname === '/dashboard'
    : pathname.startsWith(item.href)

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 group',
        isActive
          ? 'bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-text)] shadow-sm'
          : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover-bg)] hover:text-white'
      )}
    >
      <item.icon className={cn('h-4 w-4 shrink-0 transition-transform group-hover:scale-110', isActive && 'scale-110')} />
      <span className="flex-1">{item.label}</span>
      {isActive && <ChevronRight className="h-3 w-3 opacity-50" />}
    </Link>
  )
}

/* ─── Desktop sidebar content ───────────────────────────────────────────── */
function SidebarContent({ userRole, userEmail, wgName, wgAvatarUrl, onLinkClick }: {
  userRole?: string
  userEmail?: string
  wgName?: string
  wgAvatarUrl?: string | null
  onLinkClick?: () => void
}) {
  const isAdmin = userRole === 'ADMIN'
  const isSuperAdmin = !!userEmail && userEmail === SUPER_ADMIN_EMAIL
  const displayName = wgName ?? 'Meine WG'

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Brand */}
      <Link href="/dashboard" onClick={onLinkClick} className="flex items-center gap-3 px-4 py-5 border-b border-white/10 hover:bg-white/5 transition-colors">
        <div className="shrink-0">
          {wgAvatarUrl ? (
            <Avatar className="h-10 w-10 ring-2 ring-white/20 shadow-md">
              <AvatarImage src={wgAvatarUrl} alt={displayName} className="object-cover" />
              <AvatarFallback className="text-sm font-bold bg-[var(--brand-600)] text-white">
                {getInitials(displayName)}
              </AvatarFallback>
            </Avatar>
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand-600)] shadow-md ring-2 ring-white/20">
              <span className="text-sm font-extrabold text-white">{getInitials(displayName)}</span>
            </div>
          )}
        </div>
        <div className="min-w-0">
          <span className="block text-base font-extrabold text-white leading-none truncate" style={{ fontFamily: 'var(--font-syne, system-ui)' }}>
            {displayName}
          </span>
          <p className="text-[10px] text-[var(--sidebar-text)] leading-tight mt-0.5 tracking-widest uppercase">
            WG-App
          </p>
        </div>
      </Link>

      {/* Main nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--sidebar-text)] opacity-50">
          Navigation
        </p>
        {mainNavItems.map((item) => (
          <SidebarNavLink key={item.href} item={item} onClick={onLinkClick} />
        ))}

        {isAdmin && (
          <div className="pt-4">
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--sidebar-text)] opacity-50">
              Administration
            </p>
            {adminNavItems.map((item) => (
              <SidebarNavLink key={item.href} item={item} onClick={onLinkClick} />
            ))}
          </div>
        )}

        {isSuperAdmin && (
          <div className="pt-4">
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--sidebar-text)] opacity-50">
              Super Admin
            </p>
            <SidebarNavLink
              item={{ href: '/super-admin', label: 'Alle WGs', icon: Shield }}
              onClick={onLinkClick}
            />
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-white/10">
        <p className="text-[10px] text-[var(--sidebar-text)] opacity-40 text-center tracking-wide">
          Zuhause organisiert bleiben
        </p>
      </div>
    </div>
  )
}

/* ─── Desktop sidebar ───────────────────────────────────────────────────── */
export function Sidebar({ userRole, userEmail, wgName, wgAvatarUrl }: SidebarProps) {
  return (
    <aside
      className="hidden lg:flex lg:flex-col lg:w-60 lg:shrink-0 h-full"
      style={{ background: 'var(--sidebar-bg)' }}
    >
      <SidebarContent userRole={userRole} userEmail={userEmail} wgName={wgName} wgAvatarUrl={wgAvatarUrl} />
    </aside>
  )
}

/* ─── Mobile bottom navigation ──────────────────────────────────────────── */
const bottomPrimary: NavItem[] = [
  { href: '/dashboard', label: 'Home',     icon: Home },
  { href: '/duties',    label: 'Dienste',  icon: ClipboardList },
  { href: '/calendar',  label: 'Kalender', icon: Calendar },
  { href: '/expenses',  label: 'Ausgaben', icon: CreditCard },
]

function BottomNavLink({
  item,
  active,
  onClick,
}: {
  item: NavItem
  active: boolean
  onClick?: () => void
}) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-all duration-150 relative',
        'active:scale-90',
        active ? 'text-brand-600' : 'text-[var(--text-muted)]'
      )}
    >
      {active && (
        <span className="absolute top-0.5 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-brand-600" />
      )}
      <span className={cn(
        'flex items-center justify-center rounded-xl transition-all duration-150',
        active ? 'scale-110' : 'scale-100'
      )}>
        <item.icon className="h-5 w-5" />
      </span>
      {/* Hide labels at very small screens (< 360px) */}
      <span className={cn(
        'text-[10px] leading-none hidden [@media(min-width:320px)]:block',
        active ? 'font-bold' : 'font-medium'
      )}>
        {item.label}
      </span>
    </Link>
  )
}

export function BottomNav({ userRole, userEmail }: { userRole?: string; userEmail?: string }) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  const isAdmin = userRole === 'ADMIN'
  const isSuperAdmin = !!userEmail && userEmail === SUPER_ADMIN_EMAIL

  // Close drawer on route change
  useEffect(() => { setMoreOpen(false) }, [pathname])

  // Lock body scroll when drawer open
  useEffect(() => {
    if (moreOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [moreOpen])

  const moreItems: NavItem[] = [
    { href: '/announcements', label: 'Brett',       icon: Megaphone },
    { href: '/shopping',      label: 'Einkauf',     icon: ShoppingCart },
    { href: '/statistics',    label: 'Statistiken', icon: BarChart2 },
    { href: '/games',         label: 'Spiele',      icon: Dices },
    { href: '/playlists',     label: 'Playlists',   icon: ListMusic },
    { href: '/profile',       label: 'Profil',      icon: User },
    ...(isAdmin
      ? [
          { href: '/admin/duties',  label: 'Dienste',    icon: Settings },
          { href: '/admin/members', label: 'Mitglieder', icon: Users },
          { href: '/admin/wg',      label: 'WG-Einst.',  icon: Home },
        ]
      : []),
    ...(isSuperAdmin ? [{ href: '/super-admin', label: 'Super Admin', icon: Shield }] : []),
  ]

  const moreActive = moreItems.some(i =>
    i.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(i.href)
  )

  return (
    <>
      {/* Fullscreen overlay backdrop */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMoreOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* More bottom sheet – slides up from behind the nav bar */}
      <div
        className={cn(
          'fixed left-0 right-0 z-50 lg:hidden bg-surface rounded-t-3xl shadow-2xl border-t-2 border-surface-border',
          'transition-[transform,opacity] duration-300 ease-out',
          moreOpen
            ? 'translate-y-0 opacity-100 pointer-events-auto'
            : 'translate-y-full opacity-0 pointer-events-none'
        )}
        style={{ bottom: `calc(64px + env(safe-area-inset-bottom, 0px))` }}
        aria-hidden={!moreOpen}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-surface-border" />
        </div>

        <div className="px-5 pt-2 pb-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-foreground" style={{ fontFamily: 'var(--font-syne, system-ui)' }}>
              Mehr
            </p>
            <button
              onClick={() => setMoreOpen(false)}
              className="p-2 rounded-xl text-[var(--text-muted)] hover:bg-surface-muted active:scale-90 transition-all"
              aria-label="Schließen"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {moreItems.map((item) => {
              const active = item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    'flex flex-col items-center gap-2 p-3 rounded-2xl transition-all duration-150 active:scale-90',
                    active
                      ? 'bg-brand-muted text-brand-600'
                      : 'bg-surface-muted text-foreground hover:bg-brand-muted hover:text-brand-600'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="text-[10px] font-semibold text-center leading-tight">{item.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      {/* Bottom nav bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 lg:hidden bg-surface"
        style={{ boxShadow: '0 -1px 0 0 var(--surface-border)' }}
      >
        <div className="flex items-stretch h-16">
          {bottomPrimary.map((item) => {
            const active = item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href)
            return (
              <BottomNavLink key={item.href} item={item} active={active} />
            )
          })}

          {/* More button */}
          <button
            onClick={() => setMoreOpen((v) => !v)}
            className={cn(
              'flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-all duration-150 relative active:scale-90',
              moreOpen || moreActive ? 'text-brand-600' : 'text-[var(--text-muted)]'
            )}
            aria-label="Mehr anzeigen"
            aria-expanded={moreOpen}
          >
            {(moreOpen || moreActive) && (
              <span className="absolute top-0.5 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-brand-600" />
            )}
            <span className={cn(
              'flex items-center justify-center rounded-xl transition-all duration-150',
              moreOpen ? 'scale-110 rotate-12' : 'scale-100'
            )}>
              <Grid3X3 className="h-5 w-5" />
            </span>
            <span className={cn(
              'text-[10px] leading-none hidden [@media(min-width:320px)]:block',
              (moreOpen || moreActive) ? 'font-bold' : 'font-medium'
            )}>
              Mehr
            </span>
          </button>
        </div>
        {/* Safe-area spacer: only active in standalone PWA mode.
            In Safari browser, env(safe-area-inset-bottom) includes the
            browser toolbar (~83px) which would create a huge white gap. */}
        <div aria-hidden="true" className="nav-safe-bottom" />
      </nav>
    </>
  )
}
