import { Suspense } from 'react'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { DutyCard } from '@/components/dashboard/duty-card'
import { AssignmentOverview } from '@/components/dashboard/assignment-overview'
import { formatDate } from '@/lib/utils'
import {
  ClipboardList,
  Megaphone,
  ArrowLeftRight,
  AlertCircle,
  User,
  ShoppingCart,
  Wallet,
  Calendar,
} from 'lucide-react'

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
    duty: {
      id: string
      name: string
      emoji: string | null
    }
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

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

async function fetchMyAssignments(cookie: string): Promise<DutyAssignment[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/assignments?userId=me&limit=20`, {
      headers: { cookie },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.assignments ?? []
  } catch {
    return []
  }
}

async function fetchAllAssignments(cookie: string): Promise<DutyAssignment[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/assignments?limit=50`, {
      headers: { cookie },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.assignments ?? []
  } catch {
    return []
  }
}

async function fetchAnnouncements(cookie: string): Promise<Announcement[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/announcements?limit=3`, {
      headers: { cookie },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.announcements ?? []
  } catch {
    return []
  }
}

async function fetchPendingSwapRequests(cookie: string): Promise<SwapRequest[]> {
  try {
    const res = await fetch(
      `${BASE_URL}/api/swap-requests?direction=received&status=PENDING`,
      { headers: { cookie }, cache: 'no-store' },
    )
    if (!res.ok) return []
    const data = await res.json()
    return data.swapRequests ?? []
  } catch {
    return []
  }
}

async function fetchMembers(cookie: string): Promise<SimpleUser[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/users`, {
      headers: { cookie },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.users ?? []
  } catch {
    return []
  }
}

async function fetchShoppingItems(cookie: string): Promise<ShoppingItem[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/shopping`, {
      headers: { cookie },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.items ?? []
  } catch {
    return []
  }
}

async function fetchExpenses(cookie: string): Promise<Expense[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/expenses`, {
      headers: { cookie },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.expenses ?? []
  } catch {
    return []
  }
}

function splitAssignments(assignments: DutyAssignment[]) {
  const now = new Date()
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const overdue: DutyAssignment[] = []
  const thisWeek: DutyAssignment[] = []
  const later: DutyAssignment[] = []
  const done: DutyAssignment[] = []

  for (const a of assignments) {
    if (a.completedAt) {
      done.push(a)
      continue
    }
    const due = new Date(a.dueDate)
    if (due < now) {
      overdue.push(a)
    } else if (due <= weekFromNow) {
      thisWeek.push(a)
    } else {
      later.push(a)
    }
  }

  return { overdue, thisWeek, later, done }
}

function computeMyBalance(expenses: Expense[], userId: string): number {
  let balance = 0
  for (const e of expenses) {
    const share = e.amount / e.splitWith.length
    if (e.paidBy === userId) {
      // I paid — others owe me their shares
      balance += e.amount - share
    } else if (e.splitWith.includes(userId)) {
      // Someone else paid — I owe my share
      balance -= share
    }
  }
  return balance
}

