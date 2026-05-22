'use client'

import * as React from 'react'
import { Upload, Trash2, X, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const EMOJI_OPTIONS = ['📅', '🗑️', '♻️', '🧹', '🎉', '🏠', '🛒', '📦', '🔧', '💡', '🌿', '🐾', '🚿', '🧺', '🌳']

const COLOR_OPTIONS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
  '#64748b', '#78716c',
]

interface ICalCalendar {
  id: string
  name: string
  color: string
  emoji: string
  _count: { events: number }
}

interface ICalImportDialogProps {
  open: boolean
  onClose: () => void
  onImported: () => void
}

export function ICalImportDialog({ open, onClose, onImported }: ICalImportDialogProps) {
  const [calendars, setCalendars] = React.useState<ICalCalendar[]>([])
  const [loading, setLoading] = React.useState(false)
  const [deleting, setDeleting] = React.useState<string | null>(null)
  const [error, setError] = React.useState('')
  const [success, setSuccess] = React.useState('')

  const [name, setName] = React.useState('')
  const [color, setColor] = React.useState(COLOR_OPTIONS[0])
  const [emoji, setEmoji] = React.useState(EMOJI_OPTIONS[0])
  const [fileContent, setFileContent] = React.useState<string | null>(null)
  const [fileName, setFileName] = React.useState('')
  const fileRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (open) {
      fetchCalendars()
      resetForm()
    }
  }, [open])

  async function fetchCalendars() {
    try {
      const res = await fetch('/api/ical')
      const data = await res.json()
      setCalendars(data.calendars ?? [])
    } catch {
      // silent
    }
  }

  function resetForm() {
    setName('')
    setColor(COLOR_OPTIONS[0])
    setEmoji(EMOJI_OPTIONS[0])
    setFileContent(null)
    setFileName('')
    setError('')
    setSuccess('')
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    if (!name) setName(file.name.replace(/\.ics$/i, ''))
    const reader = new FileReader()
    reader.onload = (ev) => setFileContent(ev.target?.result as string)
    reader.readAsText(file)
  }

  async function handleImport() {
    if (!fileContent) { setError('Bitte eine .ics-Datei auswählen'); return }
    if (!name.trim()) { setError('Bitte einen Namen eingeben'); return }
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/ical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), color, emoji, icsContent: fileContent }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Fehler beim Importieren'); return }
      setSuccess(`${data.calendar._count.events} Ereignisse importiert!`)
      resetForm()
      if (fileRef.current) fileRef.current.value = ''
      await fetchCalendars()
      onImported()
    } catch {
      setError('Netzwerkfehler')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      await fetch(`/api/ical/${id}`, { method: 'DELETE' })
      await fetchCalendars()
      onImported()
    } finally {
      setDeleting(null)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold text-gray-900">iCal-Kalender importieren</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Existing calendars */}
          {calendars.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Importierte Kalender</p>
              {calendars.map((cal) => (
                <div key={cal.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
                  <span
                    className="flex items-center justify-center h-9 w-9 rounded-lg text-lg flex-shrink-0"
                    style={{ backgroundColor: cal.color + '22', color: cal.color }}
                  >
                    {cal.emoji}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{cal.name}</p>
                    <p className="text-xs text-gray-400">{cal.color} · {cal.emoji} · {cal._count.events} Ereignisse</p>
                  </div>
                  <button
                    onClick={() => handleDelete(cal.id)}
                    disabled={deleting === cal.id}
                    className="text-gray-300 hover:text-red-400 transition-colors disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Import form */}
          <div className="space-y-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Neuen Kalender importieren</p>

            {/* File upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">iCal-Datei (.ics)</label>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed transition-colors text-sm',
                  fileContent
                    ? 'border-green-300 bg-green-50 text-green-700'
                    : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-indigo-300 hover:bg-indigo-50'
                )}
              >
                {fileContent ? <Check className="h-4 w-4 flex-shrink-0" /> : <Upload className="h-4 w-4 flex-shrink-0" />}
                <span className="truncate">{fileName || 'Datei auswählen…'}</span>
              </button>
              <input ref={fileRef} type="file" accept=".ics" className="hidden" onChange={handleFileChange} />
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z.B. Müllkalender"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
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

            {/* Preview */}
            <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 border border-gray-100">
              <span
                className="flex items-center justify-center h-8 w-8 rounded-lg text-base flex-shrink-0"
                style={{ backgroundColor: color + '22', color }}
              >
                {emoji}
              </span>
              <span className="text-sm font-medium text-gray-700">{name || 'Kalendername'}</span>
              <span
                className="ml-auto h-2.5 w-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-green-600">{success}</p>}

            <Button
              onClick={handleImport}
              disabled={loading || !fileContent}
              className="w-full"
            >
              {loading ? 'Importiere…' : 'Kalender importieren'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
