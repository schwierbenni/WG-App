'use client'

import * as React from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  User,
  UserPlus,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { SwapDialog } from '@/components/duties/swap-dialog'
import { SwapResponseModal } from '@/components/duties/swap-response-modal'
import { cn, formatDate, getInitials, getIntervalLabel, getWeekdayLabel } from '@/lib/utils'

function SwapDeepLink({ onSuccess }: { onSuccess: () => void }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const swapId = searchParams.get('swap')

  if (!swapId) return null

  const close = () => router.replace('/duties')

  return (
    <SwapResponseModal
      swapId={swapId}
      onClose={close}
      onSuccess={() => { close(); onSuccess() }}
    />
  )
}

interface SimpleUser {
  id: string
  name: string
  email: string
  avatarUrl: string | null
}

interface Assignment {
  id: string
  dueDate: string
  completedAt: string | null
  completedBy: string | null
  user: SimpleUser
}

interface DutyWithAssignment {
  id: string
  name: string
  description: string | null
  emoji: string | null
  color: string
  rotationInterval: string
  dueWeekday: number | null
  isPaused: boolean
  assignments: Assignment[]
}

type FilterTab = 'all' | 'offen' | 'erledigt' | 'überfällig'

function getDutyStatus(assignment: Assignment | undefined): 'offen' | 'erledigt' | 'überfällig' {
  if (!assignment) return 'offen'
  if (assignment.completedAt) return 'erledigt'
  const due = new Date(assignment.dueDate)
  if (due < new Date()) return 'überfällig'
  return 'offen'
}

function StatusBadge({ status }: { status: 'offen' | 'erledigt' | 'überfällig' }) {
  if (status === 'erledigt') {
    return (
      <Badge className="bg-green-100 text-green-800 border-green-200">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Erledigt
      </Badge>
    )
  }
  if (status === 'überfällig') {
    return (
      <Badge className="bg-red-100 text-red-800 border-red-200">
        <AlertCircle className="h-3 w-3 mr-1" />
        Überfällig
      </Badge>
    )
  }
  return (
    <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
      <Clock className="h-3 w-3 mr-1" />
      Offen
    </Badge>
  )
}

interface AssignDialogState {
  duty: DutyWithAssignment
}

interface PendingOutSwap {
  assignmentId: string
  toUser: { name: string; avatarUrl?: string | null }
}

