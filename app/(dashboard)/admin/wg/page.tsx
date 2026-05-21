'use client'

import * as React from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Settings, Link as LinkIcon, Copy, Check, Save, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export default function WgSettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [wgName, setWgName] = React.useState('')
  const [nameInput, setNameInput] = React.useState('')
  const [savingName, setSavingName] = React.useState(false)
  const [nameError, setNameError] = React.useState('')
  const [nameSaved, setNameSaved] = React.useState(false)

  const [inviteLink, setInviteLink] = React.useState('')
  const [generatingLink, setGeneratingLink] = React.useState(false)
  const [copied, setCopied] = React.useState(false)

  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    if (status === 'loading') return
    if (!session || session.user.role !== 'ADMIN') {
      router.replace('/dashboard')
    }
  }, [session, status, router])

  React.useEffect(() => {
    if (session?.user?.role !== 'ADMIN') return
    setLoading(true)
    fetch('/api/wg')
      .then((r) => r.json())
      .then((data) => {
        if (data.wg) {
          setWgName(data.wg.name)
          setNameInput(data.wg.name)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [session])

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault()
    if (!nameInput.trim()) return
    setSavingName(true)
    setNameError('')
    setNameSaved(false)
    try {
      const res = await fetch('/api/wg', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameInput.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setWgName(data.wg.name)
        setNameSaved(true)
        setTimeout(() => setNameSaved(false), 2500)
      } else {
        setNameError(data.error ?? 'Fehler beim Speichern')
      }
    } finally {
      setSavingName(false)
    }
  }

  async function handleGenerateInvite() {
    setGeneratingLink(true)
    try {
      const res = await fetch('/api/invite')
      if (res.ok) {
        const data = await res.json()
        setInviteLink(data.url)
      }
    } finally {
      setGeneratingLink(false)
    }
  }

  async function handleCopy() {
    if (!inviteLink) return
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  if (status === 'loading' || (session && session.user.role !== 'ADMIN')) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <Settings className="h-6 w-6 text-indigo-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">WG-Einstellungen</h1>
          <p className="text-sm text-gray-500">WG konfigurieren und Mitglieder einladen</p>
        </div>
      </div>

      {/* WG Name */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Name der WG</CardTitle>
          <CardDescription>
            Dieser Name wird im Navigationsmenü für alle Mitglieder angezeigt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-10 w-full animate-pulse rounded-md bg-gray-100" />
          ) : (
            <form onSubmit={handleSaveName} className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label htmlFor="wg-name" className="sr-only">WG-Name</Label>
                <Input
                  id="wg-name"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Name der WG"
                  maxLength={100}
                />
                {nameError && <p className="text-xs text-red-600">{nameError}</p>}
              </div>
              <Button
                type="submit"
                disabled={savingName || nameInput.trim() === wgName || !nameInput.trim()}
              >
                {savingName ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : nameSaved ? (
                  <Check className={cn('h-4 w-4 text-green-500')} />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {nameSaved ? 'Gespeichert' : 'Speichern'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Invite */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <LinkIcon className="h-5 w-5 text-indigo-500" />
            Mitglied einladen
          </CardTitle>
          <CardDescription>
            Generiere einen Einladungslink (gültig für 7 Tage). Jeder Link kann nur einmal verwendet werden.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" onClick={handleGenerateInvite} disabled={generatingLink}>
            <LinkIcon className="h-4 w-4" />
            {generatingLink ? 'Generiere…' : 'Einladungslink generieren'}
          </Button>

          {inviteLink && (
            <div className="space-y-2">
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
              {copied && <p className="text-xs text-green-600">Link in die Zwischenablage kopiert!</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
