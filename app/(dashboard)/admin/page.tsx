'use client'

import * as React from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Users,
  ClipboardList,
  ArrowLeftRight,
  Link as LinkIcon,
  Copy,
  Check,
  ChevronRight,
  LayoutDashboard,
  RefreshCw,
} from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface AdminStats {
  totalMembers: number
  totalDuties: number
  pendingSwaps: number
}

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [stats, setStats] = React.useState<AdminStats | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [inviteLink, setInviteLink] = React.useState('')
  const [generatingLink, setGeneratingLink] = React.useState(false)
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    if (status === 'loading') return
    if (!session || session.user.role !== 'ADMIN') {
      router.replace('/')
    }
  }, [session, status, router])

  const fetchStats = React.useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [usersRes, dutiesRes, swapsRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/duties'),
        fetch('/api/swap-requests?direction=received'),
      ])
      const [usersData, dutiesData, swapsData] = await Promise.all([
        usersRes.ok ? usersRes.json() : { users: [] },
        dutiesRes.ok ? dutiesRes.json() : { duties: [] },
        swapsRes.ok ? swapsRes.json() : { swapRequests: [] },
      ])
      const pendingSwaps = (swapsData.swapRequests ?? []).filter(
        (s: { status: string }) => s.status === 'PENDING'
      ).length
      setStats({
        totalMembers: (usersData.users ?? []).length,
        totalDuties: (dutiesData.duties ?? []).length,
        pendingSwaps,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (session?.user?.role === 'ADMIN') {
      fetchStats()
    }
  }, [session, fetchStats])

  const handleGenerateInvite = async () => {
    setGeneratingLink(true)
    try {
      const res = await fetch('/api/invite')
      if (res.ok) {
        const data = await res.json()
        setInviteLink(data.url)
      }
    } catch {
      // ignore
    } finally {
      setGeneratingLink(false)
    }
  }

  const handleCopy = async () => {
    if (!inviteLink) return
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  if (status === 'loading' || (session && session.user.role !== 'ADMIN')) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <LayoutDashboard className="h-6 w-6 text-indigo-600" />
            <h1 className="text-2xl font-bold text-gray-900">Admin-Dashboard</h1>
          </div>
          <p className="text-sm text-gray-500">Verwaltung der WG-Konfiguration</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading}>
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
            <CardDescription className="text-xs font-medium flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              Mitglieder gesamt
            </CardDescription>
            <CardTitle className="text-3xl font-bold text-indigo-600">
              {loading ? <Skeleton className="h-9 w-12" /> : stats?.totalMembers ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium flex items-center gap-1.5">
              <ClipboardList className="h-4 w-4" />
              Aktive Dienste
            </CardDescription>
            <CardTitle className="text-3xl font-bold text-purple-600">
              {loading ? <Skeleton className="h-9 w-12" /> : stats?.totalDuties ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium flex items-center gap-1.5">
              <ArrowLeftRight className="h-4 w-4" />
              Ausstehende Tausche
            </CardDescription>
            <CardTitle className="text-3xl font-bold text-amber-500">
              {loading ? (
                <Skeleton className="h-9 w-12" />
              ) : (
                <div className="flex items-center gap-2">
                  {stats?.pendingSwaps ?? 0}
                  {(stats?.pendingSwaps ?? 0) > 0 && (
                    <Badge className="bg-amber-100 text-amber-700 text-xs">Neu</Badge>
                  )}
                </div>
              )}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="hover:shadow-md transition-shadow">
          <Link href="/admin/duties">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-indigo-100 p-2">
                    <ClipboardList className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Dienste verwalten</CardTitle>
                    <CardDescription className="text-xs mt-0.5">Erstellen, bearbeiten, löschen</CardDescription>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </div>
            </CardHeader>
          </Link>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <Link href="/admin/members">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-purple-100 p-2">
                    <Users className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Mitglieder verwalten</CardTitle>
                    <CardDescription className="text-xs mt-0.5">Rollen, Einladungen, Entfernen</CardDescription>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </div>
            </CardHeader>
          </Link>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <LinkIcon className="h-5 w-5 text-indigo-500" />
            Mitglied einladen
          </CardTitle>
          <CardDescription>Generiere einen Einladungslink (gültig für 7 Tage)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" onClick={handleGenerateInvite} disabled={generatingLink}>
            <LinkIcon className="h-4 w-4" />
            {generatingLink ? 'Generiere...' : 'Einladungslink generieren'}
          </Button>
          {inviteLink && (
            <div className="flex gap-2">
              <Input
                value={inviteLink}
                readOnly
                className="text-xs font-mono text-gray-600"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button variant="outline" size="icon" onClick={handleCopy} title="Link kopieren">
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          )}
          {copied && <p className="text-xs text-green-600">Link kopiert!</p>}
        </CardContent>
      </Card>
    </div>
  )
}
