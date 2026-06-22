'use client'

import * as React from 'react'
import { X, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

const EMOJI_OPTIONS = ['📅', '🎉', '🏠', '🛒', '🔧', '💡', '🌿', '🎂', '🎬', '🏋️', '🍕', '✈️', '🎮', '🧹', '🚿']

const COLOR_OPTIONS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
  '#64748b', '#78716c',
]

export interface CreatedWGEvent {
  id: string
  wgId: string
  createdBy: string
  title: string
  description: string | null
  startDate: string
  endDate: string | null
  allDay: boolean
  notifyWG: boolean
  color: string
  emoji: string
  creator: { id: string; name: string }
}

interface CreateEventDialogProps {
  open: boolean
  onClose: () => void
  onCreated: (event: CreatedWGEvent) => void
  initialDate?: Date | null
}

export function CreateEventDialog({ open, onClose, onCreated, initialDate }: CreateEventDialogProps) {
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')

  const [title, setTitle] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [allDay, setAllDay] = React.useState(true)
  const [startDate, setStartDate] = React.useState('')
  const [startTime, setStartTime] = React.useState('10:00')
  const [endDate, setEndDate] = React.useState('')
  const [endTime, setEndTime] = React.useState('11:00')
  const [hasEnd, setHasEnd] = React.useState(false)
  const [notifyWG, setNotifyWG] = React.useState(false)
  const [color, setColor] = React.useState(COLOR_OPTIONS[0])
  const [emoji, setEmoji] = React.useState(EMOJI_OPTIONS[0])

  React.useEffect(() => {
    if (open) {
      const base = initialDate ?? new Date()
      setStartDate(format(base, 'yyyy-MM-dd'))
      setEndDate(format(base, 'yyyy-MM-dd'))
      setTitle('')
      setDescription('')
      setAllDay(true)
      setStartTime('10:00')
      setEndTime('11:00')
      setHasEnd(false)
      setNotifyWG(false)
      setColor(COLOR_OPTIONS[0])
      setEmoji(EMOJI_OPTIONS[0])
      setError('')
    }
  }, [open, initialDate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Bitte einen Titel eingeben'); return }
    if (!startDate) { setError('Bitte ein Startdatum eingeben'); return }

    const startISO = allDay
      ? new Date(`${startDate}T00:00:00`).toISOString()
      : new Date(`${startDate}T${startTime}:00`).toISOString()

    let endISO: string | undefined
    if (hasEnd && endDate) {
      endISO = allDay
        ? new Date(`${endDate}T23:59:59`).toISOString()
        : new Date(`${endDate}T${endTime}:00`).toISOString()
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          startDate: startISO,
          endDate: endISO,
          allDay,
          notifyWG,
          color,
          emoji,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Fehler beim Erstellen'); return }
      onCreated(data.event)
      onClose()
    } catch {
      setError('Netzwerkfehler')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Neues Ereignis</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Emoji & Color preview */}
          <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
            <span
              className="flex items-center justify-center h-10 w-10 rounded-xl text-xl flex-shrink-0"
              style={{ backgroundColor: color + '22', color }}
            >
              {emoji}
            </span>
            <span className="text-sm font-medium text-gray-700 truncate">{title || 'Ereignistitel'}</span>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titel *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z.B. WG-Versammlung"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optionale Beschreibung…"
              rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
            />
          </div>

          {/* All day toggle */}
          <div className="flex items-center gap-2">
            <input
              id="allDay"
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="allDay" className="text-sm text-gray-700">Ganztägig</label>
          </div>

          {/* Start date/time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Startdatum *</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              {!allDay && (
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-28 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              )}
            </div>
          </div>

          {/* End date toggle + input */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <input
                id="hasEnd"
                type="checkbox"
                checked={hasEnd}
                onChange={(e) => setHasEnd(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="hasEnd" className="text-sm text-gray-700">Enddatum angeben</label>
            </div>
            {hasEnd && (
              <div className="flex gap-2">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                {!allDay && (
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-28 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                )}
              </div>
            )}
          </div>

          {/* Emoji picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Symbol</label>
            <div className="flex flex-wrap gap-2">
              {EMOJI_OPTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={cn(
                    'h-9 w-9 rounded-lg text-lg transition-all',
                    emoji === e
                      ? 'ring-2 ring-indigo-500 ring-offset-1 bg-indigo-50'
                      : 'bg-gray-100 hover:bg-gray-200'
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Color picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Farbe</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    'h-8 w-8 rounded-full transition-all',
                    color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-105'
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Push notification checkbox */}
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3">
            <div className="flex items-start gap-3">
              <input
                id="notifyWG"
                type="checkbox"
                checked={notifyWG}
                onChange={(e) => setNotifyWG(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="notifyWG" className="text-sm text-gray-700 cursor-pointer">
                <span className="flex items-center gap-1.5 font-medium text-indigo-700 mb-0.5">
                  <Bell className="h-3.5 w-3.5" />
                  WG-Mitglieder benachrichtigen
                </span>
                <span className="text-xs text-gray-500">
                  Sendet eine Push-Benachrichtigung bei der Erstellung und einen Tag vorher.
                </span>
              </label>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Erstelle…' : 'Ereignis erstellen'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
