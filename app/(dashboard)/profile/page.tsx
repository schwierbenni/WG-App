'use client'

import * as React from 'react'
import { useSession, signOut } from 'next-auth/react'
import { User, Bell, Trash2, KeyRound, Save, AlertTriangle, Upload, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, getInitials, formatDate } from '@/lib/utils'
import { PushNotificationToggle } from '@/components/push-notification-toggle'

interface UserProfile {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  role: string
  emailNotifications: boolean
  createdAt: string
}

export default function ProfilePage() {
  const { data: session, update: updateSession } = useSession()
  const [profile, setProfile] = React.useState<UserProfile | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')

  const [name, setName] = React.useState('')
  const [avatarUrl, setAvatarUrl] = React.useState('')
  const [emailNotifications, setEmailNotifications] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [saveError, setSaveError] = React.useState('')
  const [saveSuccess, setSaveSuccess] = React.useState(false)

  const [uploadingAvatar, setUploadingAvatar] = React.useState(false)
  const [uploadError, setUploadError] = React.useState('')
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false)
  const [deleteConfirm, setDeleteConfirm] = React.useState('')
  const [deleting, setDeleting] = React.useState(false)
  const [deleteError, setDeleteError] = React.useState('')

  const [currentPassword, setCurrentPassword] = React.useState('')
  const [newPassword, setNewPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [changingPassword, setChangingPassword] = React.useState(false)
  const [passwordError, setPasswordError] = React.useState('')
  const [passwordSuccess, setPasswordSuccess] = React.useState(false)

  const fetchProfile = React.useCallback(async () => {
    if (!session?.user?.id) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/users/${session.user.id}`)
      if (!res.ok) throw new Error('Profil konnte nicht geladen werden')
      const data = await res.json()
      const user: UserProfile = data.user
      setProfile(user)
      setName(user.name)
      setAvatarUrl(user.avatarUrl ?? '')
      setEmailNotifications(user.emailNotifications)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }, [session?.user?.id])

  React.useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    setUploadError('')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/upload/avatar', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) {
        setUploadError(data.error ?? 'Upload fehlgeschlagen.')
      } else {
        setAvatarUrl(data.avatarUrl)
        setProfile((p) => p ? { ...p, avatarUrl: data.avatarUrl } : p)
        await updateSession({ image: data.avatarUrl })
      }
    } catch {
      setUploadError('Netzwerkfehler beim Upload.')
    } finally {
      setUploadingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRemoveAvatar = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/users/${profile!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarUrl: null }),
      })
      if (res.ok) {
        setAvatarUrl('')
        setProfile((p) => p ? { ...p, avatarUrl: null } : p)
        await updateSession({ image: null })
      }
    } catch { /* ignore */ } finally {
      setSaving(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setSaving(true)
    setSaveError('')
    setSaveSuccess(false)
    try {
      const body: Record<string, unknown> = { name }
      body.avatarUrl = avatarUrl.trim() || null
      body.emailNotifications = emailNotifications

      const res = await fetch(`/api/users/${profile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setSaveError(data.error ?? 'Fehler beim Speichern')
      } else {
        setProfile(data.user)
        setSaveSuccess(true)
        await updateSession({ name: data.user.name, image: data.user.avatarUrl })
        setTimeout(() => setSaveSuccess(false), 3000)
      }
    } catch {
      setSaveError('Netzwerkfehler. Bitte erneut versuchen.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!profile || deleteConfirm !== profile.name) return
    setDeleting(true)
    setDeleteError('')
    try {
      const res = await fetch(`/api/users/${profile.id}`, { method: 'DELETE' })
      if (res.ok || res.status === 204) {
        await signOut({ callbackUrl: '/login' })
      } else {
        const data = await res.json()
        setDeleteError(data.error ?? 'Fehler beim Löschen')
      }
    } catch {
      setDeleteError('Netzwerkfehler. Bitte erneut versuchen.')
    } finally {
      setDeleting(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess(false)
    if (newPassword !== confirmPassword) {
      setPasswordError('Die neuen Passwörter stimmen nicht überein.')
      return
    }
    if (newPassword.length < 8) {
      setPasswordError('Das neue Passwort muss mindestens 8 Zeichen lang sein.')
      return
    }
    setChangingPassword(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPasswordError(data.error ?? 'Fehler beim Ändern des Passworts')
      } else {
        setPasswordSuccess(true)
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setTimeout(() => setPasswordSuccess(false), 3000)
      }
    } catch {
      setPasswordError('Netzwerkfehler. Bitte erneut versuchen.')
    } finally {
      setChangingPassword(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-48 mt-1" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6 space-y-4">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      </div>
    )
  }

  if (!profile) return null

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mein Profil</h1>
        <p className="text-sm text-gray-500 mt-1">Konto und Einstellungen verwalten</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              {profile.avatarUrl && (
                <AvatarImage src={profile.avatarUrl} alt={profile.name} />
              )}
              <AvatarFallback className="text-xl bg-indigo-100 text-indigo-700">
                {getInitials(profile.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{profile.name}</h2>
              <p className="text-sm text-gray-500">{profile.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  className={
                    profile.role === 'ADMIN'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-gray-100 text-gray-600'
                  }
                >
                  {profile.role === 'ADMIN' ? 'Admin' : 'Mitglied'}
                </Badge>
                <span className="text-xs text-gray-400">
                  Seit {formatDate(profile.createdAt)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-5 w-5 text-indigo-500" />
            Profil bearbeiten
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="profile-name">Name</Label>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dein Name"
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label>Profilbild</Label>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Avatar className="h-16 w-16">
                    {avatarUrl && <AvatarImage src={avatarUrl} alt="Vorschau" />}
                    <AvatarFallback className="text-lg bg-indigo-100 text-indigo-700">
                      {getInitials(name || profile.name)}
                    </AvatarFallback>
                  </Avatar>
                  {uploadingAvatar && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                      <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={handleAvatarUpload}
                    disabled={uploadingAvatar || saving}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingAvatar || saving}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {uploadingAvatar ? 'Wird hochgeladen…' : 'Bild hochladen'}
                  </Button>
                  {avatarUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      disabled={saving}
                      onClick={handleRemoveAvatar}
                    >
                      <X className="h-3.5 w-3.5" />
                      Bild entfernen
                    </Button>
                  )}
                  <p className="text-xs text-gray-400">JPEG, PNG, WebP oder GIF · max. 2 MB</p>
                </div>
              </div>
              {uploadError && (
                <p className="text-sm text-red-600 bg-red-50 rounded p-2">{uploadError}</p>
              )}
            </div>

            <Separator />

            <PushNotificationToggle />

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-indigo-500" />
                <div>
                  <Label htmlFor="email-notifications" className="cursor-pointer">
                    E-Mail-Benachrichtigungen
                  </Label>
                  <p className="text-xs text-gray-400">
                    Benachrichtigungen über Dienste und Ankündigungen
                  </p>
                </div>
              </div>
              <button
                id="email-notifications"
                type="button"
                role="switch"
                aria-checked={emailNotifications}
                onClick={() => setEmailNotifications((v) => !v)}
                disabled={saving}
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50',
                  emailNotifications ? 'bg-indigo-600' : 'bg-gray-200'
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transition-transform',
                    emailNotifications ? 'translate-x-5' : 'translate-x-0'
                  )}
                />
              </button>
            </div>

            {saveError && (
              <p className="text-sm text-red-600 bg-red-50 rounded p-2">{saveError}</p>
            )}
            {saveSuccess && (
              <p className="text-sm text-green-600 bg-green-50 rounded p-2">
                Profil erfolgreich gespeichert!
              </p>
            )}

            <Button type="submit" disabled={saving || !name.trim()}>
              <Save className="h-4 w-4" />
              {saving ? 'Speichern...' : 'Speichern'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-indigo-500" />
            Passwort ändern
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="current-password">Aktuelles Passwort</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                disabled={changingPassword}
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-password">Neues Passwort</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mindestens 8 Zeichen"
                disabled={changingPassword}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirm-password">Passwort bestätigen</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                disabled={changingPassword}
                autoComplete="new-password"
              />
            </div>
            {passwordError && (
              <p className="text-sm text-red-600 bg-red-50 rounded p-2">{passwordError}</p>
            )}
            {passwordSuccess && (
              <p className="text-sm text-green-600 bg-green-50 rounded p-2">
                Passwort erfolgreich geändert!
              </p>
            )}
            <Button
              type="submit"
              variant="outline"
              disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
            >
              <KeyRound className="h-4 w-4" />
              {changingPassword ? 'Ändern...' : 'Passwort ändern'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Gefahrenzone
          </CardTitle>
          <CardDescription>
            Diese Aktionen können nicht rükgängig gemacht werden.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg border border-red-200 bg-red-50">
            <div>
              <p className="text-sm font-medium text-red-800">Konto löschen</p>
              <p className="text-xs text-red-600 mt-0.5">
                Dein Konto und alle zugehörigen Daten werden dauerhaft gelöscht.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4" />
              Löschen
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Konto wirklich löschen?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-600">
              Diese Aktion ist <strong>unwiderruflich</strong>. Alle deine Daten werden
              dauerhaft gelöscht.
            </p>
            <div className="space-y-1">
              <Label htmlFor="delete-confirm">
                Gib deinen Namen ein um zu bestätigen:{' '}
                <span className="font-semibold">{profile.name}</span>
              </Label>
              <Input
                id="delete-confirm"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={profile.name}
                disabled={deleting}
              />
            </div>
            {deleteError && (
              <p className="text-sm text-red-600 bg-red-50 rounded p-2">{deleteError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false)
                setDeleteConfirm('')
                setDeleteError('')
              }}
              disabled={deleting}
            >
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting || deleteConfirm !== profile.name}
            >
              {deleting ? 'Löschen...' : 'Endgültig löschen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
