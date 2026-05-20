'use client'

import * as React from 'react'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  format,
  addMonths,
  subMonths,
  isPast,
} from 'date-fns'
import { de } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface Assignment {
  id: string
  dueDate: string
  completedAt: string | null
  user: {
    id: string
    name: string
  }
  duty: {
    id: string
    name: string
    emoji: string | null
    color: string
  }
}

type AssignmentStatus = 'offen' | 'erledigt' | 'überfällig'

function getStatus(assignment: Assignment): AssignmentStatus {
  if (assignment.completedAt) return 'erledigt'
  if (isPast(new Date(assignment.dueDate))) return 'überfällig'
  return 'offen'
}

const STATUS_COLORS: Record<AssignmentStatus, string> = {
  offen: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  erledigt: 'bg-green-100 text-green-800 border-green-200',
  überfällig: 'bg-red-100 text-red-800 border-red-200',
}

const DOT_COLORS: Record<AssignmentStatus, string> = {
  offen: 'bg-yellow-400',
  erledigt: 'bg-green-500',
  überfällig: 'bg-red-500',
}

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = React.useState(new Date())
  const [assignments, setAssignments] = React.useState<Assignment[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [selectedDay, setSelectedDay] = React.useState<Date | null>(null)

  const fetchData = React.useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/assignments')
      if (!res.ok) throw new Error('Fehler beim Laden der Zumweisungen')
      const data = await res.json()
      setAssignments(data.assignments ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  const calendarDays = React.useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [currentMonth])

  const assignmentsByDay = React.useMemo(() => {
    const map = new Map<string, Assignment[]>()
    for (const a of assignments) {
      const key = format(new Date(a.dueDate), 'yyyy-MM-dd')
      const existing = map.get(key) ?? []
      existing.push(a)
      map.set(key, existing)
    }
    return map
  }, [assignments])

  const selectedDayAssignments = React.useMemo(() => {
    if (!selectedDay) return []
    const key = format(selectedDay, 'yyyy-MM-dd')
    return assignmentsByDay.get(key) ?? []
  }, [selectedDay, assignmentsByDay])

  const weekDays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kalender</h1>
          <p className="text-sm text-gray-500 mt-1">Dienste und Fälligkeiten im Überblick</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          <span className="hidden sm:inline">Aktualisieren</span>
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
          <span className="text-gray-500">Offen</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
          <span className="text-gray-500">Erledigt</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
          <span className="text-gray-500">Überfällig</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 capitalize">
                {format(currentMonth, 'MMMM yyyy', { locale: de })}
              </h2>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() => setCurrentMonth(new Date())}
                >
                  Heute
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 mb-1">
              {weekDays.map((day) => (
                <div
                  key={day}
                  className="py-2 text-center text-xs font-semibold text-gray-400 uppercase"
                >
                  {day}
                </div>
              ))}
            </div>

            {loading ? (
              <div className="grid grid-cols-7 gap-px">
                {Array.from({ length: 35 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square rounded" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden border border-gray-200">
                {calendarDays.map((day) => {
                  const key = format(day, 'yyyy-MM-dd')
                  const dayAssignments = assignmentsByDay.get(key) ?? []
                  const isCurrentMonth = isSameMonth(day, currentMonth)
                  const isSelected = selectedDay ? isSameDay(day, selectedDay) : false
                  const today = isToday(day)

                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedDay(isSameDay(day, selectedDay ?? new Date('invalid')) ? null : day)}
                      className={cn(
                        'bg-white p-1.5 min-h-[60px] sm:min-h-[72px] flex flex-col items-start transition-colors hover:bg-indigo-50 text-left',
                        !isCurrentMonth && 'bg-gray-50',
                        isSelected && 'bg-indigo-50 ring-2 ring-indigo-400 ring-inset z-10',
                      )}
                    >
                      <span
                        className={cn(
                          'text-xs sm:text-sm font-medium leading-none mb-1',
                          isCurrentMonth ? 'text-gray-900' : 'text-gray-300',
                          today && 'flex items-center justify-center h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-indigo-600 text-white font-bold',
                        )}
                      >
                        {format(day, 'd')}
                      </span>

                      {dayAssignments.length > 0 && (
                        <div className="flex flex-wrap gap-0.5 mt-0.5">
                          {dayAssignments.slice(0, 3).map((a) => {
                            const status = getStatus(a)
                            return (
                              <div
                                key={a.id}
                                className={cn('h-1.5 w-1.5 rounded-full', DOT_COLORS[status])}
                                title={a.duty.name}
                              />
                            )
                          })}
                          {dayAssignments.length > 3 && (
                            <span className="text-xs text-gray-400">+{dayAssignments.length - 3}</span>
                          )}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <h2 className="text-base font-semibold text-gray-900">
              {selectedDay
                ? format(selectedDay, 'EEEE, d. MMMM', { locale: de })
                : 'Tag auswählen'}
            </h2>
          </CardHeader>
          <CardContent>
            {!selectedDay ? (
              <p className="text-sm text-gray-400 py-4 text-center">
                Klicke auf einen Tag um Details zu sehen
              </p>
            ) : selectedDayAssignments.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">
                Keine Dienste an diesem Tag
              </p>
            ) : (
              <div className="space-y-2">
                {selectedDayAssignments.map((assignment) => {
                  const status = getStatus(assignment)
                  return (
                    <div
                      key={assignment.id}
                      className={cn(
                        'rounded-lg border p-3 space-y-1',
                        STATUS_COLORS[status]
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        {assignment.duty.emoji && (
                          <span className="text-base leading-none">{assignment.duty.emoji}</span>
                        )}
                        <span className="text-sm font-semibold">{assignment.duty.name}</span>
                      </div>
                      <p className="text-xs opacity-80">
                        {assignment.user.name}
                      </p>
                      <Badge
                        className={cn('text-xs', STATUS_COLORS[status])}
                        variant="outline"
                      >
                        {status === 'erledigt' ? 'Erledigt' : status === 'überfällig' ? 'Überfällig' : 'Offen'}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
