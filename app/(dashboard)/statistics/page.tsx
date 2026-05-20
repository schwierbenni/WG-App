'use client'

import * as React from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Trophy, TrendingUp, RefreshCw, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, getInitials } from '@/lib/utils'

interface SimpleUser {
  id: string
  name: string
  avatarUrl: string | null
}

interface Assignment {
  id: string
  completedAt: string | null
  user: SimpleUser
  duty: {
    id: string
    name: string
    emoji: string | null
  }
}

interface UserStats {
  userId: string
  name: string
  avatarUrl: string | null
  total: number
  thisMonth: number
  percentage: number
}

function isThisMonth(dateStr: string): boolean {
  const d = new Date(dateStr)
  const now = new Date()
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
}

export default function StatisticsPage() {
  const [assignments, setAssignments] = React.useState<Assignment[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')

  const fetchData = React.useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/assignments')
      if (!res.ok) throw new Error('Fehler beim Laden der Daten')
      const data = await res.json()
      const completed = (data.assignments as Assignment[]).filter((a) => a.completedAt !== null)
      setAssignments(completed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  const userStats = React.useMemo((): UserStats[] => {
    const map = new Map<string, UserStats>()

    for (const a of assignments) {
      if (!a.completedAt) continue
      const existing = map.get(a.user.id)
      const thisMonth = isThisMonth(a.completedAt) ? 1 : 0
      if (existing) {
        existing.total += 1
        existing.thisMonth += thisMonth
      } else {
        map.set(a.user.id, {
          userId: a.user.id,
          name: a.user.name,
          avatarUrl: a.user.avatarUrl,
          total: 1,
          thisMonth,
          percentage: 0,
        })
      }
    }

    const stats = Array.from(map.values()).sort((a, b) => b.total - a.total)
    const total = stats.reduce((sum, s) => sum + s.total, 0)
    return stats.map((s) => ({
      ...s,
      percentage: total > 0 ? Math.round((s.total / total) * 100) : 0,
    }))
  }, [assignments])

  const chartData = userStats.map((s) => ({
    name: s.name.split(' ')[0],
    Gesamt: s.total,
    'Diesen Monat': s.thisMonth,
  }))

  const topThisMonth = [...userStats]
    .sort((a, b) => b.thisMonth - a.thisMonth)
    .slice(0, 3)
    .filter((s) => s.thisMonth > 0)

  const totalCompleted = assignments.length
  const completedThisMonth = assignments.filter((a) => a.completedAt && isThisMonth(a.completedAt)).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Statistiken</h1>
          <p className="text-sm text-gray-500 mt-1">Erledigte Dienste und Fairness-Übersicht</p>
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

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Gesamt erledigt</CardDescription>
            <CardTitle className="text-3xl font-bold text-indigo-600">
              {loading ? <Skeleton className="h-9 w-16" /> : totalCompleted}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-400">Alle Zeiten</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Diesen Monat</CardDescription>
            <CardTitle className="text-3xl font-bold text-purple-600">
              {loading ? <Skeleton className="h-9 w-16" /> : completedThisMonth}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-400">
              {new Date().toLocaleString('de-DE', { month: 'long', year: 'numeric' })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Aktive Mitglieder</CardDescription>
            <CardTitle className="text-3xl font-bold text-emerald-600">
              {loading ? <Skeleton className="h-9 w-16" /> : userStats.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-400">Mit erledigten Diensten</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-5 w-5 text-indigo-500" />
              Erledigte Dienste pro Mitglied
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-end gap-4 h-48">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="flex-1" style={{ height: `${(i + 1) * 30}%` }} />
                ))}
              </div>
            ) : chartData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-sm text-gray-400">
                Noch keine Daten vorhanden
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="Gesamt" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Diesen Monat" fill="#a855f7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-5 w-5 text-amber-500" />
              Top diesen Monat
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                ))}
              </div>
            ) : topThisMonth.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">
                Noch keine Einträge diesen Monat
              </p>
            ) : (
              <div className="space-y-3">
                {topThisMonth.map((user, index) => (
                  <div key={user.userId} className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar className="h-9 w-9">
                        {user.avatarUrl && (
                          <AvatarImage src={user.avatarUrl} alt={user.name} />
                        )}
                        <AvatarFallback className="text-sm bg-indigo-100 text-indigo-700">
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      {index === 0 && (
                        <span className="absolute -top-1 -right-1 text-sm">🥇</span>
                      )}
                      {index === 1 && (
                        <span className="absolute -top-1 -right-1 text-sm">🥈</span>
                      )}
                      {index === 2 && (
                        <span className="absolute -top-1 -right-1 text-sm">🥉</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                      <p className="text-xs text-gray-400">
                        {user.thisMonth} {user.thisMonth === 1 ? 'Dienst' : 'Dienste'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5 text-indigo-500" />
            Fairness-Übersicht
          </CardTitle>
          <CardDescription>
            Anteil erledigter Dienste pro Mitglied (gesamt)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-2 w-full" />
                </div>
              ))}
            </div>
          ) : userStats.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">Keine Daten vorhanden</p>
          ) : (
            <div className="space-y-4">
              {userStats.map((user) => (
                <div key={user.userId} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        {user.avatarUrl && (
                          <AvatarImage src={user.avatarUrl} alt={user.name} />
                        )}
                        <AvatarFallback className="text-xs bg-indigo-100 text-indigo-700">
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium text-gray-700">{user.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">{user.total} Dienste</span>
                      <Badge variant="secondary" className="text-xs min-w-[42px] justify-center">
                        {user.percentage}%
                      </Badge>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                      style={{ width: `${user.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
