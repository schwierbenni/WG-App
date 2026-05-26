'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { Dices, ArrowLeft, CheckCircle2, AlertCircle, Pencil, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { calculateDebts, type Debt } from '@/lib/games'
import { getInitials } from '@/lib/utils'

type Step = 'select-game' | 'setup' | 'confirm' | 'success'
type GameType = 'SKAT' | 'DOPPELKOPF'

interface WgUser {
  id: string
  name: string
  avatarUrl: string | null
}

interface GameResultUser {
  id: string
  name: string
}

interface GameResultRow {
  id: string
  userId: string
  points: number
  user: GameResultUser
}

interface GameSession {
  id: string
  gameType: GameType
  multiplier: number
  playedAt: string
  results: GameResultRow[]
}

function formatEuro(amount: number): string {
  return amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function GamesPage() {
  const [step, setStep] = useState<Step>('select-game')
  const [gameType, setGameType] = useState<GameType>('SKAT')
  const [multiplier, setMultiplier] = useState('1')
  const [users, setUsers] = useState<WgUser[]>([])
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([])
  const [playerPoints, setPlayerPoints] = useState<Record<string, string>>({})
  const [history, setHistory] = useState<GameSession[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successCount, setSuccessCount] = useState(0)
  const [editingSession, setEditingSession] = useState<GameSession | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadInitialData() {
      try {
        const [usersRes, historyRes] = await Promise.all([
          fetch('/api/users'),
          fetch('/api/games'),
        ])
        const [usersData, historyData] = await Promise.all([
          usersRes.json() as Promise<{ users?: WgUser[] }>,
          historyRes.json() as Promise<{ sessions?: GameSession[] }>,
        ])
        if (!cancelled) {
          setUsers(usersData.users ?? [])
          setHistory(historyData.sessions ?? [])
        }
      } catch {
        if (!cancelled) setError('Daten konnten nicht geladen werden.')
      } finally {
        if (!cancelled) {
          setLoadingUsers(false)
          setLoadingHistory(false)
        }
      }
    }

    void loadInitialData()
    return () => { cancelled = true }
  }, [])

  async function refreshHistory() {
    try {
      const res = await fetch('/api/games')
      if (!res.ok) return
      const data = (await res.json()) as { sessions?: GameSession[] }
      setHistory(data.sessions ?? [])
    } catch {
      // silently ignore
    }
  }

  const minPlayers = gameType === 'SKAT' ? 3 : 4
  const maxPlayers = 4

  const togglePlayer = (userId: string) => {
    setSelectedPlayers((prev) => {
      if (prev.includes(userId)) return prev.filter((id) => id !== userId)
      if (prev.length >= maxPlayers) return prev
      return [...prev, userId]
    })
  }

  const liveDebts: Debt[] = React.useMemo(() => {
    const mult = parseFloat(multiplier)
    if (isNaN(mult) || mult <= 0) return []
    const players = selectedPlayers
      .map((uid) => {
        const user = users.find((u) => u.id === uid)
        const pts = parseInt(playerPoints[uid] ?? '', 10)
        if (!user || isNaN(pts)) return null
        return { userId: uid, name: user.name, points: pts }
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)
    if (players.length < minPlayers) return []
    return calculateDebts(players, mult)
  }, [selectedPlayers, playerPoints, multiplier, users, minPlayers])

  const canProceed =
    selectedPlayers.length >= minPlayers &&
    selectedPlayers.every((uid) => {
      const v = playerPoints[uid] ?? ''
      return v !== '' && !isNaN(parseInt(v, 10)) && parseInt(v, 10) >= 0
    })

  const handleSelectGame = (type: GameType) => {
    setGameType(type)
    setSelectedPlayers([])
    setPlayerPoints({})
    setError(null)
    setStep('setup')
  }

  const handleEdit = (sess: GameSession) => {
    setEditingSession(sess)
    setGameType(sess.gameType)
    setMultiplier(String(sess.multiplier))
    const ids = sess.results.map((r) => r.userId)
    setSelectedPlayers(ids)
    const pts: Record<string, string> = {}
    for (const r of sess.results) pts[r.userId] = String(r.points)
    setPlayerPoints(pts)
    setError(null)
    setStep('setup')
  }

  const handleDelete = async (id: string) => {
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/games/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        setError(data.error ?? 'Löschen fehlgeschlagen.')
        return
      }
      setDeletingId(null)
      await refreshHistory()
    } catch {
      setError('Netzwerkfehler beim Löschen.')
    } finally {
      setDeleting(false)
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const mult = parseFloat(multiplier)
      const players = selectedPlayers.map((uid) => ({
        userId: uid,
        points: parseInt(playerPoints[uid] ?? '0', 10),
      }))

      const isEdit = editingSession !== null
      const url = isEdit ? `/api/games/${editingSession.id}` : '/api/games'
      const body = isEdit
        ? { multiplier: mult, players }
        : { gameType, multiplier: mult, players }

      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as { expensesCreated?: number; error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Ein Fehler ist aufgetreten.')
        return
      }
      setSuccessCount(data.expensesCreated ?? 0)
      setStep('success')
      await refreshHistory()
    } catch {
      setError('Netzwerkfehler. Bitte erneut versuchen.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = () => {
    setStep('select-game')
    setSelectedPlayers([])
    setPlayerPoints({})
    setMultiplier('1')
    setError(null)
    setEditingSession(null)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Dices className="h-7 w-7 text-[var(--brand-500)]" />
        <h1 className="text-2xl font-extrabold" style={{ fontFamily: 'var(--font-syne, system-ui)' }}>
          Spiele
        </h1>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Step 1: Select game ───────────────────────────────────────────── */}
      {step === 'select-game' && (
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-muted)]">Welches Spiel wurde gespielt?</p>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => handleSelectGame('SKAT')}
              className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-surface-border bg-surface p-6 text-center transition-all duration-150 hover:border-[var(--brand-500)] hover:bg-[var(--brand-500)]/5 active:scale-95 min-h-[140px]"
            >
              <span className="text-4xl">🃏</span>
              <div>
                <p className="text-lg font-bold">Skat</p>
                <p className="text-xs text-[var(--text-muted)]">3–4 Spieler</p>
              </div>
            </button>
            <button
              onClick={() => handleSelectGame('DOPPELKOPF')}
              className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-surface-border bg-surface p-6 text-center transition-all duration-150 hover:border-[var(--brand-500)] hover:bg-[var(--brand-500)]/5 active:scale-95 min-h-[140px]"
            >
              <span className="text-4xl">🂡</span>
              <div>
                <p className="text-lg font-bold">Doppelkopf</p>
                <p className="text-xs text-[var(--text-muted)]">4 Spieler</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Setup ────────────────────────────────────────────────── */}
      {step === 'setup' && (
        <div className="space-y-5">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {editingSession ? 'Abbrechen' : 'Zurück zur Spielauswahl'}
          </button>

          <div className="flex items-center gap-2">
            <span className="text-2xl">{gameType === 'SKAT' ? '🃏' : '🂡'}</span>
            <h2 className="text-xl font-bold">{gameType === 'SKAT' ? 'Skat' : 'Doppelkopf'}</h2>
            {editingSession && <Badge variant="secondary">Bearbeiten</Badge>}
            {!editingSession && (
              <Badge variant="secondary">
                {minPlayers === maxPlayers ? `${minPlayers} Spieler` : `${minPlayers}–${maxPlayers} Spieler`}
              </Badge>
            )}
          </div>

          {/* Multiplier */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <Label htmlFor="multiplier" className="shrink-0 text-sm font-medium">
                  Cent pro Punkt
                </Label>
                <Input
                  id="multiplier"
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={multiplier}
                  onChange={(e) => setMultiplier(e.target.value)}
                  className="w-28"
                />
              </div>
            </CardContent>
          </Card>

          {/* Player selection */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Spieler auswählen
                <span className="ml-2 text-sm font-normal text-[var(--text-muted)]">
                  ({selectedPlayers.length}/
                  {minPlayers === maxPlayers ? maxPlayers : `${minPlayers}–${maxPlayers}`})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {loadingUsers
                ? Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-xl" />
                  ))
                : users.map((user) => {
                    const selected = selectedPlayers.includes(user.id)
                    const disabled = !selected && selectedPlayers.length >= maxPlayers
                    return (
                      <button
                        key={user.id}
                        onClick={() => togglePlayer(user.id)}
                        disabled={disabled}
                        className={`w-full flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all duration-150 active:scale-[0.98] min-h-[56px] ${
                          selected
                            ? 'border-[var(--brand-500)] bg-[var(--brand-500)]/10 text-foreground'
                            : disabled
                            ? 'border-surface-border bg-surface opacity-40 cursor-not-allowed'
                            : 'border-surface-border bg-surface hover:border-[var(--brand-500)]/50'
                        }`}
                      >
                        <Avatar className="h-8 w-8 shrink-0">
                          {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
                          <AvatarFallback className="text-xs">{getInitials(user.name)}</AvatarFallback>
                        </Avatar>
                        <span className="flex-1 font-medium text-sm">{user.name}</span>
                        {selected && (
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            placeholder="Punkte"
                            value={playerPoints[user.id] ?? ''}
                            onChange={(e) => {
                              e.stopPropagation()
                              setPlayerPoints((prev) => ({ ...prev, [user.id]: e.target.value }))
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-24 h-9 text-sm"
                          />
                        )}
                      </button>
                    )
                  })}
              {selectedPlayers.length > 0 && selectedPlayers.length < minPlayers && (
                <p className="text-xs text-amber-600 dark:text-amber-400 pt-1">
                  Noch {minPlayers - selectedPlayers.length} weitere
                  {minPlayers - selectedPlayers.length > 1 ? ' Spieler' : 'n Spieler'} auswählen
                </p>
              )}
            </CardContent>
          </Card>

          {/* Live debt preview */}
          {liveDebts.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Vorschau Abrechnung</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {liveDebts.map((debt, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-sm py-1 border-b border-surface-border last:border-0"
                  >
                    <span>
                      <span className="font-medium">{debt.fromName}</span>
                      <span className="text-[var(--text-muted)]"> zahlt </span>
                      <span className="font-medium">{debt.toName}</span>
                    </span>
                    <Badge variant="secondary">{formatEuro(debt.amountEuro)}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Button onClick={() => setStep('confirm')} disabled={!canProceed} className="w-full min-h-[48px]">
            Abrechnen
          </Button>
        </div>
      )}

      {/* ── Step 3: Confirm ──────────────────────────────────────────────── */}
      {step === 'confirm' && (
        <div className="space-y-5">
          <button
            onClick={() => setStep('setup')}
            className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Zurück
          </button>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Abrechnung bestätigen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {liveDebts.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">Keine Schulden – alle Punktestände sind gleich.</p>
              ) : (
                liveDebts.map((debt, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-xl bg-surface-muted px-4 py-3 text-sm"
                  >
                    <span>
                      <span className="font-semibold">{debt.fromName}</span>
                      <span className="text-[var(--text-muted)]"> zahlt </span>
                      <span className="font-semibold">{debt.toName}</span>
                    </span>
                    <span className="font-bold text-[var(--brand-500)]">{formatEuro(debt.amountEuro)}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('setup')} className="flex-1 min-h-[48px]">
              Zurück
            </Button>
            <Button onClick={handleSubmit} disabled={submitting} className="flex-1 min-h-[48px]">
              {submitting
                ? 'Wird gespeichert…'
                : editingSession
                ? 'Ausgaben aktualisieren'
                : 'Ausgaben erstellen'}
            </Button>
          </div>
        </div>
      )}

      {/* ── Success ──────────────────────────────────────────────────────── */}
      {step === 'success' && (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-green-200 bg-green-50 p-6 text-center dark:border-green-800 dark:bg-green-950/30">
            <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
            <div>
              <p className="font-bold text-green-800 dark:text-green-300">
                {editingSession ? 'Abrechnung aktualisiert!' : 'Abrechnung gespeichert!'}
              </p>
              <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                {successCount} {successCount === 1 ? 'Ausgabe wurde' : 'Ausgaben wurden'}{' '}
                {editingSession ? 'aktualisiert' : 'erstellt'}.
              </p>
            </div>
            <div className="flex gap-3 mt-2">
              <Button variant="outline" onClick={handleReset} className="min-h-[48px]">
                Neue Runde
              </Button>
              <Button asChild className="min-h-[48px]">
                <Link href="/expenses">Zu den Ausgaben</Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── History ──────────────────────────────────────────────────────── */}
      <div className="space-y-3 pt-2">
        <h2 className="text-base font-bold">Letzte Spielrunden</h2>
        {loadingHistory ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
        ) : history.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Noch keine Spielrunden aufgezeichnet.</p>
        ) : (
          history.slice(0, 20).map((sess) => {
            const label = sess.gameType === 'SKAT' ? 'Skat' : 'Doppelkopf'
            const icon = sess.gameType === 'SKAT' ? '🃏' : '🂡'
            const sorted = [...sess.results].sort((a, b) => b.points - a.points)
            const isConfirmingDelete = deletingId === sess.id

            return (
              <Card key={sess.id} className="card-hover">
                <CardContent className="pt-3 pb-3 px-4">
                  {/* Header row */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span>{icon}</span>
                      <span className="font-semibold text-sm">{label}</span>
                      <span className="text-xs text-[var(--text-muted)]">·</span>
                      <span className="text-xs text-[var(--text-muted)]">{formatDate(sess.playedAt)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary" className="text-xs">
                        {sess.multiplier} Ct/Pkt
                      </Badge>
                      <button
                        onClick={() => handleEdit(sess)}
                        className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-foreground hover:bg-surface-muted transition-all min-h-[36px] min-w-[36px] flex items-center justify-center"
                        aria-label="Bearbeiten"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingId(isConfirmingDelete ? null : sess.id)}
                        className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all min-h-[36px] min-w-[36px] flex items-center justify-center"
                        aria-label="Löschen"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Player results */}
                  <div className="flex flex-wrap gap-2">
                    {sorted.map((r) => (
                      <span
                        key={r.id}
                        className="inline-flex items-center gap-1 text-xs bg-surface-muted rounded-lg px-2 py-1"
                      >
                        <span className="font-medium">{r.user.name}</span>
                        <span className="text-[var(--text-muted)]">{r.points}</span>
                      </span>
                    ))}
                  </div>

                  {/* Inline delete confirmation */}
                  {isConfirmingDelete && (
                    <div className="mt-3 pt-3 border-t border-surface-border flex items-center justify-between gap-3">
                      <p className="text-xs text-red-600 dark:text-red-400 flex-1">
                        Spielrunde und alle zugehörigen Ausgaben löschen?
                      </p>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeletingId(null)}
                          className="h-8 text-xs"
                        >
                          Abbrechen
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleDelete(sess.id)}
                          disabled={deleting}
                          className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white border-0"
                        >
                          {deleting ? 'Löschen…' : 'Ja, löschen'}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
