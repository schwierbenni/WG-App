'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Trophy } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { getInitials } from '@/lib/utils'

interface LeaderboardEntry {
  userId: string
  name: string
  avatarUrl: string | null
  gamesPlayed: number
  totalPoints: number | null
  totalEuro: number
  skatEuro?: number
  doppelkopfEuro?: number
}

function formatEuro(amount: number): string {
  return amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function getMonthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
}

function toMonthParam(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

function prevMonth(year: number, month: number): [number, number] {
  if (month === 1) return [year - 1, 12]
  return [year, month - 1]
}

function nextMonth(year: number, month: number): [number, number] {
  if (month === 12) return [year + 1, 1]
  return [year, month + 1]
}

function EuroCell({ value }: { value: number }) {
  const isNegative = value < 0
  const isPositive = value > 0
  return (
    <span
      className={
        isNegative
          ? 'text-red-600 dark:text-red-400 font-semibold'
          : isPositive
          ? 'text-green-600 dark:text-green-400 font-semibold'
          : 'text-[var(--text-muted)]'
      }
    >
      {formatEuro(value)}
    </span>
  )
}

function MonthSelector({
  year,
  month,
  onChange,
}: {
  year: number
  month: number
  onChange: (year: number, month: number) => void
}) {
  const now = new Date()
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1

  return (
    <div className="flex items-center justify-between gap-2">
      <button
        onClick={() => onChange(...prevMonth(year, month))}
        className="p-2 rounded-lg hover:bg-surface-muted transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
        aria-label="Vorheriger Monat"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-sm font-semibold flex-1 text-center">{getMonthLabel(year, month)}</span>
      <button
        onClick={() => onChange(...nextMonth(year, month))}
        disabled={isCurrentMonth}
        className="p-2 rounded-lg hover:bg-surface-muted transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label="Nächster Monat"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

function ScoreboardTable({
  entries,
  loading,
  showPoints,
}: {
  entries: LeaderboardEntry[]
  loading: boolean
  showPoints: boolean
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm text-[var(--text-muted)] py-4 text-center">
        Keine Spielrunden in diesem Monat.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
      <table className="w-full text-sm min-w-[320px]">
        <thead>
          <tr className="border-b border-surface-border">
            <th className="text-left pb-2 font-medium text-[var(--text-muted)] pr-3 w-full">Spieler</th>
            <th className="text-right pb-2 font-medium text-[var(--text-muted)] px-3 whitespace-nowrap">Spiele</th>
            {showPoints && (
              <th className="text-right pb-2 font-medium text-[var(--text-muted)] px-3 whitespace-nowrap">Punkte</th>
            )}
            <th className="text-right pb-2 font-medium text-[var(--text-muted)] pl-3 whitespace-nowrap">Schulden</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, idx) => (
            <tr key={entry.userId} className="border-b border-surface-border last:border-0">
              <td className="py-3 pr-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs text-[var(--text-muted)] w-4 shrink-0 text-right">{idx + 1}.</span>
                  <Avatar className="h-7 w-7 shrink-0">
                    {entry.avatarUrl && <AvatarImage src={entry.avatarUrl} alt={entry.name} />}
                    <AvatarFallback className="text-[10px]">{getInitials(entry.name)}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium truncate">{entry.name}</span>
                </div>
              </td>
              <td className="py-3 px-3 text-right text-[var(--text-muted)]">{entry.gamesPlayed}</td>
              {showPoints && (
                <td className="py-3 px-3 text-right tabular-nums">
                  <span className={entry.totalPoints != null && entry.totalPoints < 0 ? 'text-red-600 dark:text-red-400' : ''}>
                    {entry.totalPoints ?? '–'}
                  </span>
                </td>
              )}
              <td className="py-3 pl-3 text-right tabular-nums">
                <EuroCell value={entry.totalEuro} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function OverallTable({ entries, loading }: { entries: LeaderboardEntry[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm text-[var(--text-muted)] py-4 text-center">
        Noch keine Spielrunden aufgezeichnet.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
      <table className="w-full text-sm min-w-[360px]">
        <thead>
          <tr className="border-b border-surface-border">
            <th className="text-left pb-2 font-medium text-[var(--text-muted)] pr-3 w-full">Spieler</th>
            <th className="text-right pb-2 font-medium text-[var(--text-muted)] px-3 whitespace-nowrap">Skat (€)</th>
            <th className="text-right pb-2 font-medium text-[var(--text-muted)] px-3 whitespace-nowrap">Doppelk. (€)</th>
            <th className="text-right pb-2 font-medium text-[var(--text-muted)] pl-3 whitespace-nowrap">Gesamt (€)</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, idx) => (
            <tr key={entry.userId} className="border-b border-surface-border last:border-0">
              <td className="py-3 pr-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs text-[var(--text-muted)] w-4 shrink-0 text-right">{idx + 1}.</span>
                  <Avatar className="h-7 w-7 shrink-0">
                    {entry.avatarUrl && <AvatarImage src={entry.avatarUrl} alt={entry.name} />}
                    <AvatarFallback className="text-[10px]">{getInitials(entry.name)}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium truncate">{entry.name}</span>
                </div>
              </td>
              <td className="py-3 px-3 text-right tabular-nums">
                <EuroCell value={entry.skatEuro ?? 0} />
              </td>
              <td className="py-3 px-3 text-right tabular-nums">
                <EuroCell value={entry.doppelkopfEuro ?? 0} />
              </td>
              <td className="py-3 pl-3 text-right tabular-nums">
                <EuroCell value={entry.totalEuro} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

type BoardTab = 'skat' | 'doppelkopf' | 'gesamt'

export function Leaderboard() {
  const now = new Date()
  const [boardTab, setBoardTab] = useState<BoardTab>('skat')
  const [skatYear, setSkatYear] = useState(now.getFullYear())
  const [skatMonth, setSkatMonth] = useState(now.getMonth() + 1)
  const [dkYear, setDkYear] = useState(now.getFullYear())
  const [dkMonth, setDkMonth] = useState(now.getMonth() + 1)

  const [skatEntries, setSkatEntries] = useState<LeaderboardEntry[]>([])
  const [dkEntries, setDkEntries] = useState<LeaderboardEntry[]>([])
  const [gesamtEntries, setGesamtEntries] = useState<LeaderboardEntry[]>([])
  const [skatLoading, setSkatLoading] = useState(false)
  const [dkLoading, setDkLoading] = useState(false)
  const [gesamtLoading, setGesamtLoading] = useState(false)

  const fetchSkat = useCallback(async (year: number, month: number) => {
    setSkatLoading(true)
    try {
      const res = await fetch(`/api/games/leaderboard?gameType=SKAT&month=${toMonthParam(year, month)}`)
      if (!res.ok) return
      const data = (await res.json()) as { leaderboard?: LeaderboardEntry[] }
      setSkatEntries(data.leaderboard ?? [])
    } finally {
      setSkatLoading(false)
    }
  }, [])

  const fetchDk = useCallback(async (year: number, month: number) => {
    setDkLoading(true)
    try {
      const res = await fetch(`/api/games/leaderboard?gameType=DOPPELKOPF&month=${toMonthParam(year, month)}`)
      if (!res.ok) return
      const data = (await res.json()) as { leaderboard?: LeaderboardEntry[] }
      setDkEntries(data.leaderboard ?? [])
    } finally {
      setDkLoading(false)
    }
  }, [])

  const fetchGesamt = useCallback(async () => {
    setGesamtLoading(true)
    try {
      const res = await fetch('/api/games/leaderboard?gameType=ALL')
      if (!res.ok) return
      const data = (await res.json()) as { leaderboard?: LeaderboardEntry[] }
      setGesamtEntries(data.leaderboard ?? [])
    } finally {
      setGesamtLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchSkat(skatYear, skatMonth)
  }, [fetchSkat, skatYear, skatMonth])

  useEffect(() => {
    void fetchDk(dkYear, dkMonth)
  }, [fetchDk, dkYear, dkMonth])

  useEffect(() => {
    void fetchGesamt()
  }, [fetchGesamt])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-[var(--brand-500)]" />
        <h2 className="text-base font-bold">Leaderboard</h2>
      </div>

      <div className="overflow-x-auto [scrollbar-width:none] [-webkit-overflow-scrolling:touch] -mx-4 px-4 sm:mx-0 sm:px-0">
        <Tabs value={boardTab} onValueChange={(v) => setBoardTab(v as BoardTab)}>
          <TabsList className="inline-flex w-auto">
            <TabsTrigger value="skat" className="min-h-[40px]">
              🃏 Skat
            </TabsTrigger>
            <TabsTrigger value="doppelkopf" className="min-h-[40px]">
              🂡 Doppelkopf
            </TabsTrigger>
            <TabsTrigger value="gesamt" className="min-h-[40px]">
              Gesamt
            </TabsTrigger>
          </TabsList>

          <TabsContent value="skat" className="space-y-4 mt-4">
            <MonthSelector
              year={skatYear}
              month={skatMonth}
              onChange={(y, m) => { setSkatYear(y); setSkatMonth(m) }}
            />
            <ScoreboardTable entries={skatEntries} loading={skatLoading} showPoints />
          </TabsContent>

          <TabsContent value="doppelkopf" className="space-y-4 mt-4">
            <MonthSelector
              year={dkYear}
              month={dkMonth}
              onChange={(y, m) => { setDkYear(y); setDkMonth(m) }}
            />
            <ScoreboardTable entries={dkEntries} loading={dkLoading} showPoints />
          </TabsContent>

          <TabsContent value="gesamt" className="mt-4">
            <OverallTable entries={gesamtEntries} loading={gesamtLoading} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
