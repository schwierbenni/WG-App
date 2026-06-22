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
import { ChevronLeft, ChevronRight, RefreshCw, CalendarPlus, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { ICalImportDialog } from '@/components/ical-import-dialog'
import { CreateEventDialog, CreatedWGEvent } from '@/components/create-event-dialog'
import { useSession } from 'next-auth/react'

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

interface ICalEvent {
  id: string
  title: string
  description: string | null
  startDate: string
  endDate: string | null
  allDay: boolean
  calendar: {
    id: string
    name: string
    color: string
    emoji: string
  }
}

interface WGEvent {
  id: string
  wgId: string
  title: string
  description: string | null
  startDate: string
  endDate: string | null
  allDay: boolean
  color: string
  emoji: string
  notifyWG: boolean
  createdBy: string
  creator: { id: string; name: string }
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
  const { data: session } = useSession()
  const [currentMonth, setCurrentMonth] = React.useState(new Date())
  const [assignments, setAssignments] = React.useState<Assignment[]>([])
  const [icalEvents, setIcalEvents] = React.useState<ICalEvent[]>([])
  const [wgEvents, setWgEvents] = React.useState<WGEvent[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [selectedDay, setSelectedDay] = React.useState<Date | null>(null)
  const [importOpen, setImportOpen] = React.useState(false)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)

  const fetchData = React.useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [assignRes, icalRes, wgEventsRes] = await Promise.all([
        fetch('/api/assignments'),
        fetch('/api/ical/events'),
        fetch('/api/calendar/events'),
      ])
      if (!assignRes.ok) throw new Error('Fehler beim Laden der Zuweisungen')
      const assignData = await assignRes.json()
      setAssignments(assignData.assignments ?? [])
      if (icalRes.ok) {
        const icalData = await icalRes.json()
        setIcalEvents(icalData.events ?? [])
      }
      if (wgEventsRes.ok) {
        const wgData = await wgEventsRes.json()
        setWgEvents(wgData.events ?? [])
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

  async function handleDeleteWgEvent(id: string) {
    setDeletingId(id)
    try {
      await fetch(`/api/calendar/events/${id}`, { method: 'DELETE' })
      setWgEvents((prev) => prev.filter((e) => e.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  function handleEventCreated(event: CreatedWGEvent) {
    setWgEvents((prev) => [...prev, event as WGEvent])
  }

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

  const icalEventsByDay = React.useMemo(() => {
    const map = new Map<string, ICalEvent[]>()
    for (const e of icalEvents) {
      const key = format(new Date(e.startDate), 'yyyy-MM-dd')
      const existing = map.get(key) ?? []
      existing.push(e)
      map.set(key, existing)
    }
    return map
  }, [icalEvents])

  const wgEventsByDay = React.useMemo(() => {
    const map = new Map<string, WGEvent[]>()
    for (const e of wgEvents) {
      const key = format(new Date(e.startDate), 'yyyy-MM-dd')
      const existing = map.get(key) ?? []
      existing.push(e)
      map.set(key, existing)
    }
    return map
  }, [wgEvents])

  const selectedDayAssignments = React.useMemo(() => {
    if (!selectedDay) return []
    const key = format(selectedDay, 'yyyy-MM-dd')
    return assignmentsByDay.get(key) ?? []
  }, [selectedDay, assignmentsByDay])

  const selectedDayIcalEvents = React.useMemo(() => {
    if (!selectedDay) return []
    const key = format(selectedDay, 'yyyy-MM-dd')
    return icalEventsByDay.get(key) ?? []
  }, [selectedDay, icalEventsByDay])

  const selectedDayWgEvents = React.useMemo(() => {
    if (!selectedDay) return []
    const key = format(selectedDay, 'yyyy-MM-dd')
    return wgEventsByDay.get(key) ?? []
  }, [selectedDay, wgEventsByDay])

  const uniqueCalendars = React.useMemo(() => {
    const seen = new Map<string, ICalEvent['calendar']>()
    for (const e of icalEvents) {
      if (!seen.has(e.calendar.id)) seen.set(e.calendar.id, e.calendar)
    }
    return Array.from(seen.values())
  }, [icalEvents])

  const weekDays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kalender</h1>
          <p className="text-sm text-gray-500 mt-1">Dienste und Fälligkeiten im Überblick</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <CalendarPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Kalender importieren</span>
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Ereignis erstellen</span>
          </Button>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            <span className="hidden sm:inline">Aktualisieren</span>
          </Button>
        </div>
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
        {uniqueCalendars.map((cal) => (
          <div key={cal.id} className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cal.color }} />
            <span className="text-gray-500">{cal.emoji} {cal.name}</span>
          </div>
        ))}
        {wgEvents.length > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
            <span className="text-gray-500">WG-Ereignisse</span>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 overflow-hidden">
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
                  const dayIcalEvents = icalEventsByDay.get(key) ?? []
                  const dayWgEvents = wgEventsByDay.get(key) ?? []
                  const isCurrentMonth = isSameMonth(day, currentMonth)
                  const isSelected = selectedDay ? isSameDay(day, selectedDay) : false
                  const today = isToday(day)
                  const totalEvents = dayAssignments.length + dayIcalEvents.length + dayWgEvents.length

                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedDay(isSameDay(day, selectedDay ?? new Date('invalid')) ? null : day)}
                      className={cn(
                        'bg-white p-1 min-h-[44px] sm:min-h-[64px] flex flex-col items-start transition-colors hover:bg-indigo-50 active:bg-indigo-50 text-left',
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
                      {day.getDate() === 1 && !today && (
                        <span className={cn(
                          'text-[9px] leading-none font-semibold uppercase tracking-wide -mt-0.5 mb-0.5',
                          isCurrentMonth ? 'text-indigo-500' : 'text-gray-300',
                        )}>
                          {format(day, 'MMM', { locale: de })}
                        </span>
                      )}

                      {totalEvents > 0 && (
                        <div className="flex flex-wrap gap-0.5 mt-0.5">
                          {dayAssignments.slice(0, 2).map((a) => {
                            const status = getStatus(a)
                            return (
                              <div
                                key={a.id}
                                className={cn('h-1.5 w-1.5 rounded-full', DOT_COLORS[status])}
                                title={a.duty.name}
                              />
                            )
                          })}
                          {dayIcalEvents.slice(0, 2).map((e) =>
                            e.title.toLowerCase().includes('gelber sack') ? (
                              <span key={e.id} className="text-[10px] leading-none" title={e.title}>🗑️</span>
                            ) : (
                              <div
                                key={e.id}
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ backgroundColor: e.calendar.color }}
                                title={e.title}
                              />
                            )
                          )}
                          {dayWgEvents.slice(0, 2).map((e) => (
                            <div
                              key={e.id}
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: e.color }}
                              title={e.title}
                            />
                          ))}
                          {totalEvents > 4 && (
                            <span className="text-xs text-gray-400">
                              +{totalEvents - 4}
                            </span>
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
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">
                {selectedDay
                  ? format(selectedDay, 'EEEE, d. MMMM', { locale: de })
                  : 'Tag auswählen'}
              </h2>
              {selectedDay && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Neu
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedDay ? (
              <p className="text-sm text-gray-400 py-4 text-center">
                Klicke auf einen Tag um Details zu sehen
              </p>
            ) : selectedDayAssignments.length === 0 && selectedDayIcalEvents.length === 0 && selectedDayWgEvents.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">
                Keine Einträge an diesem Tag
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

                {selectedDayIcalEvents.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-lg border p-3 space-y-1"
                    style={{
                      backgroundColor: event.calendar.color + '18',
                      borderColor: event.calendar.color + '44',
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-base leading-none">{event.calendar.emoji}</span>
                      <span className="text-sm font-semibold" style={{ color: event.calendar.color }}>
                        {event.title}
                      </span>
                    </div>
                    {event.description && (
                      <p className="text-xs text-gray-500 line-clamp-2">{event.description}</p>
                    )}
                    <p className="text-xs text-gray-400">{event.calendar.name}</p>
                  </div>
                ))}

                {selectedDayWgEvents.map((event) => {
                  const canDelete =
                    session?.user?.id === event.createdBy ||
                    (session?.user as { role?: string })?.role === 'ADMIN'
                  return (
                    <div
                      key={event.id}
                      className="rounded-lg border p-3 space-y-1"
                      style={{
                        backgroundColor: event.color + '18',
                        borderColor: event.color + '44',
                      }}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-base leading-none flex-shrink-0">{event.emoji}</span>
                          <span className="text-sm font-semibold truncate" style={{ color: event.color }}>
                            {event.title}
                          </span>
                        </div>
                        {canDelete && (
                          <button
                            onClick={() => handleDeleteWgEvent(event.id)}
                            disabled={deletingId === event.id}
                            className="text-gray-300 hover:text-red-400 transition-colors disabled:opacity-40 flex-shrink-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      {event.description && (
                        <p className="text-xs text-gray-500 line-clamp-2">{event.description}</p>
                      )}
                      <p className="text-xs text-gray-400">von {event.creator.name}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ICalImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={fetchData}
      />

      <CreateEventDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleEventCreated}
        initialDate={selectedDay}
      />
    </div>
  )
}
