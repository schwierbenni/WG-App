'use client'

import * as React from 'react'
import { useSession } from 'next-auth/react'
import { ListMusic, Plus, ExternalLink, Trash2, Music2, X, Loader2, Pencil, Check } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, getInitials } from '@/lib/utils'

interface Playlist {
  id: string
  title: string
  description: string | null
  spotifyUrl: string
  createdAt: string
  user: { id: string; name: string; avatarUrl: string | null }
}

function spotifyAppUrl(webUrl: string): string {
  // https://open.spotify.com/playlist/ID → spotify:playlist:ID
  try {
    const url = new URL(webUrl)
    const parts = url.pathname.split('/').filter(Boolean)
    if (parts.length >= 2) return `spotify:${parts[0]}:${parts[1]}`
  } catch {}
  return webUrl
}

function PlaylistCard({
  playlist,
  currentUserId,
  onDelete,
  onUpdate,
}: {
  playlist: Playlist
  currentUserId: string
  onDelete: (id: string) => void
  onUpdate: (playlist: Playlist) => void
}) {
  const isOwner = playlist.user.id === currentUserId
  const [deleting, setDeleting] = React.useState(false)
  const [editing, setEditing] = React.useState(false)
  const [editTitle, setEditTitle] = React.useState(playlist.title)
  const [editDescription, setEditDescription] = React.useState(playlist.description ?? '')
  const [editUrl, setEditUrl] = React.useState(playlist.spotifyUrl)
  const [saving, setSaving] = React.useState(false)
  const [editError, setEditError] = React.useState('')

  async function handleDelete() {
    setDeleting(true)
    const res = await fetch(`/api/playlists/${playlist.id}`, { method: 'DELETE' })
    if (res.ok) onDelete(playlist.id)
    setDeleting(false)
  }

  function startEditing() {
    setEditTitle(playlist.title)
    setEditDescription(playlist.description ?? '')
    setEditUrl(playlist.spotifyUrl)
    setEditError('')
    setEditing(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setEditError('')
    setSaving(true)
    try {
      const res = await fetch(`/api/playlists/${playlist.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription || null,
          spotifyUrl: editUrl,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const firstError = Object.values(data.error ?? {})[0]
        setEditError(Array.isArray(firstError) ? firstError[0] : (data.error ?? 'Fehler'))
      } else {
        onUpdate(data.playlist)
        setEditing(false)
      }
    } catch {
      setEditError('Netzwerkfehler')
    } finally {
      setSaving(false)
    }
  }

  function handleOpen() {
    // Try Spotify app first, fall back to web
    const appUri = spotifyAppUrl(playlist.spotifyUrl)
    window.open(appUri, '_blank')
    // After short delay, if app didn't open, go to web URL
    setTimeout(() => window.open(playlist.spotifyUrl, '_blank'), 500)
  }

  if (editing) {
    return (
      <div className="bg-surface rounded-2xl border border-[#1DB954]/40 p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground flex items-center gap-2 text-sm">
            <Pencil className="w-4 h-4 text-[#1DB954]" />
            Playlist bearbeiten
          </h3>
          <button
            onClick={() => setEditing(false)}
            className="p-1 rounded-lg text-text-subtle hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSave} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor={`edit-title-${playlist.id}`}>Titel</Label>
            <Input
              id={`edit-title-${playlist.id}`}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              disabled={saving}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`edit-desc-${playlist.id}`}>
              Beschreibung <span className="text-text-subtle">(optional)</span>
            </Label>
            <Input
              id={`edit-desc-${playlist.id}`}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              disabled={saving}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`edit-url-${playlist.id}`}>Spotify-Link</Label>
            <Input
              id={`edit-url-${playlist.id}`}
              value={editUrl}
              onChange={(e) => setEditUrl(e.target.value)}
              disabled={saving}
              required
              autoComplete="off"
            />
          </div>
          {editError && (
            <p className="text-sm text-danger bg-danger-bg rounded-lg px-3 py-2">{editError}</p>
          )}
          <div className="flex gap-2 pt-1">
            <Button
              type="submit"
              disabled={saving || !editTitle.trim() || !editUrl.trim()}
              className="bg-[#1DB954] hover:bg-[#1aa34a] text-white flex-1"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? 'Speichern…' : 'Speichern'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditing(false)} disabled={saving}>
              Abbrechen
            </Button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="bg-surface rounded-2xl border border-surface-border p-4 flex flex-col gap-3 hover:border-[#1DB954]/40 transition-colors group">
      {/* Header row */}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[#1DB954]/10 flex items-center justify-center">
          <Music2 className="w-6 h-6 text-[#1DB954]" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate leading-tight">{playlist.title}</h3>
          {playlist.description && (
            <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{playlist.description}</p>
          )}
        </div>
        {isOwner && (
          <div className="flex-shrink-0 flex items-center gap-1">
            <button
              onClick={startEditing}
              className={cn(
                'p-1.5 rounded-lg text-text-subtle hover:text-[#1DB954] hover:bg-[#1DB954]/10 transition-colors',
                'md:opacity-0 md:group-hover:opacity-100'
              )}
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className={cn(
                'p-1.5 rounded-lg text-text-subtle hover:text-danger hover:bg-danger-bg transition-colors',
                'md:opacity-0 md:group-hover:opacity-100'
              )}
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>

      {/* Footer row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar className="w-5 h-5">
            {playlist.user.avatarUrl && <AvatarImage src={playlist.user.avatarUrl} />}
            <AvatarFallback className="text-[8px] bg-brand-muted text-brand-600">
              {getInitials(playlist.user.name)}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-text-muted">{playlist.user.name}</span>
        </div>
        <button
          onClick={handleOpen}
          className="flex items-center gap-1.5 text-xs font-medium text-[#1DB954] hover:text-[#1aa34a] transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          In Spotify öffnen
        </button>
      </div>
    </div>
  )
}

function AddPlaylistForm({ onCreated }: { onCreated: (p: Playlist) => void }) {
  const [open, setOpen] = React.useState(false)
  const [title, setTitle] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [spotifyUrl, setSpotifyUrl] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description: description || undefined, spotifyUrl }),
      })
      const data = await res.json()
      if (!res.ok) {
        const firstError = Object.values(data.error ?? {})[0]
        setError(Array.isArray(firstError) ? firstError[0] : (data.error ?? 'Fehler'))
      } else {
        onCreated(data.playlist)
        setTitle('')
        setDescription('')
        setSpotifyUrl('')
        setOpen(false)
      }
    } catch {
      setError('Netzwerkfehler')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="bg-[#1DB954] hover:bg-[#1aa34a] text-white">
        <Plus className="w-4 h-4" />
        Playlist hinzufügen
      </Button>
    )
  }

  return (
    <div className="bg-surface rounded-2xl border border-surface-border p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Music2 className="w-4 h-4 text-[#1DB954]" />
          Neue Playlist
        </h3>
        <button onClick={() => setOpen(false)} className="p-1 rounded-lg text-text-subtle hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="pl-title">Titel</Label>
          <Input
            id="pl-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="z.B. WG Chillout Vibes"
            disabled={saving}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pl-desc">Beschreibung / Genre <span className="text-text-subtle">(optional)</span></Label>
          <Input
            id="pl-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="z.B. Chill, Indie, für den Abend"
            disabled={saving}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pl-url">Spotify-Link</Label>
          <Input
            id="pl-url"
            value={spotifyUrl}
            onChange={(e) => setSpotifyUrl(e.target.value)}
            placeholder="https://open.spotify.com/playlist/..."
            disabled={saving}
            required
            autoComplete="off"
          />
          <p className="text-[11px] text-text-subtle">
            In Spotify: Teilen → Link kopieren → hier einfügen
          </p>
        </div>
        {error && <p className="text-sm text-danger bg-danger-bg rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-2 pt-1">
          <Button
            type="submit"
            disabled={saving || !title.trim() || !spotifyUrl.trim()}
            className="bg-[#1DB954] hover:bg-[#1aa34a] text-white flex-1"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {saving ? 'Hinzufügen…' : 'Hinzufügen'}
          </Button>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Abbrechen
          </Button>
        </div>
      </form>
    </div>
  )
}

export default function PlaylistsPage() {
  const { data: session } = useSession()
  const [playlists, setPlaylists] = React.useState<Playlist[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    fetch('/api/playlists')
      .then((r) => r.json())
      .then((d) => setPlaylists(d.playlists ?? []))
      .finally(() => setLoading(false))
  }, [])

  function handleCreated(playlist: Playlist) {
    setPlaylists((prev) => [playlist, ...prev])
  }

  function handleDeleted(id: string) {
    setPlaylists((prev) => prev.filter((p) => p.id !== id))
  }

  function handleUpdated(updated: Playlist) {
    setPlaylists((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold text-foreground flex items-center gap-2"
            style={{ fontFamily: 'var(--font-syne, system-ui)' }}
          >
            <ListMusic className="w-6 h-6 text-[#1DB954]" />
            Playlists
          </h1>
          <p className="text-sm text-text-muted mt-1">Die Musik deiner WG</p>
        </div>
      </div>

      {/* Add form */}
      <AddPlaylistForm onCreated={handleCreated} />

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-surface rounded-2xl border border-surface-border p-4 flex gap-3">
              <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-60" />
              </div>
            </div>
          ))}
        </div>
      ) : playlists.length === 0 ? (
        <div className="text-center py-16 text-text-muted">
          <Music2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">Noch keine Playlists</p>
          <p className="text-sm mt-1">Füge die erste Playlist deiner WG hinzu!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {playlists.map((playlist) => (
            <PlaylistCard
              key={playlist.id}
              playlist={playlist}
              currentUserId={session?.user?.id ?? ''}
              onDelete={handleDeleted}
              onUpdate={handleUpdated}
            />
          ))}
        </div>
      )}
    </div>
  )
}