export default function DutiesPage() {
  const { data: session } = useSession()
  const [duties, setDuties] = React.useState<DutyWithAssignment[]>([])
  const [members, setMembers] = React.useState<SimpleUser[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [filter, setFilter] = React.useState<FilterTab>('all')
  const [completing, setCompleting] = React.useState<string | null>(null)
  const [assignDialog, setAssignDialog] = React.useState<AssignDialogState | null>(null)
  const [assignUserId, setAssignUserId] = React.useState('')
  const [assignDueDate, setAssignDueDate] = React.useState('')
  const [assigning, setAssigning] = React.useState(false)
  const [assignError, setAssignError] = React.useState('')
  const [pendingOut, setPendingOut] = React.useState<PendingOutSwap[]>([])

  const fetchData = React.useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [dutiesRes, usersRes, swapsRes] = await Promise.all([
        fetch('/api/duties'),
        fetch('/api/users'),
        fetch('/api/swap-requests?direction=sent'),
      ])
      if (!dutiesRes.ok) throw new Error('Fehler beim Laden der Dienste')
      if (!usersRes.ok) throw new Error('Fehler beim Laden der Mitglieder')
      const dutiesData = await dutiesRes.json()
      const usersData = await usersRes.json()
      setDuties(dutiesData.duties ?? [])
      setMembers(usersData.users ?? [])
      if (swapsRes.ok) {
        const swapsData = await swapsRes.json()
        setPendingOut(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (swapsData.swapRequests as any[])
            .filter((r) => r.status === 'PENDING')
            .map((r) => ({ assignmentId: r.assignment.id, toUser: r.toUser }))
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleComplete(assignmentId: string) {
    setCompleting(assignmentId)
    try {
      const res = await fetch(`/api/assignments/${assignmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete' }),
      })
      if (res.ok) await fetchData()
    } finally {
      setCompleting(null)
    }
  }

  async function handleUncomplete(assignmentId: string) {
    setCompleting(assignmentId)
    try {
      const res = await fetch(`/api/assignments/${assignmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'uncomplete' }),
      })
      if (res.ok) await fetchData()
    } finally {
      setCompleting(null)
    }
  }

  function openAssignDialog(duty: DutyWithAssignment) {
    const defaultDate = new Date()
    defaultDate.setDate(defaultDate.getDate() + 7)
    setAssignUserId('')
    setAssignDueDate(defaultDate.toISOString().slice(0, 10))
    setAssignError('')
    setAssignDialog({ duty })
  }

  async function handleAssign() {
    if (!assignDialog || !assignUserId || !assignDueDate) return
    setAssigning(true)
    setAssignError('')
    try {
      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dutyId: assignDialog.duty.id,
          userId: assignUserId,
          dueDate: new Date(assignDueDate).toISOString(),
        }),
      })
      if (res.ok) {
        setAssignDialog(null)
        await fetchData()
      } else {
        const data = await res.json()
        setAssignError(data.error ?? 'Fehler beim Zuweisen')
      }
    } finally {
      setAssigning(false)
    }
  }

  const filtered = React.useMemo(() => {
    if (filter === 'all') return duties
    return duties.filter((duty) => {
      const assignment = duty.assignments[0]
      const status = getDutyStatus(assignment)
      return status === filter
    })
  }, [duties, filter])

  const counts = React.useMemo(() => {
    const all = duties.length
    const offen = duties.filter((d) => getDutyStatus(d.assignments[0]) === 'offen').length
    const erledigt = duties.filter((d) => getDutyStatus(d.assignments[0]) === 'erledigt').length
    const überfällig = duties.filter((d) => getDutyStatus(d.assignments[0]) === 'überfällig').length
    return { all, offen, erledigt, überfällig }
  }, [duties])

  const isAdmin = (session?.user as { role?: string })?.role === 'ADMIN'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dienste</h1>
          <p className="text-sm text-gray-500 mt-1">Übersicht aller WG-Dienste und Zuweisungen</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          <span className="hidden sm:inline">Aktualisieren</span>
        </Button>
      </div>

      {/* Horizontal-scrollable filter tabs on mobile */}
      <div className="overflow-x-auto [scrollbar-width:none] [-webkit-overflow-scrolling:touch] -mx-4 px-4 sm:mx-0 sm:px-0">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterTab)}>
          <TabsList className="inline-flex w-auto min-w-full sm:min-w-0">
            <TabsTrigger value="all" className="min-h-[44px]">
              Alle <span className="ml-1.5 text-xs font-semibold">{counts.all}</span>
            </TabsTrigger>
            <TabsTrigger value="offen" className="min-h-[44px]">
              Offen <span className="ml-1.5 text-xs font-semibold">{counts.offen}</span>
            </TabsTrigger>
            <TabsTrigger value="erledigt" className="min-h-[44px]">
              Erledigt <span className="ml-1.5 text-xs font-semibold">{counts.erledigt}</span>
            </TabsTrigger>
            <TabsTrigger value="überfällig" className="min-h-[44px]">
              Überfällig <span className="ml-1.5 text-xs font-semibold text-red-600">{counts.überfällig}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 [@media(min-width:520px)]:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-8 w-28" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-16 text-center">
          <p className="text-gray-500 font-medium">Keine Dienste gefunden</p>
          <p className="text-sm text-gray-400 mt-1">
            {filter !== 'all'
              ? 'Keine Dienste in dieser Kategorie'
              : 'Es wurden noch keine Dienste angelegt'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 [@media(min-width:520px)]:grid-cols-2 lg:grid-cols-3">
          {filtered.map((duty) => {
            const assignment = duty.assignments[0]
            const status = getDutyStatus(assignment)
            const isMyAssignment = assignment?.user?.id === session?.user?.id
            const canComplete = assignment && !assignment.completedAt && (isMyAssignment || isAdmin)
            const canUncomplete =
              assignment?.completedAt &&
              (isAdmin || assignment.completedBy === session?.user?.id)
            const pendingSwap = assignment
              ? pendingOut.find((p) => p.assignmentId === assignment.id) ?? null
              : null

            return (
              <Card
                key={duty.id}
                className={cn(
                  'transition-shadow hover:shadow-md',
                  status === 'überfällig' && 'border-red-400 bg-red-50 dark:bg-red-950/20',
                  status === 'erledigt' && 'border-green-200',
                  duty.isPaused && 'opacity-60'
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {duty.emoji ? (
                        <span className="text-2xl leading-none shrink-0">{duty.emoji}</span>
                      ) : (
                        <div
                          className="h-8 w-8 rounded-full shrink-0"
                          style={{ backgroundColor: duty.color }}
                        />
                      )}
                      <CardTitle className="text-base truncate">{duty.name}</CardTitle>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <StatusBadge status={status} />
                      {duty.isPaused && (
                        <Badge variant="outline" className="text-xs">Pausiert</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {duty.description && (
                    <p className="text-sm text-gray-500 line-clamp-2">{duty.description}</p>
                  )}

                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="text-xs font-normal">
                      <RefreshCw className="h-3 w-3 mr-1" />
                      {getIntervalLabel(duty.rotationInterval)}
                    </Badge>
                    {getWeekdayLabel(duty.dueWeekday) && (
                      <Badge variant="outline" className="text-xs font-normal">
                        Stichtag: {getWeekdayLabel(duty.dueWeekday)}
                      </Badge>
                    )}
                  </div>

                  {assignment ? (
                    <div className="rounded-lg bg-gray-50 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          {assignment.user.avatarUrl && (
                            <AvatarImage src={assignment.user.avatarUrl} alt={assignment.user.name} />
                          )}
                          <AvatarFallback className="text-xs bg-indigo-100 text-indigo-700">
                            {getInitials(assignment.user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-700 truncate">
                            {assignment.user.name}
                            {isMyAssignment && (
                              <span className="ml-1 text-indigo-600">(Du)</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-400">
                            Fällig: {formatDate(assignment.dueDate)}
                          </p>
                        </div>
                      </div>

                      {isMyAssignment && !assignment.completedAt && (
                        pendingSwap ? (
                          <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                            <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-amber-800">Tauschangfrage ausstehend</p>
                              <p className="text-xs text-amber-600 truncate">
                                Gesendet an {pendingSwap.toUser.name}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <SwapDialog
                            assignmentId={assignment.id}
                            dutyName={duty.name}
                            dutyEmoji={duty.emoji}
                            dueDate={assignment.dueDate}
                            members={members}
                            onSuccess={fetchData}
                          />
                        )
                      )}

                      {canComplete && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleComplete(assignment.id)}
                          disabled={completing === assignment.id}
                          className="w-full gap-1.5 min-h-[44px] text-green-700 border-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 active:scale-95 transition-transform"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {completing === assignment.id ? 'Markiere…' : 'Als erledigt markieren'}
                        </Button>
                      )}

                      {canUncomplete && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleUncomplete(assignment.id)}
                          disabled={completing === assignment.id}
                          className="w-full gap-1.5 text-xs text-gray-500 hover:text-gray-700"
                        >
                          {completing === assignment.id ? 'Setze zurück…' : 'Erledigt rückgängig'}
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-3 text-xs text-gray-400">
                        <User className="h-4 w-4" />
                        Keine aktive Zuweisung
                      </div>
                      {!duty.isPaused && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openAssignDialog(duty)}
                          className="w-full gap-1.5 text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                        >
                          <UserPlus className="h-4 w-4" />
                          Mitglied zuweisen
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Swap response modal – opened via push notification deep-link (?swap=<id>) */}
      <React.Suspense>
        <SwapDeepLink onSuccess={fetchData} />
      </React.Suspense>

      {/* Assign duty dialog */}
      <Dialog open={!!assignDialog} onOpenChange={(open) => !open && setAssignDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {assignDialog?.duty.emoji && <span className="mr-2">{assignDialog.duty.emoji}</span>}
              {assignDialog?.duty.name} zuweisen
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="assign-user">Mitglied</Label>
              <Select
                id="assign-user"
                value={assignUserId}
                onChange={(e) => setAssignUserId(e.target.value)}
                placeholder="Mitglied auswählen…"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="assign-date">Fälligkeitsdatum</Label>
              <Input
                id="assign-date"
                type="date"
                value={assignDueDate}
                onChange={(e) => setAssignDueDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
              />
            </div>

            {assignError && (
              <p className="text-sm text-red-600">{assignError}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog(null)}>Abbrechen</Button>
            <Button
              onClick={handleAssign}
              disabled={assigning || !assignUserId || !assignDueDate}
            >
              {assigning ? 'Zuweisen…' : 'Zuweisen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
