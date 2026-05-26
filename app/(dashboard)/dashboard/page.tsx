import { Suspense } from 'react'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { DutyCard } from '@/components/dashboard/duty-card'
import { AssignmentOverview } from '@/components/dashboard/assignment-overview'
import { formatDate, formatCurrency } from '@/lib/utils'
import {
  ClipboardList, Megaphone, ArrowLeftRight, AlertCircle,
  ShoppingCart, Wallet, Calendar, Receipt,
} from 'lucide-react'
import { UserAvatar } from '@/components/ui/user-avatar'

// ─── settlement helper (mirrors /api/expenses/settlements) ───────────────────

function computeShareForExpense(
  expense: { amount: number; splitWith: string[]; splitMode: string; splits: unknown },
  userId: string,
): number {
  if (expense.splitMode === 'INDIVIDUAL') {
    const s = expense.splits as Record<string, number> | null
    return s?.[userId] ?? 0
  }
  if (expense.splitMode === 'PERCENTAGE') {
    const s = expense.splits as Record<string, number> | null
    return expense.amount * ((s?.[userId] ?? 0) / 100)
  }
  return expense.amount / expense.splitWith.length
}

function computeMyBalance(
  expenses: { paidBy: string; splitWith: string[]; amount: number; splitMode: string; splits: unknown }[],
  userId: string,
): { iOwe: number; owedToMe: number; net: number } {
  let iOwe = 0
  let owedToMe = 0
  for (const e of expenses) {
    if (e.paidBy === userId) {
      // Others owe me their shares
      for (const uid of e.splitWith) {
        if (uid !== userId) owedToMe += computeShareForExpense(e, uid)
      }
    } else if (e.splitWith.includes(userId)) {
      // I owe the payer my share
      iOwe += computeShareForExpense(e, userId)
    }
  }
  return { iOwe, owedToMe, net: owedToMe - iOwe }
}

// ─── shared sub-types ────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  count,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  count?: number
}) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <Icon className="h-5 w-5 text-brand-600" />
      <h2 className="text-base font-bold text-foreground" style={{ fontFamily: 'var(--font-syne, system-ui)' }}>
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

