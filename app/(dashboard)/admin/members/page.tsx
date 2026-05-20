'use client'

import * as React from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Users,
  Link as LinkIcon,
  Copy,
  Check,
  Trash2,
  Shield,
  ShieldOff,
  RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { cn, getInitials, formatDate } from '@/lib/utils'

interface Member {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  role: 'ADMIN' | 'MEMBER'
  emailNotifications: boolean
  createdAt: string
}

export default function AdminMembersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [members, setMembers] = React.useState<Member[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')

  const [roleLoading, setRoleLoading] = React.useState<string | null>(null)

  const [removeTarget, setRemoveTarget] = React.useState<Member | null>(null)
  const [removeConfirm, setRemoveConfirm] = React.useState('')
  const [removing, setRemoving] = React.useState(false)
  const [removeError, setRemoveError] = React.useState('')

  const [inviteLink, setInviteLink] = React.useState('')
  const [generatingLink, setGeneratingLink] = React.useState(false)
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    if (status === 'loading') return
    if (!session || session.user.role !== 'ADMIN') {
      router.replace('/')
    }
  }, [session, status, router])

  const fetchMembers = React.useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/users')
      if (!res.ok) throw new Error('Fehler beim Laden der Mitglieder')
      const data = await res.json()
      setMembers(data.users ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (session?.user?.role === 'ADMIN') {
      fetchMembers()
    }
  }, [session, fetchMembers])

  const handleRoleChange = async (member: Member) => {
    setRoleLoading(member.id)
    const newRole: 'ADMIN' | 'MEMBER' = member.role === 'ADMIN' ? 'MEMBER' : 'ADMIN'
    try {
      const res = await fetch(`/api/users/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (res.ok) {
        setMembers((prev) =>
          prev.map((m) => (m.id === member.id ? { ...m, role: newRole } : m))
        )
      }
    } catch {
      // ignore
    } finally {
      setRoleLoading(null)
    }
  }

  const handleRemove = async () => {
    if (!removeTarget || removeConfirm !== removeTarget.name) return
    setRemoving(true)
    setRemoveError('')
    try {
      const res = await fetch(`/api/users/${removeTarget.id}`, { method: 'DELETE' })
      if (res.ok || res.status === 204) {
        setMembers((prev) => prev.filter((m) => m.id !== removeTarget.id))
        setRemoveTarget(null)
        setRemoveConfirm('')
      } else {
        const data = await res.json()
        setRemoveError(data.error ?? 'Fehler beim Entfernen')
      }
    } catch {
      setRemoveError('Netzwerkfehler. Bitte erneut versuchen.')
    } finally {
      setRemoving(false)
    }
  }

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

  if (status === 'loading') {
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
          <h1 className="text-2xl font-bold text-gray-900">Mitglieder verwalten</h1>
          <p className="text-sm text-gray-500 mt-1">
            {members.length} {members.length === 1 ? 'Mitglied' : 'Mitglieder'} in der WG
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchMembers} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          <span className="hidden sm:inline">Aktualisieren</span>
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <LinkIcon className="h-5 w-5 text-indigo-500" />
            Neues Mitglied einladen
          </CardTitle>
          <CardDescription>Link ist 7 Tage lang gültig und kann einmal verwendet werden</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            onClick={handleGenerateInvite}
            disabled={generatingLink}
          >
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
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                title="Link kopieren"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}
          {copied && (
            <p className="text-xs text-green-600">Link in die Zwischenablage kopiert!</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-500" />
            WG-Mitglieder
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="px-6 py-4 space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-8 w-20" />
                </div>
              ))}
            </div>
          ) : members.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center px-6">
              Keine Mitglieder gefunden
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {members.map((member) => {
                const isSelf = member.id === session?.user?.id
                return (
                  <li key={member.id} className="flex items-center gap-3 px-6 py-4">
                    <Avatar className="h-10 w-10 shrink-0">
                      {member.avatarUrl && (
                        <AvatarImage src={member.avatarUrl} alt={member.name} />
                      )}
                      <AvatarFallback className="bg-indigo-100 text-indigo-700">
                        {getInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900">
                          {member.name}
                          {isSelf && (
                            <span className="ml-1 text-indigo-500 font-normal text-xs">(Du)</span>
                          )}
                        </span>
                        <Badge
                          className={
                            member.role === 'ADMIN'
                              ? 'bg-indigo-100 text-indigo-700 text-xs'
                              : 'bg-gray-100 text-gray-600 text-xs'
                          }
                        >
                          {member.role === 'ADMIN' ? 'Admin' : 'Mitglied'}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-400 truncate">{member.email}</p>
                      <p className="text-xs text-gray-300">
                        Seit {formatDate(member.createdAt)}
                      </p>
                    </div>
                    {!isSelf && (
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            'h-8 text-xs',
                            member.role === 'ADMIN'
                              ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50'
                              : 'text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50'
                          )}
                          disabled={roleLoading === member.id}
                          onClick={() => handleRoleChange(member)}
                          title={member.role === 'ADMIN' ? 'Zum Mitglied degradieren' : 'Zum Admin befördern'}
                        >
                          {roleLoading === member.id ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : member.role === 'ADMIN' ? (
                            <ShieldOff className="h-3.5 w-3.5" />
                          ) : (
                            <Shield className="h-3.5 w-3.5" />
                          )}
                          <span className="hidden sm:inline">
                            {member.role === 'ADMIN' ? 'Degradieren' : 'Admin machen'}
                          </span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => {
                            setRemoveTarget(member)
                            setRemoveConfirm('')
                            setRemoveError('')
                          }}
                          title="Aus WG entfernen"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Entfernen</span>
                        </Button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!removeTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRemoveTarget(null)
            setRemoveConfirm('')
            setRemoveError('')
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Mitglied entfernen?
            </DialogTitle>
          </DialogHeader>
          {removeTarget && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
                <Avatar className="h-9 w-9">
                  {removeTarget.avatarUrl && (
                    <AvatarImage src={removeTarget.avatarUrl} alt={removeTarget.name} />
                  )}
                  <AvatarFallback className="bg-indigo-100 text-indigo-700">
                    {getInitials(removeTarget.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{removeTarget.name}</p>
                  <p className="text-xs text-gray-400">{removeTarget.email}</p>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                Das Konto dieses Mitglieds wird dauerhaft gelöscht. Diese Aktion kann nicht
                rükgängig gemacht werden.
              </p>
              <div className="space-y-1">
                <p className="text-xs text-gray-500">
                  Gib{' '}
                  <span className="font-semibold">{removeTarget.name}</span>{' '}
                  ein um zu bestätigen:
                </p>
                <Input
                  value={removeConfirm}
                  onChange={(e) => setRemoveConfirm(e.target.value)}
                  placeholder={removeTarget.name}
                  disabled={removing}
                />
              </div>
              {removeError && (
                <p className="text-sm text-red-600 bg-red-50 rounded p-2">{removeError}</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRemoveTarget(null)
                setRemoveConfirm('')
                setRemoveError('')
              }}
              disabled={removing}
            >
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemove}
              disabled={removing || removeConfirm !== removeTarget?.name}
            >
              {removing ? 'Entferne...' : 'Entfernen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
