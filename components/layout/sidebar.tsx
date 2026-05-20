'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home, ClipboardList, Calendar, BarChart2, Megaphone,
  ShoppingCart, CreditCard, User, Settings, X, Menu, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  adminOnly?: boolean
}

const mainNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/duties', label: 'Dienste', icon: ClipboardList },
  { href: '/calendar', label: 'Kalender', icon: Calendar },
  { href: '/statistics', label: 'Statistiken', icon: BarChart2 },
  { href: '/announcements', label: 'Schwarzes Brett', icon: Megaphone },
  { href: '/shopping', label: 'Einkaufsliste', icon: ShoppingCart },
  { href: '/expenses', label: 'Ausgaben', icon: CreditCard },
  { href: '/profile', label: 'Profil', icon: User },
]

const adminNavItems: NavItem[] = [
  { href: '/admin/duties', label: 'Dienste verwalten', icon: Settings, adminOnly: true },
  { href: '/admin/members', label: 'Mitglieder', icon: User, adminOnly: true },
]

interface SidebarProps {
  userRole?: string
  userName?: string
  userEmail?: string
  userAvatar?: string | null
}

function NavLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  const pathname = usePathname()
  const isActive = item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href)

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
        isActive
          ? 'bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-text)] shadow-sm'
          : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover-bg)] hover:text-white'
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      <span>{item.label}</span>
      {isActive && <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-60" />}
    </Link>
  )
}

function SidebarContent({ userRole, onLinkClick }: { userRole?: string; onLinkClick?: () => void }) {
  const isAdmin = userRole === 'ADMIN'

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-indigo-900/40">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 shadow-sm">
          <Home className="h-4 w-4 text-white" />
        </div>
        <div>
          <span className="text-base font-bold text-white leading-none">FlatMate</span>
          <p className="text-[10px] text-indigo-300 leading-tight mt-0.5">WG-Verwaltung</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-indigo-400/70">Navigation</p>
        {mainNavItems.map((item) => (
          <NavLink key={item.href} item={item} onClick={onLinkClick} />
        ))}

        {isAdmin && (
          <div className="pt-4 pb-2">
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-indigo-400/70">Administration</p>
            {adminNavItems.map((item) => (
              <NavLink key={item.href} item={item} onClick={onLinkClick} />
            ))}
          </div>
        )}
      </nav>

      <div className="px-4 py-3 border-t border-indigo-900/40">
        <p className="text-[11px] text-indigo-400/60 text-center">WG-Verwaltung leicht gemacht</p>
      </div>
    </div>
  )
}

export function Sidebar({ userRole }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:shrink-0 bg-[var(--sidebar-bg)] h-full">
        <SidebarContent userRole={userRole} />
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-[var(--sidebar-bg)] transition-transform duration-300 ease-in-out lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-indigo-900/40">
          <span className="text-base font-bold text-white">FlatMate</span>
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-md p-1.5 text-indigo-300 hover:bg-indigo-900/50 hover:text-white transition-colors"
            aria-label="Menü schließen"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <SidebarContent userRole={userRole} onLinkClick={() => setMobileOpen(false)} />
      </aside>

      <button
        id="sidebar-mobile-toggle"
        onClick={() => setMobileOpen((v) => !v)}
        className="hidden"
        aria-label="Menü öffnen"
      >
        <Menu className="h-5 w-5" />
      </button>
    </>
  )
}

export function MobileSidebarToggle() {
  return (
    <button
      onClick={() => { document.getElementById('sidebar-mobile-toggle')?.click() }}
      className="inline-flex items-center justify-center rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors lg:hidden"
      aria-label="Menü öffnen"
    >
      <Menu className="h-5 w-5" />
    </button>
  )
}
