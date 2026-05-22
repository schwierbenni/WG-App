import { Suspense } from 'react'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { DutyCard } from '@/components/dashboard/duty-card'
import { AssignmentOverview } from '@/components/dashboard/assignment-overview'
import { formatDate } from '@/lib/utils'
import {
  ClipboardList, Megaphone, ArrowLeftRight, AlertCircle,
  User, ShoppingCart, Wallet, Calendar, Receipt,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface SimpleUser {
  id: string
  name: string
  email: string
  avatarUrl?: string | null
}

interface DutyAssignment {
  id: string
  dueDate: string
  completedAt: string | null
  duty: {
    id: string
    name: string
    emoji: string | null
    color: string
    checklistItems: string[]
  }
  user: SimpleUser
}

interface Announcement {
  id: string
  content: string
  createdAt: string
  author: SimpleUser
}

interface SwapRequest {
  id: string
  status: string
  createdAt: string
  fromUser: SimpleUser
  assignment: {
    id: string
    dueDate: string
    duty: { id: string; name: string; emoji: string | null }
  }
}

interface ShoppingItem {
  id: string
  name: string
  boughtAt: string | null
}

interface Expense {
  id: string
  amount: number
  description: string
  paidBy: string
  splitWith: string[]
  date: string
  paidByUser: SimpleUser
}

interface NetSettlement {
  fromUserId: string
  fromUserName: string
  toUserId: string
  toUserName: string
  amount: number
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

async function fetchMyAssignments(cookie: string): Promise<DutyAssignment[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/assignments?userId=me&limit=20`, { headers: { cookie }, cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json()
    return data.assignments ?? []
  } catch { return [] }
}

async function fetchAllAssignments(cookie: string): Promise<DutyAssignment[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/assignments?limit=50`, { headers: { cookie }, cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json()
    return data.assignments ?? []
  } catch { return [] }
}

async function fetchAnnouncements(cookie: string): Promise<Announcement[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/announcements?limit=3`, { headers: { cookie }, cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json()
    return data.announcements ?? []
  } catch { return [] }
}

async function fetchPendingSwapRequests(cookie: string): Promise<SwapRequest[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/swap-requests?direction=received&status=PENDING`, { headers: { cookie }, cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json()
    return data.swapRequests ?? []
  } catch { return [] }
}

async function fetchMembers(cookie: string): Promise<SimpleUser[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/users`, { headers: { cookie }, cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json()
    return data.users ?? []
  } catch { return [] }
}

async function fetchShoppingItems(cookie: string): Promise<ShoppingItem[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/shopping`, { headers: { cookie }, cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json()
    return data.items ?? []
  } catch { return [] }
}

async function fetchExpenses(cookie: string): Promise<Expense[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/expenses`, { headers: { cookie }, cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json()
    return data.expenses ?? []
  } catch { return [] }
}

async function fetchSettlements(cookie: string): Promise<NetSettlement[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/expenses/settlements`, { headers: { cookie }, cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json()
    return data.settlements ?? []
  } catch { return [] }
}

function splitAssignments(assignments: DutyAssignment[]) {
  const now = new Date()
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const overdue: DutyAssignment[] = []
  const thisWeek: DutyAssignment[] = []
  const later: DutyAssignment[] = []
  const done: DutyAssignment[] = []

  for (const a of assignments) {
    if (a.completedAt) { done.push(a); continue }
    const due = new Date(a.dueDate)
    if (due < now) overdue.push(a)
    else if (due <= weekFromNow) thisWeek.push(a)
    else later.push(a)
  }
  return { overdue, thisWeek, later, done }
}

function computeMyBalance(settlements: NetSettlement[], userId: string): { iOwe: number; owedToMe: number } {
  const iOwe = settlements.filter((s) => s.fromUserId === userId).reduce((s, x) => s + x.amount, 0)
  const owedToMe = settlements.filter((s) => s.toUserId === userId).reduce((s, x) => s + x.amount, 0)
  return { iOwe, owedToMe }
}

function SectionHeader({
  icon: Icon,
  title,
  count,
  className = '',
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  count?: number
  className?: string
}) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <Icon className={`h-5 w-5 text-brand-600 ${className}`} />
      <h2
        className="text-base font-bold text-foreground"
        style={{ fontFamily: 'var(--font-syne, system-ui)' }}
      >
        {title}
      </h2>
      {count !== undefined && (
        <span className="ml-auto text-xs font-medium text-[var(--text-subtle)]">
          {count} {count === 1 ? 'Eintrag' : 'Einträge'}
        </span>
      )}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-surface-border p-6 text-center">
      <p className="text-sm text-[var(--text-muted)]">{message}</p>
    </div>
  )
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const cookieHeader = cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join('; ')

  const [
    myAssignments, allAssignments, announcements,
    swapRequests, members, shoppingItems, expenses, debtSettlements,
  ] = await Promise.all([
    fetchMyAssignments(cookieHeader),
    fetchAllAssignments(cookieHeader),
    fetchAnnouncements(cookieHeader),
    fetchPendingSwapRequests(cookieHeader),
    fetchMembers(cookieHeader),
    fetchShoppingItems(cookieHeader),
    fetchExpenses(cookieHeader),
    fetchSettlements(cookieHeader),
  ])

  const { overdue, thisWeek, later } = splitAssignments(myAssignments)
  const pendingMyAssignments = [...overdue, ...thisWeek, ...later]

  const openShoppingItems = shoppingItems.filter((i) => !i.boughtAt).length
  const { iOwe, owedToMe } = computeMyBalance(debtSettlements, session.user.id)
  const myBalance = owedToMe - iOwe

  const upcomingAll = allAssignments
    .filter((a) => !a.completedAt && new Date(a.dueDate) >= new Date())
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 5)

  const userName = session.user.name ?? 'Mitglied'
  const firstName = userName.split(' ')[0]
  const userId = session.user.id

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Guten Morgen' : hour < 18 ? 'Guten Tag' : 'Guten Abend'

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* ── Greeting header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1
            className="text-2xl sm:text-3xl font-extrabold text-foreground"
            style={{ fontFamily: 'var(--font-syne, system-ui)' }}
          >
            {greeting}, {firstName}!
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {new Date().toLocaleDateString('de-DE', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
          </p>
        </div>

        {/* Status chips */}
        <div className="flex flex-wrap gap-2.5">
          {overdue.length > 0 && (
            <div className="rounded-2xl border-2 border-[color-mix(in_srgb,var(--danger)_30%,transparent)] bg-[var(--danger-bg)] px-4 py-2.5 text-center min-w-[72px]">
              <p className="text-xl font-extrabold text-[var(--danger)] leading-none">{overdue.length}</p>
              <p className="text-xs text-[var(--danger)] opacity-80 mt-0.5">Überfällig</p>
            </div>
          )}
          {thisWeek.length > 0 && (
            <div className="rounded-2xl border-2 border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[var(--warning-bg)] px-4 py-2.5 text-center min-w-[72px]">
              <p className="text-xl font-extrabold text-[var(--warning)] leading-none">{thisWeek.length}</p>
              <p className="text-xs text-[var(--warning)] opacity-80 mt-0.5">Diese Woche</p>
            </div>
          )}
          {swapRequests.length > 0 && (
            <div className="rounded-2xl border-2 border-[color-mix(in_srgb,var(--brand-600)_30%,transparent)] bg-brand-muted px-4 py-2.5 text-center min-w-[72px]">
              <p className="text-xl font-extrabold text-brand-600 leading-none">{swapRequests.length}</p>
              <p className="text-xs text-brand-600 opacity-80 mt-0.5">Tausch</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Quick-access: Shopping + Expenses ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link
          href="/shopping"
          className="group flex items-center gap-4 rounded-2xl border-2 border-surface-border bg-surface p-4 shadow-sm hover:border-brand-600 hover:shadow-md transition-all duration-200 active:scale-[0.98]"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--success-bg)] shrink-0">
            <ShoppingCart className="h-5 w-5 text-[var(--success)]" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground" style={{ fontFamily: 'var(--font-syne, system-ui)' }}>
              Einkaufsliste
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {openShoppingItems === 0
                ? 'Alles besorgt ✓'
                : `${openShoppingItems} Artikel ausstehend`}
            </p>
          </div>
          {openShoppingItems > 0 && (
            <span className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-[var(--success)] text-[11px] font-bold text-white shrink-0">
              {openShoppingItems}
            </span>
          )}
        </Link>

        <Link
          href="/expenses"
          className="group flex flex-col gap-2 rounded-2xl border-2 border-surface-border bg-surface p-4 shadow-sm hover:border-brand-600 hover:shadow-md transition-all duration-200 active:scale-[0.98]"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--info-bg)] shrink-0">
              <Wallet className="h-5 w-5 text-[var(--info)]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground" style={{ fontFamily: 'var(--font-syne, system-ui)' }}>
                WG-Kasse
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {myBalance === 0
                  ? 'Alles ausgeglichen'
                  : myBalance > 0
                    ? `Du bekommst ${myBalance.toFixed(2)} €`
                    : `Du schuldest ${Math.abs(myBalance).toFixed(2)} €`}
              </p>
            </div>
            {myBalance !== 0 && (
              <span className={`text-sm font-extrabold shrink-0 ${myBalance > 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                {myBalance > 0 ? '+' : ''}{myBalance.toFixed(2)} €
              </span>
            )}
          </div>
          {debtSettlements.length > 0 && (
            <div className="space-y-1 mt-1">
              {debtSettlements.filter((s) => s.fromUserId === userId || s.toUserId === userId).slice(0, 3).map((s) => {
                const isMyDebt = s.fromUserId === userId
                return (
                  <p key={`${s.fromUserId}-${s.toUserId}`} className={`text-xs ${isMyDebt ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}>
                    {isMyDebt
                      ? `Du schuldest ${s.toUserName} ${s.amount.toFixed(2)} €`
                      : `${s.fromUserName} schuldet dir ${s.amount.toFixed(2)} €`}
                  </p>
                )
              })}
            </div>
          )}
        </Link>
      </div>

      {/* ── Swap requests banner ── */}
      {swapRequests.length > 0 && (
        <div className="rounded-2xl border-2 border-[color-mix(in_srgb,var(--brand-600)_30%,transparent)] bg-brand-muted p-4">
          <div className="flex items-start gap-3">
            <ArrowLeftRight className="h-5 w-5 text-brand-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-brand-600" style={{ fontFamily: 'var(--font-syne, system-ui)' }}>
                {swapRequests.length}{' '}
                {swapRequests.length === 1 ? 'ausstehende Tauschangfrage' : 'ausstehende Tauschangfragen'}
              </p>
              <div className="mt-2 space-y-1">
                {swapRequests.slice(0, 3).map((req) => (
                  <p key={req.id} className="text-xs text-brand-600 opacity-80">
                    <span className="font-semibold">{req.fromUser.name}</span> möchte{' '}
                    {req.assignment.duty.emoji && <span className="mr-0.5">{req.assignment.duty.emoji}</span>}
                    <span className="font-semibold">{req.assignment.duty.name}</span> tauschen
                    (fällig: {formatDate(req.assignment.dueDate)})
                  </p>
                ))}
                {swapRequests.length > 3 && (
                  <p className="text-xs text-brand-600 opacity-60">und {swapRequests.length - 3} weitere…</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Left: My tasks + upcoming timeline */}
        <div className="xl:col-span-2 space-y-6">

          {/* My tasks */}
          <section>
            <SectionHeader icon={ClipboardList} title="Meine Aufgaben" count={pendingMyAssignments.length} />

            {pendingMyAssignments.length === 0 ? (
              <EmptyState message="Du hast aktuell keine offenen Aufgaben. Gut gemacht! 🎉" />
            ) : (
              <div className="space-y-5">
                {overdue.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[var(--danger)] mb-2.5 flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Überfällig ({overdue.length})
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {overdue.map((a) => <DutyCard key={a.id} assignment={a} members={members} />)}
                    </div>
                  </div>
                )}

                {thisWeek.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[var(--warning)] mb-2.5">
                      Diese Woche ({thisWeek.length})
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {thisWeek.map((a) => <DutyCard key={a.id} assignment={a} members={members} />)}
                    </div>
                  </div>
                )}

                {later.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-subtle)] mb-2.5">
                      Demnächst ({later.length})
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {later.map((a) => <DutyCard key={a.id} assignment={a} members={members} />)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Upcoming WG duties timeline */}
          {upcomingAll.length > 0 && (
            <section>
              <SectionHeader icon={Calendar} title="Nächste WG-Dienste" />
              <div className="rounded-2xl border-2 border-surface-border bg-surface overflow-hidden shadow-sm divide-y divide-surface-border">
                {upcomingAll.map((a) => {
                  const isMe = a.user.id === userId
                  const dueDate = new Date(a.dueDate)
                  const daysLeft = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                  return (
                    <div
                      key={a.id}
                      className={`flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-surface-muted ${isMe ? 'bg-brand-muted' : ''}`}
                    >
                      <span className="text-2xl shrink-0 leading-none">{a.duty.emoji ?? '📋'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {a.duty.name}
                          {isMe && (
                            <span className="ml-2 text-xs font-normal text-brand-600">(du)</span>
                          )}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">{a.user.name}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-semibold text-foreground">{formatDate(a.dueDate)}</p>
                        <p className={`text-[11px] font-medium ${daysLeft <= 2 ? 'text-[var(--danger)]' : daysLeft <= 7 ? 'text-[var(--warning)]' : 'text-[var(--text-subtle)]'}`}>
                          {daysLeft === 0 ? 'Heute' : daysLeft === 1 ? 'Morgen' : `in ${daysLeft} Tagen`}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </div>

        {/* Right: Announcements + Recent Expenses */}
        <div className="space-y-6">
          {/* Recent expenses */}
          {expenses.length > 0 && (
            <section>
              <SectionHeader icon={Receipt} title="Letzte Ausgaben" />
              <div className="rounded-2xl border-2 border-surface-border bg-surface overflow-hidden shadow-sm divide-y divide-surface-border">
                {expenses.slice(0, 5).map((e) => {
                  const isMyPayment = e.paidBy === userId
                  return (
                    <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{e.description}</p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {isMyPayment ? 'Du' : e.paidByUser.name} · {formatDate(e.date)}
                        </p>
                      </div>
                      <span className={`text-sm font-bold shrink-0 ${isMyPayment ? 'text-brand-600' : 'text-foreground'}`}>
                        {formatCurrency(e.amount)}
                      </span>
                    </div>
                  )
                })}
                <div className="px-4 py-2.5">
                  <Link href="/expenses" className="text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors">
                    Alle Ausgaben ansehen →
                  </Link>
                </div>
              </div>
            </section>
          )}

          <section>
            <SectionHeader icon={Megaphone} title="Ankündigungen" count={announcements.length} />

            {announcements.length === 0 ? (
              <EmptyState message="Keine Ankündigungen vorhanden." />
            ) : (
              <div className="space-y-3">
                {announcements.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-2xl border-2 border-surface-border bg-surface p-4 shadow-sm hover:border-brand-600 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 mb-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-muted shrink-0">
                        <User className="h-3.5 w-3.5 text-brand-600" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground" style={{ fontFamily: 'var(--font-syne, system-ui)' }}>
                          {a.author.name}
                        </p>
                        <p className="text-[10px] text-[var(--text-subtle)]">
                          {formatDate(a.createdAt, 'dd.MM.yyyy, HH:mm')}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-[var(--text-muted)] leading-relaxed line-clamp-4">
                      {a.content}
                    </p>
                  </div>
                ))}

                <Link
                  href="/announcements"
                  className="block text-center text-xs font-semibold text-brand-600 hover:text-brand-700 py-1 transition-colors"
                >
                  Alle Ankündigungen →
                </Link>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* ── All duties overview ── */}
      <section>
        <SectionHeader icon={ClipboardList} title="Alle Dienste – Übersicht" count={allAssignments.length} />
        <Suspense
          fallback={
            <div className="rounded-2xl border-2 border-surface-border bg-surface p-8 text-center text-sm text-[var(--text-muted)]">
              Lade Dienste…
            </div>
          }
        >
          <AssignmentOverview assignments={allAssignments} />
        </Suspense>
      </section>
    </div>
  )
}