function SectionHeader({
  icon: Icon,
  title,
  count,
  colorClass = 'text-gray-900 dark:text-gray-100',
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  count?: number
  colorClass?: string
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className={`h-5 w-5 ${colorClass}`} />
      <h2 className={`text-base font-semibold ${colorClass}`}>{title}</h2>
      {count !== undefined && (
        <span className="ml-auto text-xs font-medium text-gray-400 dark:text-gray-500">
          {count} {count === 1 ? 'Eintrag' : 'Einträge'}
        </span>
      )}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 p-6 text-center">
      <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
    </div>
  )
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ')

  const [
    myAssignments,
    allAssignments,
    announcements,
    swapRequests,
    members,
    shoppingItems,
    expenses,
  ] = await Promise.all([
    fetchMyAssignments(cookieHeader),
    fetchAllAssignments(cookieHeader),
    fetchAnnouncements(cookieHeader),
    fetchPendingSwapRequests(cookieHeader),
    fetchMembers(cookieHeader),
    fetchShoppingItems(cookieHeader),
    fetchExpenses(cookieHeader),
  ])

  const { overdue, thisWeek, later } = splitAssignments(myAssignments)
  const pendingMyAssignments = [...overdue, ...thisWeek, ...later]

  const openShoppingItems = shoppingItems.filter((i) => !i.boughtAt).length
  const myBalance = computeMyBalance(expenses, session.user.id)

  // Next 5 upcoming WG duties (excluding completed) sorted by dueDate
  const upcomingAll = allAssignments
    .filter((a) => !a.completedAt && new Date(a.dueDate) >= new Date())
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 5)

  const userName = session.user.name ?? 'Mitglied'
  const firstName = userName.split(' ')[0]
  const userId = session.user.id

  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Guten Morgen' : hour < 18 ? 'Guten Tag' : 'Guten Abend'

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {greeting}, {firstName}!
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {new Date().toLocaleDateString('de-DE', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {overdue.length > 0 && (
            <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-center">
              <p className="text-lg font-bold text-red-600 dark:text-red-400">{overdue.length}</p>
              <p className="text-xs text-red-500 dark:text-red-400">Überfällig</p>
            </div>
          )}
          {thisWeek.length > 0 && (
            <div className="rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-2 text-center">
              <p className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{thisWeek.length}</p>
              <p className="text-xs text-yellow-500 dark:text-yellow-400">Diese Woche</p>
            </div>
          )}
          {swapRequests.length > 0 && (
            <div className="rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-2 text-center">
              <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{swapRequests.length}</p>
              <p className="text-xs text-indigo-500 dark:text-indigo-400">Tauschfragen</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick-access cards: Shopping + Expenses */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/shopping"
          className="group flex items-center gap-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md transition-all"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40 shrink-0">
            <ShoppingCart className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Einkaufsliste</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {openShoppingItems === 0
                ? 'Alle Artikel besorgt'
                : `${openShoppingItems} ${openShoppingItems === 1 ? 'Artikel' : 'Artikel'} ausstehend`}
            </p>
          </div>
          {openShoppingItems > 0 && (
            <span className="ml-auto flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white shrink-0">
              {openShoppingItems}
            </span>
          )}
        </Link>

        <Link
          href="/expenses"
          className="group flex items-center gap-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md transition-all"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/40 shrink-0">
            <Wallet className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">WG-Kasse</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {myBalance === 0
                ? 'Alles ausgeglichen'
                : myBalance > 0
                  ? `Du bekommst ${myBalance.toFixed(2)} €`
                  : `Du schuldest ${Math.abs(myBalance).toFixed(2)} €`}
            </p>
          </div>
          {myBalance !== 0 && (
            <span
              className={`ml-auto text-xs font-bold shrink-0 ${myBalance > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
            >
              {myBalance > 0 ? '+' : ''}{myBalance.toFixed(2)} €
            </span>
          )}
        </Link>
      </div>

      {/* Pending swap requests banner */}
      {swapRequests.length > 0 && (
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 p-4">
          <div className="flex items-start gap-3">
            <ArrowLeftRight className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">
                {swapRequests.length}{' '}
                {swapRequests.length === 1
                  ? 'ausstehende Tauschangfrage'
                  : 'ausstehende Tauschangfragen'}
              </p>
              <div className="mt-2 space-y-1">
                {swapRequests.slice(0, 3).map((req) => (
                  <p key={req.id} className="text-xs text-indigo-600 dark:text-indigo-400">
                    <span className="font-medium">{req.fromUser.name}</span> möchte{' '}
                    {req.assignment.duty.emoji && (
                      <span className="mr-0.5">{req.assignment.duty.emoji}</span>
                    )}
                    <span className="font-medium">{req.assignment.duty.name}</span> tauschen
                    (fällig: {formatDate(req.assignment.dueDate)})
                  </p>
                ))}
                {swapRequests.length > 3 && (
                  <p className="text-xs text-indigo-500 dark:text-indigo-400">
                    und {swapRequests.length - 3} weitere…
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Left column: my tasks + upcoming WG timeline */}
        <div className="xl:col-span-2 space-y-8">
          {/* FA-30: Personal tasks */}
          <section>
            <SectionHeader
              icon={ClipboardList}
              title="Meine Aufgaben"
              count={pendingMyAssignments.length}
            />

            {pendingMyAssignments.length === 0 ? (
              <EmptyState message="Du hast aktuell keine offenen Aufgaben. Gut gemacht!" />
            ) : (
              <div className="space-y-6">
                {overdue.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-red-600 dark:text-red-400 mb-2 flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Überfällig ({overdue.length})
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {overdue.map((a) => (
                        <DutyCard key={a.id} assignment={a} members={members} />
                      ))}
                    </div>
                  </div>
                )}

                {thisWeek.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-yellow-600 dark:text-yellow-400 mb-2">
                      Diese Woche ({thisWeek.length})
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {thisWeek.map((a) => (
                        <DutyCard key={a.id} assignment={a} members={members} />
                      ))}
                    </div>
                  </div>
                )}

                {later.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                      Demnächst ({later.length})
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {later.map((a) => (
                        <DutyCard key={a.id} assignment={a} members={members} />
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
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden shadow-sm divide-y divide-gray-100 dark:divide-gray-700">
                {upcomingAll.map((a) => {
                  const isMe = a.user.id === userId
                  const dueDate = new Date(a.dueDate)
                  const daysLeft = Math.ceil(
                    (dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
                  )
                  return (
                    <div
                      key={a.id}
                      className={`flex items-center gap-3 px-4 py-3 ${isMe ? 'bg-indigo-50/40 dark:bg-indigo-900/10' : ''}`}
                    >
                      <span className="text-xl shrink-0 leading-none">
                        {a.duty.emoji ?? '📋'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {a.duty.name}
                          {isMe && (
                            <span className="ml-1.5 text-xs font-normal text-indigo-500 dark:text-indigo-400">
                              (du)
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{a.user.name}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          {formatDate(a.dueDate)}
                        </p>
                        <p
                          className={`text-[10px] ${daysLeft <= 2 ? 'text-red-500' : daysLeft <= 7 ? 'text-yellow-500' : 'text-gray-400'}`}
                        >
                          {daysLeft === 0
                            ? 'Heute'
                            : daysLeft === 1
                              ? 'Morgen'
                              : `in ${daysLeft} Tagen`}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </div>

        {/* Right column: announcements */}
        <div className="space-y-6">
          {/* FA-51: Schwarzes Brett */}
          <section>
            <SectionHeader icon={Megaphone} title="Ankündigungen" count={announcements.length} />

            {announcements.length === 0 ? (
              <EmptyState message="Keine Ankündigungen vorhanden." />
            ) : (
              <div className="space-y-3">
                {announcements.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-sm"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/50">
                        <User className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                          {a.author.name}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {formatDate(a.createdAt, 'dd.MM.yyyy, HH:mm')}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed line-clamp-4">
                      {a.content}
                    </p>
                  </div>
                ))}

                <Link
                  href="/announcements"
                  className="block text-center text-xs text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 font-medium py-1 transition-colors"
                >
                  Alle Ankündigungen ansehen →
                </Link>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* FA-31: All duties overview */}
      <section>
        <SectionHeader
          icon={ClipboardList}
          title="Alle Dienste – Übersicht"
          count={allAssignments.length}
        />
        <Suspense
          fallback={
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 text-center text-sm text-gray-400">
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
