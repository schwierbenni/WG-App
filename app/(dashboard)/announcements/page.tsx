'use client'

import * as React from 'react'
import { useSession } from 'next-auth/react'
import { ClipboardList, RefreshCw, Plus, Trash2, X, Calendar, User } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn, getInitials } from '@/lib/utils'

interface WGUser {
  id: string
  name: string
  avatarUrl: string | null
}

interface BulletinTask {
  id: string
  title: string | null
  content: string | null
  dueDate: string | null
  createdAt: string
  author: {
    id: string
    name: string
    avatarUrl: string | null
  }
  assignedUser: {
    id: string
    name: string
    avatarUrl: string | null
  } | null
}

type TaskStatus = 'overdue' | 'today' | 'upcoming'

function getTaskStatus(dueDate: string | null): TaskStatus {
  if (!dueDate) return 'upcoming'
  const due = new Date(dueDate)
  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(now)
  todayEnd.setHours(23, 59, 59, 999)
  if (due < todayStart) return 'overdue'
  if (due <= todayEnd) return 'today'
  return 'upcoming'
}

const STATUS_STYLES: Record<TaskStatus, { badge: string; border: string; dot: string; label: string }> = {
  overdue: {
    badge: 'bg-red-100 text-red-700 border-red-200',
    border: 'border-red-200',
    dot: 'bg-red-500',
    label: 'Überfällig',
  },
  today: {
    badge: 'bg-orange-100 text-orange-700 border-orange-200',
    border: 'border-orange-200',
    dot: 'bg-orange-400',
    label: 'Heute fällig',
  },
  upcoming: {
    badge: 'bg-blue-50 text-blue-700 border-blue-100',
    border: 'border-gray-200',
    dot: 'bg-blue-400',
    label: 'Offen',
  },
}

function formatDueDate(dueDate: string | null): string {
  if (!dueDate) return '–'
  return new Date(dueDate).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function AnnouncementsPage() {
  const { data: session } = useSession()
  const [tasks, setTasks] = React.useState<BulletinTask[]>([])
  const [users, setUsers] = React.useState<WGUser[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [showForm, setShowForm] = React.useState(false)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)

  const [title, setTitle] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [dueDate, setDueDate] = React.useState('')
  const [assignedUserId, setAssignedUserId] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [submitError, setSubmitError] = React.useState('')

  const fetchData = React.useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [tasksRes, usersRes] = await Promise.all([
        fetch('/api/announcements'),
        fetch('/api/users'),
      ])
      if (!tasksRes.ok) throw new Error('Fehler beim Laden')
      const tasksData = await tasksRes.json()
      setTasks(tasksData.announcements ?? [])
      if (usersRes.ok) {
        const usersData = await usersRes.json()
        setUsers(usersData.users ?? [])
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

  function openForm() {
    setTitle('')
    setDescription('')
    setDueDate('')
    setAssignedUserId('')
    setSubmitError('')
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setSubmitError('Bitte einen Titel eingeben'); return }
    if (!dueDate) { setSubmitError('Bitte einen Stichtag eingeben'); return }
    if (!assignedUserId) { setSubmitError('Bitte eine verantwortliche Person auswählen'); return }

    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          content: description.trim() || undefined,
          dueDate: new Date(`${dueDate}T00:00:00`).toISOString(),
          assignedUserId,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSubmitError(data.error ?? 'Fehler beim Erstellen')
      } else {
        setShowForm(false)
        fetchData()
      }
    } catch {
      setSubmitError('Netzwerkfehler. Bitte erneut versuchen.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await fetch(`/api/announcements/${id}`, { method: 'DELETE' })
      setTasks((prev) => prev.filter((t) => t.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  const canDelete = (task: BulletinTask) => {
    const userRole = (session?.user as { role?: string })?.role
    return task.author.id === session?.user?.id || userRole === 'ADMIN'
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Schwarzes Brett</h1>
          <p className="text-sm text-gray-500 mt-1">Aufgaben mit Stichtag und Verantwortlichkeit</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            <span className="hidden sm:inline">Aktualisieren</span>
          </Button>
          <Button size="sm" onClick={openForm}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Neue Aufgabe</span>
          </Button>
        </div>
      </div>

      {/* New Task Form */}
      {showForm && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-indigo-500" />
                <h2 className="text-base font-semibold text-gray-900">Neue Aufgabe</h2>
              </div>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titel *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="z.B. Waschmaschine reparieren lassen"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optionale Details zur Aufgabe…"
                  rows={3}
                  maxLength={500}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stichtag *</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Verantwortlich *</label>
                  <select
                    value={assignedUserId}
                    onChange={(e) => setAssignedUserId(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                  >
                    <option value="">Person auswählen…</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-sm text-indigo-700">
                Die zugewiesene Person erhält sofort eine Push-Benachrichtigung, 1 Woche vor Ablauf und am Stichtag um 9 Uhr.
              </div>

              {submitError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-xl p-2">{submitError}</p>
              )}

              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)}>
                  Abbrechen
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="flex-1"
                >
                  {submitting ? 'Erstelle…' : 'Aufgabe erstellen'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="space-y-1 flex-1">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : tasks.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 py-16 text-center">
            <ClipboardList className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 font-medium">Keine Aufgaben</p>
            <p className="text-sm text-gray-400 mt-1">Erstelle die erste Aufgabe!</p>
          </div>
        ) : (
          tasks.map((task) => {
            const status = getTaskStatus(task.dueDate)
            const styles = STATUS_STYLES[status]
            return (
              <Card key={task.id} className={cn('overflow-hidden border', styles.border)}>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <div className={cn('mt-1.5 h-2.5 w-2.5 rounded-full flex-shrink-0', styles.dot)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold text-gray-900 leading-snug">
                          {task.title ?? task.content ?? '(Kein Titel)'}
                        </h3>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className={cn(
                            'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
                            styles.badge
                          )}>
                            {styles.label}
                          </span>
                          {canDelete(task) && (
                            <button
                              onClick={() => handleDelete(task.id)}
                              disabled={deletingId === task.id}
                              className="text-gray-300 hover:text-red-400 transition-colors disabled:opacity-40 p-1"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {task.content && (
                        <p className="mt-1 text-sm text-gray-500 whitespace-pre-wrap line-clamp-3">
                          {task.content}
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500">
                        {task.dueDate && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>{formatDueDate(task.dueDate)}</span>
                          </div>
                        )}
                        {task.assignedUser && (
                          <div className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5" />
                            <Avatar className="h-5 w-5">
                              {task.assignedUser.avatarUrl && (
                                <AvatarImage src={task.assignedUser.avatarUrl} alt={task.assignedUser.name} />
                              )}
                              <AvatarFallback className="text-[10px] bg-indigo-100 text-indigo-700">
                                {getInitials(task.assignedUser.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-gray-700">
                              {task.assignedUser.name}
                              {task.assignedUser.id === session?.user?.id && (
                                <span className="ml-1 text-indigo-500">(Du)</span>
                              )}
                            </span>
                          </div>
                        )}
                        <span className="text-gray-400">
                          von {task.author.name}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
