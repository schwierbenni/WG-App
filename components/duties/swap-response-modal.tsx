'use client'

import * as React from 'react'
import { ArrowLeftRight, Check, X, Clock } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { getInitials, formatDate } from '@/lib/utils'

interface SimpleUser {
  id: string
  name: string
  email: string
  avatarUrl?: string | null
}

interface SwapRequestDetail {
  id: string
  status: string
  fromUser: SimpleUser
  toUser: SimpleUser
  assignment: {
    id: string
    dueDate: string
    duty: { id: string; name: string; emoji?: string | null; color: string }
  }
}

interface Props {
  swapId: string
  onClose: () => void
  onSuccess: () => void
}

export function SwapResponseModal({ swapId, onClose, onSuccess }: Props) {
  const [swap, setSwap] = React.useState<SwapRequestDetail | null>(null)
  const [loadError, setLoadError] = React.useState('')
  const [loading, setLoading] = React.useState(true)
  const [message, setMessage] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [actionError, setActionError] = React.useState('')

  React.useEffect(() => {
    fetch(`/api/swap-requests/${swapId}`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) {
          setLoadError(data.error ?? 'Tauschangfrage nicht gefunden.')
        } else {
          setSwap(data.swapRequest)
          if (data.swapRequest.status !== 'PENDING') {
            setLoadError('Diese Tauschangfrage ist nicht mehr offen.')
          }
        }
      })
      .catch(() => setLoadError('Verbindungsfehler. Bitte erneut versuchen.'))
      .finally(() => setLoading(false))
  }, [swapId])

  async function handleAction(action: 'accept' | 'reject') {
    setSubmitting(true)
    setActionError('')
    try {
      const res = await fetch(`/api/swap-requests/${swapId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, message: message.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setActionError(data.error ?? 'Fehler beim Verarbeiten der Anfrage.')
      } else {
        onSuccess()
      }
    } catch {
      setActionError('Netzwerkfehler. Bitte erneut versuchen.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(isOpen: boolean) => { if (!isOpen) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-indigo-600" />
            Tauschangfrage
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ) : loadError ? (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {loadError}
          </div>
        ) : swap ? (
          <div className="space-y-4">
            {/* Requester info */}
            <div className="flex items-center gap-3 rounded-lg bg-indigo-50 border border-indigo-100 p-3">
              <Avatar className="h-10 w-10 shrink-0">
                {swap.fromUser.avatarUrl && (
                  <AvatarImage src={swap.fromUser.avatarUrl} alt={swap.fromUser.name} />
                )}
                <AvatarFallback className="text-sm bg-indigo-100 text-indigo-700">
                  {getInitials(swap.fromUser.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">{swap.fromUser.name}</p>
                <p className="text-xs text-indigo-600">möchte einen Dienst mit dir tauschen</p>
              </div>
            </div>

            {/* Duty details */}
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 space-y-1">
              <p className="text-xs font-medium text-gray-500 flex items-center gap-1">
                <Clock className="h-3 w-3" /> Dienst
              </p>
              <p className="font-medium text-gray-900 text-sm">
                {swap.assignment.duty.emoji && (
                  <span className="mr-1">{swap.assignment.duty.emoji}</span>
                )}
                {swap.assignment.duty.name}
              </p>
              <p className="text-xs text-gray-500">
                Fällig: {formatDate(swap.assignment.dueDate)}
              </p>
            </div>

            {/* Optional message/reason */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Begründung <span className="text-gray-400">(optional)</span>
              </label>
              <textarea
                value={message}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
                placeholder="z.B. Ich bin an dem Tag verhindert…"
                maxLength={500}
                rows={2}
                disabled={submitting}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              />
            </div>

            {actionError && (
              <p className="text-sm text-red-600 bg-red-50 rounded p-2">{actionError}</p>
            )}
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={submitting}
            className="flex-1"
          >
            Schließen
          </Button>
          {swap && !loadError && (
            <>
              <Button
                variant="outline"
                onClick={() => handleAction('reject')}
                disabled={submitting}
                className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
              >
                <X className="h-4 w-4 mr-1" />
                {submitting ? '…' : 'Ablehnen'}
              </Button>
              <Button
                onClick={() => handleAction('accept')}
                disabled={submitting}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                <Check className="h-4 w-4 mr-1" />
                {submitting ? '…' : 'Annehmen'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
