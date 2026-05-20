'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, Pause, Play, RefreshCw, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { DutyForm } from '@/components/duties/duty-form'
import { getIntervalLabel } from '@/lib/utils'

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
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [editDuty, setEditDuty] = useState<Duty | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Duty | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const userRole = (session?.user as { role?: string })?.role

  useEffect(() => {
    if (session && userRole !== 'ADMIN') router.push('/dashboard')
  }, [session, userRole, router])

  const fetchDuties = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/duties')
      if (res.ok) {
        const d = await res.json()
        setDuties(d.duties ?? [])
      }
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchDuties() }, [fetchDuties])

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
      fetchDuties()
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
      fetchDuties()
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
      fetchDuties()
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
      fetchDuties()
    } catch { /* ignore */ }
  }

  async function handleRotate(duty: Duty) {
    try {
      await fetch('/api/duties/rotate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dutyId: duty.id }),
      })
      setMessage({ type: 'success', text: `Rotation für "${duty.name}" durchgeführt!` })
      fetchDuties()
    } catch { /* ignore */ }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dienste verwalten</h1>
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
                        {duty.isPaused && <Badge variant="warning" className="text-xs">Pausiert</Badge>}
                      </div>
                      {duty.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">{duty.description}</p>
                      )}
                      {duty.checklistItems.length > 0 && (
                        <p className="text-xs text-gray-400 mt-1">{duty.checklistItems.length} Checklisteneinträge</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRotate(duty)}
                      title="Rotation jetzt durchführen"
                      className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleTogglePause(duty)}
                      title={duty.isPaused ? 'Fortsetzen' : 'Pausieren'}
                    >
                      {duty.isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditDuty(duty)}
                      title="Bearbeiten"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleteTarget(duty)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                      title="Löschen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Neuen Dienst erstellen</DialogTitle>
          </DialogHeader>
          <DutyForm
            onSubmit={handleCreate as Parameters<typeof DutyForm>[0]['onSubmit']}
            isLoading={actionLoading}
            submitLabel="Dienst erstellen"
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editDuty} onOpenChange={(open) => !open && setEditDuty(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dienst bearbeiten</DialogTitle>
          </DialogHeader>
          {editDuty && (
            <DutyForm
              initialValues={{
                name: editDuty.name,
                description: editDuty.description ?? '',
                emoji: editDuty.emoji ?? '',
                color: editDuty.color,
                rotationInterval: editDuty.rotationInterval as 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'MANUAL',
                checklistItems: editDuty.checklistItems.map((v) => ({ value: v })),
              }}
              onSubmit={handleEdit as Parameters<typeof DutyForm>[0]['onSubmit']}
              isLoading={actionLoading}
              submitLabel="Änderungen speichern"
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dienst wirklich löschen?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Der Dienst <strong>{deleteTarget?.name}</strong> und alle zugehörigen Zuweisungen werden dauerhaft gelöscht.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Abbrechen</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={actionLoading}>
              {actionLoading ? 'Lösche…' : 'Löschen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