// ─── page ────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const userId = session.user.id
  const wgId = (session.user as { wgId?: string }).wgId
  if (!wgId) redirect('/login')

  const now = new Date()
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  // Fetch all data in parallel via Prisma (no internal HTTP round-trips)
  const [
    myAssignmentsRaw,
    allAssignmentsRaw,
    announcements,
    swapRequests,
    members,
    openShoppingCount,
    recentExpenses,
    unsettledExpenses,
  ] = await Promise.all([
    // My open assignments
    prisma.dutyAssignment.findMany({
      where: { wgId, userId, completedAt: null },
      include: {
        duty: { select: { id: true, name: true, emoji: true, color: true, checklistItems: true } },
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
      orderBy: { dueDate: 'asc' },
    }),
    // All open assignments for timeline + overview
    prisma.dutyAssignment.findMany({
      where: { wgId, completedAt: null },
      include: {
        duty: { select: { id: true, name: true, emoji: true, color: true, checklistItems: true } },
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: 50,
    }),
    // Recent announcements
    prisma.announcement.findMany({
      where: { wgId },
      include: { author: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
      take: 3,
    }),
    // Pending swap requests addressed to me
    prisma.swapRequest.findMany({
      where: { wgId, toUserId: userId, status: 'PENDING' },
      include: {
        fromUser: { select: { id: true, name: true, email: true, avatarUrl: true } },
        assignment: {
          include: { duty: { select: { id: true, name: true, emoji: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    // All WG members (needed for SwapDialog inside DutyCard)
    prisma.user.findMany({
      where: { wgId },
      select: { id: true, name: true, email: true, avatarUrl: true },
    }),
    // Open shopping items count
    prisma.shoppingItem.count({ where: { wgId, boughtAt: null } }),
    // Recent expenses
    prisma.expense.findMany({
      where: { wgId },
      include: { paidByUser: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      orderBy: { date: 'desc' },
      take: 5,
    }),
    // Unsettled expenses (for balance computation)
    prisma.expense.findMany({
      where: { wgId, settledAt: null },
      select: { paidBy: true, splitWith: true, amount: true, splitMode: true, splits: true },
    }),
  ])

  // ── Categorise my assignments ────────────────────────────────────────────
  const overdue: typeof myAssignmentsRaw = []
  const thisWeek: typeof myAssignmentsRaw = []
  const later: typeof myAssignmentsRaw = []

  for (const a of myAssignmentsRaw) {
    const due = new Date(a.dueDate)
    if (due < now) overdue.push(a)
    else if (due <= weekFromNow) thisWeek.push(a)
    else later.push(a)
  }

  const pendingMyAssignments = [...overdue, ...thisWeek, ...later]

  // ── Next 5 upcoming duties (whole WG) ───────────────────────────────────
  const upcomingAll = allAssignmentsRaw
    .filter((a) => new Date(a.dueDate) >= now)
    .slice(0, 5)

  // ── Balance ─────────────────────────────────────────────────────────────
  const { iOwe, owedToMe, net: myBalance } = computeMyBalance(unsettledExpenses, userId)

  // Compact debt lines for the WG-Kasse card (max 3)
  const memberNameMap = new Map(members.map((m) => [m.id, m.name]))

  // People who owe me (I paid, they're in splitWith)
  const owedToMeLines: { name: string; amount: number }[] = []
  // People I owe (they paid, I'm in splitWith)
  const iOweLines: { name: string; amount: number }[] = []

  {
    const toMe = new Map<string, number>()
    const fromMe = new Map<string, number>()

    for (const e of unsettledExpenses) {
      if (e.paidBy === userId) {
        for (const uid of e.splitWith) {
          if (uid !== userId) {
            toMe.set(uid, (toMe.get(uid) ?? 0) + computeShareForExpense(e, uid))
          }
        }
      } else if (e.splitWith.includes(userId)) {
        fromMe.set(e.paidBy, (fromMe.get(e.paidBy) ?? 0) + computeShareForExpense(e, userId))
      }
    }

    for (const [uid, amt] of toMe) {
      if (amt >= 0.01) owedToMeLines.push({ name: memberNameMap.get(uid) ?? uid, amount: amt })
    }
    for (const [uid, amt] of fromMe) {
      if (amt >= 0.01) iOweLines.push({ name: memberNameMap.get(uid) ?? uid, amount: amt })
    }
  }

  const allDebtLines = [
    ...iOweLines.map((l) => ({ text: `Du schuldest ${l.name} ${formatCurrency(l.amount)}`, negative: true })),
    ...owedToMeLines.map((l) => ({ text: `${l.name} schuldet dir ${formatCurrency(l.amount)}`, negative: false })),
  ].slice(0, 3)

  // ── Greeting ────────────────────────────────────────────────────────────
  const firstName = (session.user.name ?? 'Mitglied').split(' ')[0]
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Guten Morgen' : hour < 18 ? 'Guten Tag' : 'Guten Abend'

  // Serialise Date objects to strings for client components
  const allAssignments = allAssignmentsRaw.map((a) => ({
    ...a,
    dueDate: a.dueDate.toISOString(),
    completedAt: a.completedAt?.toISOString() ?? null,
  }))

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
            {now.toLocaleDateString('de-DE', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
          </p>
        </div>

        {/* Status chips – horizontal scroll on mobile, flex-wrap on desktop */}
        <div className="flex gap-2.5 overflow-x-auto pb-1 sm:pb-0 sm:flex-wrap [scrollbar-width:none] [-webkit-overflow-scrolling:touch]">
          {overdue.length > 0 && (
            <Link href="/duties" className="rounded-2xl border-2 border-[color-mix(in_srgb,var(--danger)_30%,transparent)] bg-[var(--danger-bg)] px-4 py-2.5 text-center min-w-[72px] shrink-0 hover:shadow-md transition-shadow active:scale-95">
              <p className="text-xl font-extrabold text-[var(--danger)] leading-none">{overdue.length}</p>
              <p className="text-xs text-[var(--danger)] opacity-80 mt-0.5 whitespace-nowrap">Überfällig</p>
            </Link>
          )}
          {thisWeek.length > 0 && (
            <Link href="/duties" className="rounded-2xl border-2 border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[var(--warning-bg)] px-4 py-2.5 text-center min-w-[72px] shrink-0 hover:shadow-md transition-shadow active:scale-95">
              <p className="text-xl font-extrabold text-[var(--warning)] leading-none">{thisWeek.length}</p>
              <p className="text-xs text-[var(--warning)] opacity-80 mt-0.5 whitespace-nowrap">Diese Woche</p>
            </Link>
          )}
          {swapRequests.length > 0 && (
            <Link href="/duties" className="rounded-2xl border-2 border-[color-mix(in_srgb,var(--brand-600)_30%,transparent)] bg-brand-muted px-4 py-2.5 text-center min-w-[72px] shrink-0 hover:shadow-md transition-shadow active:scale-95">
              <p className="text-xl font-extrabold text-brand-600 leading-none">{swapRequests.length}</p>
              <p className="text-xs text-brand-600 opacity-80 mt-0.5 whitespace-nowrap">Tausch</p>
            </Link>
          )}
        </div>
      </div>

      {/* ── WG Members – horizontally scrollable on mobile ── */}
      {members.length > 0 && (
        <div className="flex items-center gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [-webkit-overflow-scrolling:touch]">
          {members.map((m) => (
            <div key={m.id} className="flex shrink-0 flex-col items-center gap-1.5">
              <UserAvatar name={m.name} avatarUrl={m.avatarUrl} size="lg" />
              <span className="text-[11px] text-[var(--text-muted)] font-medium max-w-[56px] truncate text-center">
                {m.id === userId ? 'Du' : m.name.split(' ')[0]}
              </span>
            </div>
          ))}
        </div>
      )}

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
              {openShoppingCount === 0 ? 'Alles besorgt ✓' : `${openShoppingCount} Artikel ausstehend`}
            </p>
          </div>
          {openShoppingCount > 0 && (
            <span className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-[var(--success)] text-[11px] font-bold text-white shrink-0">
              {openShoppingCount}
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
                  ? `Du bekommst ${formatCurrency(owedToMe)}`
                  : `Du schuldest ${formatCurrency(iOwe)}`}
              </p>
            </div>
            {myBalance !== 0 && (
              <span className={`text-sm font-extrabold shrink-0 ${myBalance > 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                {myBalance > 0 ? '+' : ''}{formatCurrency(Math.abs(myBalance))}
              </span>
            )}
          </div>
          {allDebtLines.length > 0 && (
            <div className="space-y-1 mt-1">
              {allDebtLines.map((line, i) => (
                <p key={i} className={`text-xs ${line.negative ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}>
                  {line.text}
                </p>
              ))}
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
                {swapRequests.length === 1 ? '1 ausstehende Tauschangfrage' : `${swapRequests.length} ausstehende Tauschangfragen`}
              </p>
              <div className="mt-2 space-y-1">
                {swapRequests.slice(0, 3).map((req) => (
                  <Link
                    key={req.id}
                    href={`/duties?swap=${req.id}`}
                    className="block text-xs text-brand-600 opacity-80 hover:opacity-100 transition-opacity"
                  >
                    <UserAvatar name={req.fromUser.name} avatarUrl={req.fromUser.avatarUrl} size="xs" className="inline-flex mr-1 align-middle" />
                    <span className="font-semibold">{req.fromUser.name}</span> möchte{' '}
                    {req.assignment.duty.emoji && <span className="mr-0.5">{req.assignment.duty.emoji}</span>}
                    <span className="font-semibold">{req.assignment.duty.name}</span> tauschen
                    (fällig: {formatDate(req.assignment.dueDate.toISOString())})
                  </Link>
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
                    <div className="grid gap-3 [@media(min-width:480px)]:grid-cols-2">
                      {overdue.map((a) => (
                        <DutyCard
                          key={a.id}
                          assignment={{ ...a, dueDate: a.dueDate.toISOString(), completedAt: a.completedAt?.toISOString() ?? null }}
                          members={members}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {thisWeek.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[var(--warning)] mb-2.5">
                      Diese Woche ({thisWeek.length})
                    </p>
                    <div className="grid gap-3 [@media(min-width:480px)]:grid-cols-2">
                      {thisWeek.map((a) => (
                        <DutyCard
                          key={a.id}
                          assignment={{ ...a, dueDate: a.dueDate.toISOString(), completedAt: a.completedAt?.toISOString() ?? null }}
                          members={members}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {later.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-subtle)] mb-2.5">
                      Demnächst ({later.length})
                    </p>
                    <div className="grid gap-3 [@media(min-width:480px)]:grid-cols-2">
                      {later.map((a) => (
                        <DutyCard
                          key={a.id}
                          assignment={{ ...a, dueDate: a.dueDate.toISOString(), completedAt: a.completedAt?.toISOString() ?? null }}
                          members={members}
                        />
                      ))}
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
                  const daysLeft = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                  return (
                    <div
                      key={a.id}
                      className={`flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-surface-muted ${isMe ? 'bg-brand-muted' : ''}`}
                    >
                      <span className="text-2xl shrink-0 leading-none">{a.duty.emoji ?? '📋'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {a.duty.name}
                          {isMe && <span className="ml-2 text-xs font-normal text-brand-600">(du)</span>}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <UserAvatar name={a.user.name} avatarUrl={a.user.avatarUrl} size="xs" />
                          <p className="text-xs text-[var(--text-muted)]">{isMe ? 'Du' : a.user.name}</p>
                        </div>
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

        {/* Right column: announcements + recent expenses */}
        <div className="space-y-6">

          {/* Recent expenses */}
          {recentExpenses.length > 0 && (
            <section>
              <SectionHeader icon={Receipt} title="Letzte Ausgaben" />
              <div className="rounded-2xl border-2 border-surface-border bg-surface overflow-hidden shadow-sm divide-y divide-surface-border">
                {recentExpenses.map((e) => {
                  const isMyPayment = e.paidBy === userId
                  return (
                    <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                      <UserAvatar name={e.paidByUser.name} avatarUrl={e.paidByUser.avatarUrl} size="xs" className="shrink-0" />
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

          {/* Announcements */}
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
                      <UserAvatar name={a.author.name} avatarUrl={a.author.avatarUrl} size="sm" className="shrink-0" />
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
            <div className="rounded-2xl border-2 border-surface-border bg-surface overflow-hidden divide-y divide-surface-border">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="h-8 w-8 rounded-full bg-surface-muted animate-pulse shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-32 rounded bg-surface-muted animate-pulse" />
                    <div className="h-2.5 w-20 rounded bg-surface-muted animate-pulse" />
                  </div>
                  <div className="h-5 w-16 rounded-full bg-surface-muted animate-pulse" />
                </div>
              ))}
            </div>
          }
        >
          <AssignmentOverview assignments={allAssignments} />
        </Suspense>
      </section>
    </div>
  )
}
