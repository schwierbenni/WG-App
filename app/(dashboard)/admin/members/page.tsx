'use client'

import * as React from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Users, Link as LinkIcon, Copy, Check, Trash2,
  Shield, ShieldOff, RefreshCw, ArrowRightLeft,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { cn, getInitials, formatDate } from '@/lib/utils'

const SUPER_ADMIN_EMAIL = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL ?? 'schwier.b@gmail.com'

interface Member {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  role: 'ADMIN' | 'MEMBER'
  wgId: string
  emailNotifications: boolean
  createdAt: string
}

interface WgOption {
  id: string
  name: string
  _count: { members: number }
}

export default function AdminMembersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [allWgs, setAllWgs] = React.useState<WgOption[]>([])
  const [selectedWgId, setSelectedWgId] = React.useState<string>('')
  const [members, setMembers] = React.useState<Member[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')

  const [roleLoading, setRoleLoading] = React.useState<string | null>(null)
  const [wgLoading, setWgLoading] = React.useState<string | null>(null)

  const [removeTarget, setRemoveTarget] = React.useState<Member | null>(null)
  const [removeConfirm, setRemoveConfirm] = React.useState('')
  const [removing, setRemoving] = React.useState(false)
  const [removeError, setRemoveError] = React.useState('')

  const [inviteLink, setInviteLink] = React.useState('')
  const [generatingLink, setGeneratingLink] = React.useState(false)
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    if (status === 'loading') return
    if (!session || session.user.role !== 'ADMIN') router.replace('/')
  }, [session, status, router])

  const currentWgId = (session?.user as { wgId?: string })?.wgId ?? ''
  const superAdmin = !!session?.user?.email && session.user.email === SUPER_ADMIN_EMAIL

  // Super admin: load all WGs for the selector
  React.useEffect(() => {
    if (!superAdmin || session?.user?.role !== 'ADMIN') return
    fetch('/api/admin/wgs')
      .then((r) => r.json())
      .then((data) => {
        const wgs: WgOption[] = data.wgs ?? []
        setAllWgs(wgs)
        setSelectedWgId(currentWgId ?? wgs[0]?.id ?? '')
      })
      .catch(() => {})
  }, [superAdmin, session, currentWgId])

  // Regular admin: fixed to own WG
  React.useEffect(() => {
    if (superAdmin || !currentWgId) return
    setSelectedWgId(currentWgId)
  }, [superAdmin, currentWgId])

  const fetchMembers = React.useCallback(async (wgId: string) => {
    if (!wgId) return
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/admin/users?wgId=${wgId}`)
      if (!res.ok) throw new Error('Fehler beim Laden der Mitglieder')
      const data = await res.json()
      setMembers(data.users ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally { setLoading(false) }
  }, [])

  React.useEffect(() => {
    if (selectedWgId) fetchMembers(selectedWgId)
  }, [selectedWgId, fetchMembers])

  const selectedWg = superAdmin ? allWgs.find((w) => w.id === selectedWgId) : null

  const handleRoleChange = async (member: Member) => {
    setRoleLoading(member.id)
    const newRole: 'ADMIN' | 'MEMBER' = member.role === 'ADMIN' ? 'MEMBER' : 'ADMIN'
    try {
      const res = await fetch(`/api/users/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (res.ok) setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, role: newRole } : m)))
    } catch { /* ignore */ } finally { setRoleLoading(null) }
  }

  const handleWgChange = async (member: Member, newWgId: string) => {
    if (newWgId === member.wgId) return
    setWgLoading(member.id)
    try {
      const res = await fetch(`/api/admin/users/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wgId: newWgId }),
      })
      if (res.ok) {
        setMembers((prev) => prev.filter((m) => m.id !== member.id))
        setAllWgs((prev) =>
          prev.map((w) => {
            if (w.id === member.wgId) return { ...w, _count: { members: w._count.members - 1 } }
            if (w.id === newWgId) return { ...w, _count: { members: w._count.members + 1 } }
            return w
          })
        )
      }
    } catch { /* ignore */ } finally { setWgLoading(null) }
  }

  const handleRemove = async () => {
    if (!removeTarget || removeConfirm !== removeTarget.name) return
    setRemoving(true); setRemoveError('')
    try {
      const res = await fetch(`/api/users/${removeTarget.id}`, { method: 'DELETE' })
      if (res.ok || res.status === 204) {
        setMembers((prev) => prev.filter((m) => m.id !== removeTarget.id))
        if (superAdmin) {
          setAllWgs((prev) =>
            prev.map((w) => w.id === selectedWgId ? { ...w, _count: { members: w._count.members - 1 } } : w)
          )
        }
        setRemoveTarget(null); setRemoveConfirm('')
      } else {
        const data = await res.json()
        setRemoveError(data.error ?? 'Fehler beim Entfernen')
      }
    } catch {
      setRemoveError('Netzwerkfehler. Bitte erneut versuchen.')
    } finally { setRemoving(false) }
  }

  const handleGenerateInvite = async () => {
    setGeneratingLink(true); setInviteLink('')
    try {
      // Regular admins: /api/invite with no wgId (enforced server-side to own WG)
      // Super admin: pass the selected wgId
      const url = superAdmin ? `/api/invite?wgId=${selectedWgId}` : '/api/invite'
      const res = await fetch(url)
      if (res.ok) { const data = await res.json(); setInviteLink(data.url) }
    } catch { /* ignore */ } finally { setGeneratingLink(false) }
  }

  const handleCopy = async () => {
    if (!inviteLink) return
    try { await navigator.clipboard.writeText(inviteLink); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    catch { /* ignore */ }
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
      </div>
    )
  }

  const wgLabel = selectedWg ? ` – ${selectedWg.name}` : ''

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mitglieder verwalten</h1>
          <p className="text-sm text-gray-500 mt-1">
            {members.length} {members.length === 1 ? 'Mitglied' : 'Mitglieder'}
            {superAdmin && selectedWg ? ` in „${selectedWg.name}"` : ''}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchMembers(selectedWgId)} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          <span className="hidden sm:inline">Aktualisieren</span>
        </Button>
      </div>

      {/* WG selector – Super Admin only */}
      {superAdmin && allWgs.length > 1 && (
        <div className="flex items-center gap-3">
          <Label htmlFor="wg-select" className="text-sm font-medium text-gray-700 shrink-0">WG anzeigen:</Label>
          <Select
            id="wg-select"
            value={selectedWgId}
            onChange={(e) => { setSelectedWgId(e.target.value); setInviteLink('') }}
            className="max-w-xs"
          >
            {allWgs.map((wg) => (
              <option key={wg.id} value={wg.id}>
                {wg.name}{wg.id === currentWgId ? ' (deine WG)' : ''} — {wg._count.members} Mitglieder
              </option>
            ))}
          </Select>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {/* Invite card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <LinkIcon className="h-5 w-5 text-indigo-500" />
            Mitglied einladen{wgLabel}
          </CardTitle>
          <CardDescription>Link ist 7 Tage lang gültig und kann einmal verwendet werden.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" onClick={handleGenerateInvite} disabled={generatingLink || !selectedWgId}>
            <LinkIcon className="h-4 w-4" />
            {generatingLink ? 'Generiere…' : 'Einladungslink generieren'}
          </Button>
          {inviteLink && (
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <Input value={inviteLink} readOnly className="text-xs font-mono text-gray-600"
                  onClick={(e) => (e.target as HTMLInputElement).select()} />
                <Button variant="outline" size="icon" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              {copied && <p className="text-xs text-green-600">Link in die Zwischenablage kopiert!</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Members list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-500" />
            Mitglieder
          </CardTitle>
          {superAdmin && allWgs.length > 1 && (
            <CardDescription className="flex items-center gap-1">
              <ArrowRightLeft className="h-3.5 w-3.5" />
              Per Dropdown kannst du Mitglieder in eine andere WG verschieben.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="px-6 py-4 space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-8 w-28" />
                </div>
              ))}
            </div>
          ) : members.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center px-6">Keine Mitglieder in dieser WG</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {members.map((member) => {
                const isSelf = member.id === session?.user?.id
                return (
                  <li key={member.id} className="flex items-center gap-3 px-4 py-4 sm:px-6">
                    <Avatar className="h-10 w-10 shrink-0">
                      {member.avatarUrl && <AvatarImage src={member.avatarUrl} alt={member.name} />}
                      <AvatarFallback className="bg-indigo-100 text-indigo-700">{getInitials(member.name)}</AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900">
                          {member.name}
                          {isSelf && <span className="ml-1 text-indigo-500 font-normal text-xs">(Du)</span>}
                        </span>
                        <Badge className={member.role === 'ADMIN' ? 'bg-indigo-100 text-indigo-700 text-xs' : 'bg-gray-100 text-gray-600 text-xs'}>
                          {member.role === 'ADMIN' ? 'Admin' : 'Mitglied'}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-400 truncate">{member.email}</p>
                      <p className="text-xs text-gray-300">Seit {formatDate(member.createdAt)}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      {/* WG move dropdown – Super Admin only */}
                      {superAdmin && allWgs.length > 1 && !isSelf && (
                        <div className="relative">
                          <Select
                            value={member.wgId}
                            onChange={(e) => handleWgChange(member, e.target.value)}
                            disabled={wgLoading === member.id}
                            className="text-xs h-8 py-0 pr-7 min-w-[120px] max-w-[160px]"
                          >
                            {allWgs.map((wg) => (
                              <option key={wg.id} value={wg.id}>{wg.name}</option>
                            ))}
                          </Select>
                          {wgLoading === member.id && (
                            <RefreshCw className="absolute right-7 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-gray-400 pointer-events-none" />
                          )}
                        </div>
                      )}

                      {!isSelf && (
                        <>
                          <Button
                            variant="ghost" size="sm"
                            className={cn('h-8 text-xs', member.role === 'ADMIN'
                              ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50'
                              : 'text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50')}
                            disabled={roleLoading === member.id}
                            onClick={() => handleRoleChange(member)}
                          >
                            {roleLoading === member.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              : member.role === 'ADMIN' ? <ShieldOff className="h-3.5 w-3.5" />
                              : <Shield className="h-3.5 w-3.5" />}
                            <span className="hidden sm:inline">
                              {member.role === 'ADMIN' ? 'Degradieren' : 'Admin'}
                            </span>
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            className="h-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => { setRemoveTarget(member); setRemoveConfirm(''); setRemoveError('') }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Entfernen</span>
                          </Button>
                        </>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!removeTarget} onOpenChange={(open) => { if (!open) { setRemoveTarget(null); setRemoveConfirm(''); setRemoveError('') } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />Mitglied entfernen?
            </DialogTitle>
          </DialogHeader>
          {removeTarget && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
                <Avatar className="h-9 w-9">
                  {removeTarget.avatarUrl && <AvatarImage src={removeTarget.avatarUrl} alt={removeTarget.name} />}
                  <AvatarFallback className="bg-indigo-100 text-indigo-700">{getInitials(removeTarget.name)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{removeTarget.name}</p>
                  <p className="text-xs text-gray-400">{removeTarget.email}</p>
                </div>
              </div>
              <p className="text-sm text-gray-600">Das Konto wird dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.</p>
              <div className="space-y-1">
                <p className="text-xs text-gray-500">Gib <span className="font-semibold">{removeTarget.name}</span> ein um zu bestätigen:</p>
                <Input value={removeConfirm} onChange={(e) => setRemoveConfirm(e.target.value)} placeholder={removeTarget.name} disabled={removing} />
              </div>
              {removeError && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{removeError}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRemoveTarget(null); setRemoveConfirm(''); setRemoveError('') }} disabled={removing}>Abbrechen</Button>
            <Button variant="destructive" onClick={handleRemove} disabled={removing || removeConfirm !== removeTarget?.name}>
              {removing ? 'Entferne…' : 'Entfernen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
