'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home, ClipboardList, Calendar, BarChart2, Megaphone,
  ShoppingCart, CreditCard, User, Settings, Users,
  ChevronRight, Grid3X3, X, ListMusic, Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'

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
function SidebarContent({ userRole, userEmail, wgName, onLinkClick }: { userRole?: string; userEmail?: string; wgName?: string; onLinkClick?: () => void }) {
  const isAdmin = userRole === 'ADMIN'
  const isSuperAdmin = !!userEmail && userEmail === SUPER_ADMIN_EMAIL

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-600)] shadow-md">
          <Home className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0">
          <span
            className="block text-base font-extrabold text-white leading-none truncate"
            style={{ fontFamily: 'var(--font-syne, system-ui)' }}
          >
            {wgName ?? 'Meine WG'}
          </span>
          <p className="text-[10px] text-[var(--sidebar-text)] leading-tight mt-0.5 tracking-widest uppercase">
            WG-App
          </p>
        </div>
      </div>

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
export function Sidebar({ userRole, userEmail, wgName }: SidebarProps) {
  return (
    <aside
      className="hidden lg:flex lg:flex-col lg:w-60 lg:shrink-0 h-full"
      style={{ background: 'var(--sidebar-bg)' }}
    >
      <SidebarContent userRole={userRole} userEmail={userEmail} wgName={wgName} />
    </aside>
  )
}

/* ─── Mobile bottom navigation ──────────────────────────────────────────── */
const bottomPrimary: NavItem[] = [
  { href: '/dashboard',     label: 'Home',    icon: Home },
  { href: '/duties',        label: 'Dienste', icon: ClipboardList },
  { href: '/announcements', label: 'Brett',   icon: Megaphone },
  { href: '/shopping',      label: 'Einkauf', icon: ShoppingCart },
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
        'flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-colors relative',
        active ? 'text-brand-600' : 'text-[var(--text-muted)]'
      )}
    >
      {active && (
        <span className="absolute top-1 w-1 h-1 rounded-full bg-brand-600 nav-active-dot" />
      )}
      <item.icon className={cn('h-5 w-5 transition-transform', active && 'scale-110')} />
      <span className={cn('text-[10px]', active ? 'font-bold' : 'font-medium')}>
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

  const moreItems = [
    { href: '/calendar',   label: 'Kalender',    icon: Calendar },
    { href: '/statistics', label: 'Statistiken', icon: BarChart2 },
    { href: '/expenses',   label: 'Ausgaben',    icon: CreditCard },
    { href: '/playlists',  label: 'Playlists',   icon: ListMusic },
    { href: '/profile',    label: 'Profil',      icon: User },
    ...(isAdmin
      ? [
          { href: '/admin/duties',  label: 'Verwaltung',  icon: Settings },
          { href: '/admin/members', label: 'Mitglieder',  icon: Users },
        ]
      : []),
    ...(isSuperAdmin ? [{ href: '/super-admin', label: 'Super Admin', icon: Shield }] : []),
  ]

  const moreActive = moreItems.some(i =>
    i.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(i.href)
  )

  return (
    <>
      {/* More sheet backdrop */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMoreOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* More bottom sheet */}
      {moreOpen && (
        <div
          className="fixed left-0 right-0 z-50 lg:hidden bg-surface rounded-t-3xl shadow-2xl border-t border-surface-border"
          style={{ bottom: `calc(64px + env(safe-area-inset-bottom, 0px))` }}
        >
          <div className="px-4 pt-3 pb-4">
            <div className="flex items-center justify-between mb-4">
              <p
                className="text-sm font-bold text-foreground"
                style={{ fontFamily: 'var(--font-syne, system-ui)' }}
              >
                Mehr
              </p>
              <button
                onClick={() => setMoreOpen(false)}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-surface-muted transition-colors"
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
                      'flex flex-col items-center gap-2 p-3 rounded-2xl transition-colors',
                      active
                        ? 'bg-brand-muted text-brand-600'
                        : 'bg-surface-muted text-foreground hover:bg-brand-muted hover:text-brand-600'
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="text-[10px] font-semibold text-center leading-tight">
                      {item.label}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Bottom nav bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 lg:hidden bg-surface border-t-2 border-surface-border"
        style={{
          height: `calc(64px + env(safe-area-inset-bottom, 0px))`,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
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
              'flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-colors relative',
              moreOpen || moreActive ? 'text-brand-600' : 'text-[var(--text-muted)]'
            )}
            aria-label="Mehr anzeigen"
          >
            {(moreOpen || moreActive) && (
              <span className="absolute top-1 w-1 h-1 rounded-full bg-brand-600 nav-active-dot" />
            )}
            <Grid3X3 className={cn('h-5 w-5 transition-transform', moreOpen && 'scale-110 rotate-12')} />
            <span className={cn('text-[10px]', (moreOpen || moreActive) ? 'font-bold' : 'font-medium')}>
              Mehr
            </span>
          </button>
        </div>
      </nav>
    </>
  )
}
