'use client'

import * as React from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Settings, Plus, Link as LinkIcon, Copy, Check, Save,
  RefreshCw, Users, Pencil, X, Upload,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn, getInitials } from '@/lib/utils'

const SUPER_ADMIN_EMAIL = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL ?? 'schwier.b@gmail.com'

interface WgItem {
  id: string
  name: string
  avatarUrl?: string | null
  createdAt: string
  _count: { members: number }
}

// ── Single WG card (Super Admin view) ──────────────────────────────────────
function WgCard({
  wg,
  isCurrentWg,
  onRenamed,
  onAvatarChanged,
}: {
  wg: WgItem
  isCurrentWg: boolean
  onAvatarChanged: (id: string, avatarUrl: string | null) => void
  onRenamed: (id: string, name: string) => void
}) {
  const [editing, setEditing] = React.useState(false)
  const [nameInput, setNameInput] = React.useState(wg.name)
  const [saving, setSaving] = React.useState(false)
  const [saveError, setSaveError] = React.useState('')
  const [inviteLink, setInviteLink] = React.useState('')
  const [generating, setGenerating] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const [uploadingAvatar, setUploadingAvatar] = React.useState(false)
  const [uploadError, setUploadError] = React.useState('')
  const [localAvatarUrl, setLocalAvatarUrl] = React.useState<string | null>(wg.avatarUrl ?? null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  async function handleSave() {
    if (!nameInput.trim() || nameInput.trim() === wg.name) { setEditing(false); return }
    setSaving(true); setSaveError('')
    try {
      const res = await fetch(`/api/admin/wgs/${wg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameInput.trim() }),
      })
      const data = await res.json()
      if (res.ok) { onRenamed(wg.id, data.wg.name); setEditing(false) }
      else setSaveError(data.error ?? 'Fehler beim Speichern')
    } finally { setSaving(false) }
  }

  async function handleGenerateInvite() {
    setGenerating(true)
    try {
      const res = await fetch(`/api/invite?wgId=${wg.id}`)
      if (res.ok) { const data = await res.json(); setInviteLink(data.url) }
    } finally { setGenerating(false) }
  }

  async function handleCopy() {
    if (!inviteLink) return
    try { await navigator.clipboard.writeText(inviteLink); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    catch { /* ignore */ }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true); setUploadError('')
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('wgId', wg.id)
      const res = await fetch('/api/upload/wg-avatar', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) setUploadError(data.error ?? 'Upload fehlgeschlagen.')
      else { setLocalAvatarUrl(data.avatarUrl); onAvatarChanged(wg.id, data.avatarUrl) }
    } catch { setUploadError('Netzwerkfehler.') }
    finally { setUploadingAvatar(false); if (fileInputRef.current) fileInputRef.current.value = '' }
  }

  async function handleRemoveAvatar() {
    try {
      await fetch(`/api/upload/wg-avatar?wgId=${wg.id}`, { method: 'DELETE' })
      setLocalAvatarUrl(null); onAvatarChanged(wg.id, null)
    } catch { /* ignore */ }
  }

  return (
    <Card className={cn('transition-shadow', isCurrentWg && 'ring-2 ring-indigo-200')}>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          {/* Avatar column */}
          <div className="relative shrink-0">
            {localAvatarUrl ? (
              <Avatar className="h-14 w-14 ring-2 ring-indigo-100">
                <AvatarImage src={localAvatarUrl} alt={wg.name} className="object-cover" />
                <AvatarFallback className="text-base font-bold bg-indigo-100 text-indigo-700">{getInitials(wg.name)}</AvatarFallback>
              </Avatar>
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 ring-2 ring-indigo-100">
                <span className="text-base font-extrabold text-indigo-400">{getInitials(wg.name)}</span>
              </div>
            )}
            {uploadingAvatar && (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40">
                <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleAvatarUpload}
              disabled={uploadingAvatar}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              title="Bild hochladen"
              className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              <Upload className="h-2.5 w-2.5" />
            </button>
          </div>

          {/* Name + controls */}
          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="flex items-center gap-2">
                <Input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setEditing(false); setNameInput(wg.name) } }}
                  autoFocus className="h-8 text-sm font-semibold" maxLength={100}
                />
                <Button size="sm" variant="ghost" onClick={handleSave} disabled={saving} className="h-8 w-8 p-0 text-green-600 hover:text-green-700">
                  {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setNameInput(wg.name) }} className="h-8 w-8 p-0 text-gray-400">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 flex-wrap">
                <CardTitle className="text-base truncate">{wg.name}</CardTitle>
                {isCurrentWg && <Badge className="bg-indigo-100 text-indigo-700 text-xs shrink-0">Deine WG</Badge>}
                <Button size="sm" variant="ghost" onClick={() => { setEditing(true); setNameInput(wg.name) }}
                  className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600 shrink-0">
                  <Pencil className="h-3 w-3" />
                </Button>
              </div>
            )}
            {saveError && <p className="text-xs text-red-600 mt-1">{saveError}</p>}
            <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-400">
              <Users className="h-3.5 w-3.5" />
              <span>{wg._count.members} Mitglieder</span>
              {localAvatarUrl && (
                <button type="button" onClick={handleRemoveAvatar}
                  className="ml-1 text-red-400 hover:text-red-600 transition-colors">
                  · Bild entfernen
                </button>
              )}
            </div>
            {uploadError && <p className="text-xs text-red-600 mt-1">{uploadError}</p>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button variant="outline" size="sm" onClick={handleGenerateInvite} disabled={generating} className="w-full gap-1.5">
          <LinkIcon className="h-4 w-4" />
          {generating ? 'Generiere…' : 'Einladungslink generieren'}
        </Button>
        {inviteLink && (
          <div className="space-y-1.5">
            <div className="flex gap-2">
              <Input value={inviteLink} readOnly className="text-xs font-mono text-gray-600 h-8" onClick={(e) => (e.target as HTMLInputElement).select()} />
              <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={handleCopy}>
                {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
            {copied && <p className="text-xs text-green-600">Kopiert!</p>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Regular admin: own WG only ──────────────────────────────────────────────
function OwnWgSettings({ currentWgId }: { currentWgId: string }) {
  const [wgName, setWgName] = React.useState('')
  const [nameInput, setNameInput] = React.useState('')
  const [wgAvatarUrl, setWgAvatarUrl] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [saveSuccess, setSaveSuccess] = React.useState(false)
  const [saveError, setSaveError] = React.useState('')
  const [inviteLink, setInviteLink] = React.useState('')
  const [generating, setGenerating] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [uploadingAvatar, setUploadingAvatar] = React.useState(false)
  const [uploadError, setUploadError] = React.useState('')
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    fetch('/api/wg')
      .then((r) => r.json())
      .then((data) => {
        setWgName(data.wg?.name ?? '')
        setNameInput(data.wg?.name ?? '')
        setWgAvatarUrl(data.wg?.avatarUrl ?? null)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    setUploadError('')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/upload/wg-avatar', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) setUploadError(data.error ?? 'Upload fehlgeschlagen.')
      else setWgAvatarUrl(data.avatarUrl)
    } catch {
      setUploadError('Netzwerkfehler beim Upload.')
    } finally {
      setUploadingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleRemoveAvatar() {
    try {
      await fetch('/api/upload/wg-avatar', { method: 'DELETE' })
      setWgAvatarUrl(null)
    } catch { /* ignore */ }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!nameInput.trim() || nameInput.trim() === wgName) return
    setSaving(true); setSaveError(''); setSaveSuccess(false)
    try {
      const res = await fetch('/api/wg', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameInput.trim() }),
      })
      const data = await res.json()
      if (res.ok) { setWgName(data.wg.name); setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 3000) }
      else setSaveError(data.error ?? 'Fehler beim Speichern')
    } finally { setSaving(false) }
  }

  async function handleGenerateInvite() {
    setGenerating(true); setInviteLink('')
    try {
      const res = await fetch('/api/invite')
      if (res.ok) { const data = await res.json(); setInviteLink(data.url) }
    } finally { setGenerating(false) }
  }

  async function handleCopy() {
    if (!inviteLink) return
    try { await navigator.clipboard.writeText(inviteLink); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    catch { /* ignore */ }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-32" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* WG Avatar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4 text-indigo-500" />
            WG-Profilbild
          </CardTitle>
          <CardDescription>Wird in der Sidebar und im mobilen Header angezeigt.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-5">
            <div className="relative shrink-0">
              {wgAvatarUrl ? (
                <Avatar className="h-20 w-20 ring-2 ring-indigo-200">
                  <AvatarImage src={wgAvatarUrl} alt={wgName} className="object-cover" />
                  <AvatarFallback className="text-xl font-bold bg-indigo-100 text-indigo-700">
                    {getInitials(wgName)}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-indigo-100 ring-2 ring-indigo-200">
                  <span className="text-2xl font-extrabold text-indigo-600">
                    {getInitials(wgName || 'WG')}
                  </span>
                </div>
              )}
              {uploadingAvatar && (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40">
                  <span className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                </div>
              )}
            </div>
            <div className="space-y-2.5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleAvatarUpload}
                disabled={uploadingAvatar}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploadingAvatar}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" />
                {uploadingAvatar ? 'Wird hochgeladen…' : 'Bild hochladen'}
              </Button>
              {wgAvatarUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 block"
                  onClick={handleRemoveAvatar}
                >
                  <X className="h-3.5 w-3.5" />
                  Bild entfernen
                </Button>
              )}
              <p className="text-xs text-gray-400">JPEG, PNG, WebP oder GIF · max. 2 MB</p>
              {uploadError && (
                <p className="text-xs text-red-600 bg-red-50 rounded p-1.5">{uploadError}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rename */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Pencil className="h-4 w-4 text-indigo-500" />
            WG umbenennen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="wg-name" className="sr-only">WG-Name</Label>
              <Input
                id="wg-name"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Name der WG"
                maxLength={100}
                disabled={saving}
              />
            </div>
            <Button type="submit" disabled={saving || !nameInput.trim() || nameInput.trim() === wgName}>
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Speichern
            </Button>
          </form>
          {saveError && <p className="text-xs text-red-600 mt-2">{saveError}</p>}
          {saveSuccess && <p className="text-xs text-green-600 mt-2">WG-Name gespeichert!</p>}
        </CardContent>
      </Card>

      {/* Invite */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <LinkIcon className="h-5 w-5 text-indigo-500" />
            Einladungslink
          </CardTitle>
          <CardDescription>
            Der Link ist 7 Tage lang gültig und kann einmal verwendet werden.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" onClick={handleGenerateInvite} disabled={generating}>
            <LinkIcon className="h-4 w-4" />
            {generating ? 'Generiere…' : 'Neuen Link generieren'}
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
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function WgManagementPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [wgs, setWgs] = React.useState<WgItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState('')
  const [newName, setNewName] = React.useState('')
  const [creating, setCreating] = React.useState(false)
  const [createError, setCreateError] = React.useState('')

  React.useEffect(() => {
    if (status === 'loading') return
    if (!session || session.user.role !== 'ADMIN') router.replace('/dashboard')
  }, [session, status, router])

  const currentWgId = (session?.user as { wgId?: string })?.wgId ?? ''
  const superAdmin = !!session?.user?.email && session.user.email === SUPER_ADMIN_EMAIL

  const fetchWgs = React.useCallback(async () => {
    if (!superAdmin) return
    setLoading(true); setLoadError('')
    try {
      const res = await fetch('/api/admin/wgs')
      if (!res.ok) throw new Error('Fehler beim Laden der WGs')
      const data = await res.json()
      setWgs(data.wgs ?? [])
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally { setLoading(false) }
  }, [superAdmin])

  React.useEffect(() => {
    if (superAdmin && session?.user?.role === 'ADMIN') fetchWgs()
    else setLoading(false)
  }, [superAdmin, session, fetchWgs])

  function handleRenamed(id: string, name: string) {
    setWgs((prev) => prev.map((w) => (w.id === id ? { ...w, name } : w)))
  }

  function handleAvatarChanged(id: string, avatarUrl: string | null) {
    setWgs((prev) => prev.map((w) => (w.id === id ? { ...w, avatarUrl } : w)))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true); setCreateError('')
    try {
      const res = await fetch('/api/admin/wgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      const data = await res.json()
      if (res.ok) { setWgs((prev) => [...prev, data.wg]); setNewName('') }
      else setCreateError(data.error ?? 'Fehler beim Erstellen')
    } finally { setCreating(false) }
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="h-6 w-6 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">WG-Einstellungen</h1>
            <p className="text-sm text-gray-500">
              {superAdmin ? 'WGs erstellen, umbenennen und Mitglieder einladen' : 'WG umbenennen und Einladungslink erstellen'}
            </p>
          </div>
        </div>
        {superAdmin && (
          <Button variant="outline" size="sm" onClick={fetchWgs} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            <span className="hidden sm:inline">Aktualisieren</span>
          </Button>
        )}
      </div>

      {/* Regular admin: show own WG only */}
      {!superAdmin && <OwnWgSettings currentWgId={currentWgId} />}

      {/* Super admin: full WG management */}
      {superAdmin && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="h-5 w-5 text-indigo-500" />
                Neue WG anlegen
              </CardTitle>
              <CardDescription>Erstelle eine neue WG und generiere danach einen Einladungslink.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="new-wg-name" className="sr-only">WG-Name</Label>
                  <Input
                    id="new-wg-name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Name der neuen WG…"
                    maxLength={100}
                    disabled={creating}
                  />
                  {createError && <p className="text-xs text-red-600">{createError}</p>}
                </div>
                <Button type="submit" disabled={creating || !newName.trim()}>
                  {creating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Anlegen
                </Button>
              </form>
            </CardContent>
          </Card>

          {loadError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{loadError}</div>
          ) : loading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader><Skeleton className="h-5 w-36" /></CardHeader>
                  <CardContent><Skeleton className="h-9 w-full" /></CardContent>
                </Card>
              ))}
            </div>
          ) : wgs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Keine WGs gefunden</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {wgs.map((wg) => (
                <WgCard key={wg.id} wg={wg} isCurrentWg={wg.id === currentWgId} onRenamed={handleRenamed} onAvatarChanged={handleAvatarChanged} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
