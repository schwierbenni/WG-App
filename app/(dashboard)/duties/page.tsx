'use client'

import * as React from 'react'
import { useSession } from 'next-auth/react'
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  User,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SwapDialog } from '@/components/duties/swap-dialog'
import { cn, formatDate, getInitials, getIntervalLabel } from '@/lib/utils'

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
  user: SimpleUser
}

interface DutyWithAssignment {
  id: string
  name: string
  description: string | null
  emoji: string | null
  color: string
  rotationInterval: string
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

export default function DutiesPage() {
  const { data: session } = useSession()
  const [duties, setDuties] = React.useState<DutyWithAssignment[]>([])
  const [members, setMembers] = React.useState<SimpleUser[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [filter, setFilter] = React.useState<FilterTab>('all')

  const fetchData = React.useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [dutiesRes, usersRes] = await Promise.all([
        fetch('/api/duties'),
        fetch('/api/users'),
      ])
      if (!dutiesRes.ok) throw new Error('Fehler beim Laden der Dienste')
      if (!usersRes.ok) throw new Error('Fehler beim Laden der Mitglieder')
      const dutiesData = await dutiesRes.json()
      const usersData = await usersRes.json()
      setDuties(dutiesData.duties ?? [])
      setMembers(usersData.users ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

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

      <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterTab)}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="all">
            Alle <span className="ml-1.5 text-xs font-semibold">{counts.all}</span>
          </TabsTrigger>
          <TabsTrigger value="offen">
            Offen <span className="ml-1.5 text-xs font-semibold">{counts.offen}</span>
          </TabsTrigger>
          <TabsTrigger value="erledigt">
            Erledigt <span className="ml-1.5 text-xs font-semibold">{counts.erledigt}</span>
          </TabsTrigger>
          <TabsTrigger value="überfällig">
            Überfällig <span className="ml-1.5 text-xs font-semibold text-red-600">{counts.überfällig}</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((duty) => {
            const assignment = duty.assignments[0]
            const status = getDutyStatus(assignment)
            const isMyAssignment = assignment?.user?.id === session?.user?.id

            return (
              <Card
                key={duty.id}
                className={cn(
                  'transition-shadow hover:shadow-md',
                  status === 'überfällig' && 'border-red-200',
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
                        <SwapDialog
                          assignmentId={assignment.id}
                          dutyName={duty.name}
                          dutyEmoji={duty.emoji}
                          dueDate={assignment.dueDate}
                          members={members}
                          onSuccess={fetchData}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-3 text-xs text-gray-400">
                      <User className="h-4 w-4" />
                      Keine aktive Zuweisung
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
