'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, Pause, Play, RefreshCw, AlertCircle, UserPlus, MoreVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ResponsiveModalRoot,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalFooter,
} from '@/components/ui/responsive-modal'
import { DutyForm } from '@/components/duties/duty-form'
import { getIntervalLabel } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Member {
  id: string
  name: string
  email: string
}

interface Duty {
  id: string
  name: string
  description?: string | null
  emoji?: string | null
  color: string
  rotationInterval: string
  isActive: boolean
  isPaused: boolean
  checklistItems: string[]
  rotationOrder: string[]
}

export default function AdminDutiesPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [duties, setDuties] = useState<Duty[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [editDuty, setEditDuty] = useState<Duty | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Duty | null>(null)
  const [assignTarget, setAssignTarget] = useState<Duty | null>(null)
  const [assignUserId, setAssignUserId] = useState('')
  const [assignDueDate, setAssignDueDate] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const userRole = (session?.user as { role?: string })?.role

  useEffect(() => {
    if (session && userRole !== 'ADMIN') router.push('/dashboard')
  }, [session, userRole, router])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [dutiesRes, usersRes] = await Promise.all([
        fetch('/api/duties'),
        fetch('/api/users'),
      ])
      if (dutiesRes.ok) {
        const d = await dutiesRes.json()
        setDuties(d.duties ?? [])
      }
      if (usersRes.ok) {
        const u = await usersRes.json()
        setMembers(u.users ?? [])
      }
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function handleCreate(values: Record<string, unknown>) {
    setActionLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/duties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (!res.ok) {
        const d = await res.json()
        setMessage({ type: 'error', text: d.error ?? 'Fehler beim Erstellen' })
        return
      }
      setCreateOpen(false)
      setMessage({ type: 'success', text: 'Dienst erfolgreich erstellt!' })
      fetchAll()
    } catch {
      setMessage({ type: 'error', text: 'Netzwerkfehler.' })
    } finally {
      setActionLoading(false)
    }
  }

  async function handleEdit(values: Record<string, unknown>) {
    if (!editDuty) return
    setActionLoading(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/duties/${editDuty.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (!res.ok) {
        const d = await res.json()
        setMessage({ type: 'error', text: d.error ?? 'Fehler beim Bearbeiten' })
        return
      }
      setEditDuty(null)
      setMessage({ type: 'success', text: 'Dienst aktualisiert!' })
      fetchAll()
    } catch {
      setMessage({ type: 'error', text: 'Netzwerkfehler.' })
    } finally {
      setActionLoading(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setActionLoading(true)
    try {
      await fetch(`/api/duties/${deleteTarget.id}`, { method: 'DELETE' })
      setDeleteTarget(null)
      fetchAll()
    } catch { /* ignore */ } finally {
      setActionLoading(false)
    }
  }

  async function handleTogglePause(duty: Duty) {
    try {
      await fetch(`/api/duties/${duty.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPaused: !duty.isPaused }),
      })
      fetchAll()
    } catch { /* ignore */ }
  }

  async function handleRotate(duty: Duty) {
    try {
      const res = await fetch('/api/duties/rotate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dutyId: duty.id }),
      })
      if (!res.ok) {
        const d = await res.json()
        setMessage({ type: 'error', text: d.error ?? 'Rotation fehlgeschlagen' })
      } else {
        setMessage({ type: 'success', text: `Rotation für "${duty.name}" durchgeführt!` })
        fetchAll()
      }
    } catch { /* ignore */ }
  }

  async function handleAssign() {
    if (!assignTarget || !assignUserId || !assignDueDate) return
    setActionLoading(true)
    try {
      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dutyId: assignTarget.id,
          userId: assignUserId,
          dueDate: new Date(assignDueDate).toISOString(),
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setMessage({ type: 'error', text: d.error ?? 'Zuweisung fehlgeschlagen' })
      } else {
        setAssignTarget(null)
        setAssignUserId('')
        setAssignDueDate('')
        setMessage({ type: 'success', text: `Dienst "${assignTarget.name}" erfolgreich zugewiesen!` })
        fetchAll()
      }
    } catch {
      setMessage({ type: 'error', text: 'Netzwerkfehler.' })
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dienstverwaltung</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Erstelle und bearbeite WG-Dienste</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Neuer Dienst
        </Button>
      </div>

      {message && (
        <div className={`flex items-start gap-2 rounded-lg p-3 text-sm ${
          message.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-700'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
        </div>
      ) : duties.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-400">Noch keine Dienste vorhanden. Erstelle den ersten!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {duties.map((duty) => (
            <Card key={duty.id} className={duty.isPaused ? 'opacity-60' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className="h-10 w-10 rounded-lg flex items-center justify-center text-xl shrink-0"
                      style={{ backgroundColor: duty.color + '33', borderLeft: `4px solid ${duty.color}` }}
                    >
                      {duty.emoji ?? '📋'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">{duty.name}</h3>
                        <Badge variant="secondary" className="text-xs">{getIntervalLabel(duty.rotationInterval)}</Badge>
                        {duty.isPaused && <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">Pausiert</Badge>}
                      </div>
                      {duty.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">{duty.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1">
                        {duty.checklistItems.length > 0 && (
                          <p className="text-xs text-gray-400">{duty.checklistItems.length} Checklisteneinträge</p>
                        )}
                        {duty.rotationOrder.length > 0 && (
                          <p className="text-xs text-gray-400">{duty.rotationOrder.length} Mitglieder in Rotation</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Desktop: inline buttons | Mobile: dropdown menu */}
                  <div className="hidden sm:flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => { setAssignTarget(duty); setAssignUserId(''); setAssignDueDate('') }} title="Manuell zuweisen" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                      <UserPlus className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleRotate(duty)} title="Rotation" className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleTogglePause(duty)} title={duty.isPaused ? 'Fortsetzen' : 'Pausieren'}>
                      {duty.isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditDuty(duty)} title="Bearbeiten">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(duty)} className="text-red-500 hover:text-red-700 hover:bg-red-50" title="Löschen">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="sm:hidden shrink-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-10 w-10">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setAssignTarget(duty); setAssignUserId(''); setAssignDueDate('') }}>
                          <UserPlus className="h-4 w-4 mr-2" /> Zuweisen
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleRotate(duty)}>
                          <RefreshCw className="h-4 w-4 mr-2" /> Rotation
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleTogglePause(duty)}>
                          {duty.isPaused ? <Play className="h-4 w-4 mr-2" /> : <Pause className="h-4 w-4 mr-2" />}
                          {duty.isPaused ? 'Fortsetzen' : 'Pausieren'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditDuty(duty)}>
                          <Pencil className="h-4 w-4 mr-2" /> Bearbeiten
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDeleteTarget(duty)} className="text-red-600 focus:text-red-600">
                          <Trash2 className="h-4 w-4 mr-2" /> Löschen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ResponsiveModalRoot open={createOpen} onOpenChange={setCreateOpen}>
        <ResponsiveModalContent className="sm:max-w-2xl">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>Neuen Dienst erstellen</ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <DutyForm
            members={members}
            onSubmit={handleCreate as Parameters<typeof DutyForm>[0]['onSubmit']}
            onCancel={() => setCreateOpen(false)}
            isLoading={actionLoading}
            submitLabel="Dienst erstellen"
          />
        </ResponsiveModalContent>
      </ResponsiveModalRoot>

      <ResponsiveModalRoot open={!!editDuty} onOpenChange={(open) => !open && setEditDuty(null)}>
        <ResponsiveModalContent className="sm:max-w-2xl">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>Dienst bearbeiten</ResponsiveModalTitle>
          </ResponsiveModalHeader>
          {editDuty && (
            <DutyForm
              members={members}
              initialRotationOrder={editDuty.rotationOrder}
              initialValues={{
                name: editDuty.name,
                description: editDuty.description ?? '',
                emoji: editDuty.emoji ?? '',
                color: editDuty.color,
                rotationInterval: editDuty.rotationInterval as 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'MANUAL',
                checklistItems: editDuty.checklistItems.map((v) => ({ value: v })),
              }}
              onSubmit={handleEdit as Parameters<typeof DutyForm>[0]['onSubmit']}
              onCancel={() => setEditDuty(null)}
              isLoading={actionLoading}
              submitLabel="Änderungen speichern"
            />
          )}
        </ResponsiveModalContent>
      </ResponsiveModalRoot>

      <ResponsiveModalRoot open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <ResponsiveModalContent className="sm:max-w-md">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>Dienst wirklich löschen?</ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Der Dienst <strong>{deleteTarget?.name}</strong> und alle zugehörigen Zuweisungen werden dauerhaft gelöscht.
          </p>
          <ResponsiveModalFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="min-h-[44px]">Abbrechen</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={actionLoading} className="min-h-[44px]">
              {actionLoading ? 'Lösche…' : 'Löschen'}
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModalRoot>

      <ResponsiveModalRoot open={!!assignTarget} onOpenChange={(open) => !open && setAssignTarget(null)}>
        <ResponsiveModalContent className="sm:max-w-md">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>
              {assignTarget?.emoji} {assignTarget?.name} — Manuell zuweisen
            </ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="assign-user">Mitglied</Label>
              <select
                id="assign-user"
                value={assignUserId}
                onChange={(e) => setAssignUserId(e.target.value)}
                className="flex h-10 w-full rounded-xl border-2 border-surface-border bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">— Mitglied auswählen —</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assign-date">Fälligkeitsdatum</Label>
              <Input
                id="assign-date"
                type="date"
                value={assignDueDate}
                onChange={(e) => setAssignDueDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>
          <ResponsiveModalFooter>
            <Button variant="outline" onClick={() => setAssignTarget(null)} className="min-h-[44px]">Abbrechen</Button>
            <Button
              onClick={handleAssign}
              disabled={actionLoading || !assignUserId || !assignDueDate}
              className="min-h-[44px]"
            >
              {actionLoading ? 'Weise zu…' : 'Zuweisen'}
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModalRoot>
    </div>
  )
}
