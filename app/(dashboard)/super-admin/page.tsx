'use client'

import * as React from 'react'
import { Users, Home, ClipboardList, CalendarDays, Megaphone, RefreshCw, Shield } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn, getInitials, formatDate } from '@/lib/utils'

interface WgMember {
  id: string
  name: string
  email: string
  role: string
  createdAt: string
}

interface WgData {
  id: string
  name: string
  createdAt: string
  members: WgMember[]
  _count: {
    duties: number
    assignments: number
    announcements: number
    icalCalendars: number
  }
}

export default function SuperAdminPage() {
  const [wgs, setWgs] = React.useState<WgData[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')

  const fetchWgs = React.useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/super/wgs')
      if (res.status === 403) { setError('Keine Berechtigung.'); return }
      if (!res.ok) throw new Error('Fehler beim Laden')
      const data = await res.json()
      setWgs(data.wgs ?? [])
    } catch {
      setError('Fehler beim Laden der WGs')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { fetchWgs() }, [fetchWgs])

  const totalUsers = wgs.reduce((s, w) => s + w.members.length, 0)
  const totalDuties = wgs.reduce((s, w) => s + w._count.duties, 0)
  const totalAnnouncements = wgs.reduce((s, w) => s + w._count.announcements, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="h-6 w-6 text-indigo-600" />
            Super Admin
          </h1>
          <p className="text-sm text-gray-500 mt-1">Übersicht aller WGs im System</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchWgs} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          <span className="hidden sm:inline">Aktualisieren</span>
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {/* Summary stats */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'WGs gesamt', value: wgs.length, icon: Home, color: 'text-indigo-600 bg-indigo-50' },
            { label: 'Nutzer gesamt', value: totalUsers, icon: Users, color: 'text-emerald-600 bg-emerald-50' },
            { label: 'Dienste gesamt', value: totalDuties, icon: ClipboardList, color: 'text-amber-600 bg-amber-50' },
            { label: 'Ankündigungen', value: totalAnnouncements, icon: Megaphone, color: 'text-rose-600 bg-rose-50' },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0', color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{value}</p>
                    <p className="text-xs text-gray-500">{label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* WG list */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="pt-5 space-y-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : wgs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400 text-sm">
            Keine WGs gefunden.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {wgs.map((wg) => {
            const admins = wg.members.filter((m) => m.role === 'ADMIN')
            return (
              <Card key={wg.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Home className="h-4 w-4 text-indigo-500" />
                        {wg.name}
                      </CardTitle>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Erstellt {formatDate(wg.createdAt)} · ID: <span className="font-mono">{wg.id.slice(0, 8)}…</span>
                      </p>
                    </div>
                    <div className="flex gap-2 flex-wrap justify-end">
                      <Badge variant="outline" className="text-xs gap-1">
                        <Users className="h-3 w-3" />{wg.members.length} Mitglieder
                      </Badge>
                      <Badge variant="outline" className="text-xs gap-1">
                        <ClipboardList className="h-3 w-3" />{wg._count.duties} Dienste
                      </Badge>
                      {wg._count.icalCalendars > 0 && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <CalendarDays className="h-3 w-3" />{wg._count.icalCalendars} Kalender
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {wg.members.map((member) => (
                      <div key={member.id} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs bg-indigo-100 text-indigo-700">
                            {getInitials(member.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{member.name}</p>
                          <p className="text-xs text-gray-400 truncate">{member.email}</p>
                        </div>
                        <Badge
                          className={cn(
                            'text-xs flex-shrink-0',
                            member.role === 'ADMIN'
                              ? 'bg-indigo-100 text-indigo-700'
                              : 'bg-gray-100 text-gray-600'
                          )}
                        >
                          {member.role === 'ADMIN' ? 'Admin' : 'Mitglied'}
                        </Badge>
                        <span className="text-xs text-gray-300 flex-shrink-0 hidden sm:block">
                          {formatDate(member.createdAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
