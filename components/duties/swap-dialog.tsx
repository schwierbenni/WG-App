'use client'

import * as React from 'react'
import { useSession } from 'next-auth/react'
import { ArrowLeftRight, Check, X, Clock } from 'lucide-react'
import {
  ResponsiveModalRoot,
  ResponsiveModalTrigger,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalFooter,
} from '@/components/ui/responsive-modal'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getInitials, formatDate } from '@/lib/utils'

interface SimpleUser {
  id: string
  name: string
  email: string
  avatarUrl?: string | null
}

interface SwapRequestItem {
  id: string
  status: string
  createdAt: string
  fromUser: SimpleUser
  toUser: SimpleUser
  assignment: {
    id: string
    dueDate: string
    duty: { id: string; name: string; emoji?: string | null; color: string }
  }
}

interface SwapDialogProps {
  assignmentId: string
  dutyName: string
  dutyEmoji?: string | null
  dueDate: string
  members: SimpleUser[]
  trigger?: React.ReactNode
  onSuccess?: () => void
}

export function SwapDialog({ assignmentId, dutyName, dutyEmoji, dueDate, members, trigger, onSuccess }: SwapDialogProps) {
  const { data: session } = useSession()
  const [open, setOpen] = React.useState(false)
  const [selectedUserId, setSelectedUserId] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')
  const [success, setSuccess] = React.useState(false)
  const [incomingRequests, setIncomingRequests] = React.useState<SwapRequestItem[]>([])
  const [loadingRequests, setLoadingRequests] = React.useState(false)
  const [actionLoading, setActionLoading] = React.useState<string | null>(null)

  const otherMembers = members.filter((m) => m.id !== session?.user?.id)

  const fetchIncoming = React.useCallback(async () => {
    setLoadingRequests(true)
    try {
      const res = await fetch('/api/swap-requests?direction=received')
      if (res.ok) {
        const data = await res.json()
        setIncomingRequests((data.swapRequests as SwapRequestItem[]).filter((r) => r.status === 'PENDING'))
      }
    } catch { /* ignore */ } finally {
      setLoadingRequests(false)
    }
  }, [])

  React.useEffect(() => { if (open) fetchIncoming() }, [open, fetchIncoming])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUserId) { setError('Bitte wähle ein Mitglied aus.'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/swap-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toUserId: selectedUserId, assignmentId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Fehler beim Senden der Anfrage.')
      } else {
        setSuccess(true)
        onSuccess?.()
        setTimeout(() => { setOpen(false); setSuccess(false); setSelectedUserId('') }, 1500)
      }
    } catch {
      setError('Netzwerkfehler. Bitte erneut versuchen.')
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (requestId: string, action: 'accept' | 'reject') => {
    setActionLoading(requestId + action)
    try {
      const res = await fetch(`/api/swap-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (res.ok) { setIncomingRequests((prev) => prev.filter((r) => r.id !== requestId)); onSuccess?.() }
    } catch { /* ignore */ } finally {
      setActionLoading(null)
    }
  }

  return (
    <ResponsiveModalRoot open={open} onOpenChange={setOpen}>
      <ResponsiveModalTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="min-h-[44px]">
            <ArrowLeftRight className="h-4 w-4 mr-1" />Dienst tauschen
          </Button>
        )}
      </ResponsiveModalTrigger>
      <ResponsiveModalContent className="sm:max-w-md">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-indigo-600" />Dienst tauschen
          </ResponsiveModalTitle>
        </ResponsiveModalHeader>

        <div className="space-y-5">
          <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3">
            <p className="text-xs text-indigo-500 font-medium mb-1">Mein Dienst</p>
            <p className="font-medium text-gray-900">
              {dutyEmoji && <span className="mr-1">{dutyEmoji}</span>}{dutyName}
            </p>
            <p className="text-sm text-gray-500">Fällig: {formatDate(dueDate)}</p>
          </div>

          {success ? (
            <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 p-3 text-green-700">
              <Check className="h-4 w-4" />
              <span className="text-sm font-medium">Tauschangfrage gesendet!</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tauschen mit</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full rounded-xl border-2 border-surface-border bg-white px-3 py-3 text-base focus:outline-none focus:border-brand-600"
                >
                  <option value="">Mitglied auswählen...</option>
                  {otherMembers.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl p-2">{error}</p>}
              <ResponsiveModalFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading} className="min-h-[44px]">Abbrechen</Button>
                <Button type="submit" disabled={loading || !selectedUserId} className="min-h-[44px]">
                  {loading ? 'Sende...' : 'Anfrage senden'}
                </Button>
              </ResponsiveModalFooter>
            </form>
          )}

          {!loadingRequests && incomingRequests.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                <Clock className="h-4 w-4 text-amber-500" />
                Eingehende Tauschangfragen ({incomingRequests.length})
              </p>
              <div className="space-y-2">
                {incomingRequests.map((req) => (
                  <div key={req.id} className="rounded-xl border border-gray-200 p-3 flex items-start gap-3">
                    <Avatar className="h-8 w-8 shrink-0">
                      {req.fromUser.avatarUrl && <AvatarImage src={req.fromUser.avatarUrl} alt={req.fromUser.name} />}
                      <AvatarFallback className="text-xs">{getInitials(req.fromUser.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{req.fromUser.name}</p>
                      <p className="text-xs text-gray-500">
                        möchte{' '}
                        <span className="font-medium">
                          {req.assignment.duty.emoji && <span className="mr-0.5">{req.assignment.duty.emoji}</span>}
                          {req.assignment.duty.name}
                        </span>{' '}tauschen
                      </p>
                      <p className="text-xs text-gray-400">Fällig: {formatDate(req.assignment.dueDate)}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="ghost" className="h-10 w-10 text-green-600 hover:bg-green-50" disabled={actionLoading === req.id + 'accept'} onClick={() => handleAction(req.id, 'accept')} title="Annehmen">
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-10 w-10 text-red-600 hover:bg-red-50" disabled={actionLoading === req.id + 'reject'} onClick={() => handleAction(req.id, 'reject')} title="Ablehnen">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ResponsiveModalContent>
    </ResponsiveModalRoot>
  )
}
