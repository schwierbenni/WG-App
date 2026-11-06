'use client'
import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { addDateDays, mondayKey, weeklyAllocation } from '@/lib/weekly-duty'

type Member = { id: string; name: string }
type Duty = { id: string; name: string; isPaused?: boolean }
type Assignment = {
  id: string
  user: Member
  duty: Duty
  weekStart: string | null
  dueDate: string
  completedAt: string | null
}
type Plan = { startMonday: string; memberOrder: string[]; dutyOrder: string[] }
type Data = {
  plan: Plan | null
  week: string
  freeMemberId?: string
  members: Member[]
  duties: Duty[]
  assignments: Assignment[]
  backlog: Assignment[]
  legacyBacklog?: Assignment[]
  isAdmin: boolean
}
const startingSlots = [
  'Frei',
  'Bad-Dienst',
  'Wohnzimmerdienst',
  'Supply-Dienst',
  'Küchendienst',
]
function weekLabel(week: string) {
  return new Date(`${week.slice(0, 10)}T12:00:00Z`).toLocaleDateString(
    'de-DE',
    {
      timeZone: 'Europe/Berlin',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    },
  )
}
async function fetchWeeklyData(signal?: AbortSignal): Promise<Data> {
  const response = await fetch('/api/duties/weekly', { signal })
  if (!response.ok) throw new Error('Wochenplan konnte nicht geladen werden.')
  return response.json()
}
export function WeeklyDutyBoard({
  onStatus,
}: {
  onStatus: (active: boolean) => void
}) {
  const { data: session } = useSession()
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(''),
    [saving, setSaving] = useState(false)
  const [start, setStart] = useState(() =>
    addDateDays(mondayKey(new Date()), 7),
  )
  const [members, setMembers] = useState<string[]>(['', '', '', '', '']),
    [duties, setDuties] = useState<string[]>(['', '', '', ''])
  const load = useCallback(async () => {
    try {
      const body = await fetchWeeklyData()
      setData(body)
      onStatus(!!body.plan)
      setError('')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Laden fehlgeschlagen.')
    }
  }, [onStatus])
  useEffect(() => {
    const controller = new AbortController()
    void fetchWeeklyData(controller.signal)
      .then((body) => {
        if (controller.signal.aborted) return
        setData(body)
        onStatus(!!body.plan)
        setError('')
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error ? error.message : 'Laden fehlgeschlagen.',
          )
      })
    return () => controller.abort()
  }, [onStatus])
  async function setup(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/duties/weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startMonday: start,
          memberOrder: members,
          dutyOrder: duties,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Einrichtung fehlgeschlagen.')
      await load()
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Einrichtung fehlgeschlagen.',
      )
    } finally {
      setSaving(false)
    }
  }
  async function toggle(assignment: Assignment) {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/assignments/${assignment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: assignment.completedAt ? 'uncomplete' : 'complete',
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Speichern fehlgeschlagen.')
      await load()
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Speichern fehlgeschlagen.',
      )
    } finally {
      setSaving(false)
    }
  }
  function card(assignment: Assignment) {
    const mine = assignment.user.id === session?.user?.id
    return (
      <article
        key={assignment.id}
        className="rounded-2xl border-2 border-surface-border bg-surface p-4 space-y-2"
      >
        <h3 className="font-semibold">{assignment.duty.name}</h3>
        <p>{assignment.user.name}</p>
        <p className="text-sm text-[var(--text-muted)]">
          {assignment.weekStart
            ? `Woche ab ${weekLabel(assignment.weekStart)}`
            : `Frühere Zuteilung · fällig ${weekLabel(assignment.dueDate)}`}
        </p>
        <p
          className={
            assignment.completedAt
              ? 'text-green-700'
              : 'text-[var(--text-muted)]'
          }
        >
          {assignment.completedAt ? '✓ Erledigt' : '○ Noch offen'}
        </p>
        {mine && (
          <Button
            disabled={saving}
            onClick={() => toggle(assignment)}
            variant="outline"
          >
            {assignment.completedAt
              ? 'Wieder öffnen'
              : 'Als erledigt markieren'}
          </Button>
        )}
      </article>
    )
  }
  if (!data)
    return error ? (
      <p role="alert" className="text-red-700">
        {error}
      </p>
    ) : null
  if (!data.plan)
    return (
      <section className="mb-6">
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
        {data.isAdmin ? (
          <details className="rounded-2xl border-2 border-surface-border bg-surface p-4">
            <summary className="cursor-pointer font-semibold">
              Gemeinsamen Wochenplan einrichten
            </summary>
            <form onSubmit={setup} className="grid gap-4 mt-4 max-w-xl">
              <p>
                Fünf Personen in fester Zimmerreihenfolge. In der Startwoche ist
                Platz 1 frei; die vier anderen Plätze erhalten die Dienste
                unten. Jeden Montag rückt jede Person einen Platz weiter.
              </p>
              <label>
                Startmontag
                <Input
                  type="date"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  required
                />
              </label>
              {startingSlots.map((slot, index) => (
                <label key={slot}>
                  Person an Platz {index + 1} · startet mit {slot}
                  <select
                    required
                    value={members[index]}
                    onChange={(e) =>
                      setMembers((prev) =>
                        prev.map((id, i) =>
                          i === index ? e.target.value : id,
                        ),
                      )
                    }
                    className="block w-full rounded-xl border-2 border-surface-border bg-surface p-3"
                  >
                    <option value="">Person auswählen</option>
                    {data.members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              {startingSlots.slice(1).map((slot, index) => (
                <label key={slot}>
                  {slot}: vorhandenen Dienst zuordnen
                  <select
                    required
                    value={duties[index]}
                    onChange={(e) =>
                      setDuties((prev) =>
                        prev.map((id, i) =>
                          i === index ? e.target.value : id,
                        ),
                      )
                    }
                    className="block w-full rounded-xl border-2 border-surface-border bg-surface p-3"
                  >
                    <option value="">Dienst auswählen</option>
                    {data.duties
                      .filter((d) => !d.isPaused)
                      .map((duty) => (
                        <option key={duty.id} value={duty.id}>
                          {duty.name}
                        </option>
                      ))}
                  </select>
                </label>
              ))}
              <p className="text-sm">
                Montag: persönliche Wocheninfo, auch bei Frei. Sonntag, 9 Uhr:
                Erinnerung an alle für offene Dienste. Sonntagabend: Frist.
                Montag: Nachholen und erste Eskalation an alle. Dienstag: zweite
                Eskalation an alle. Die Meldungen enthalten die vereinbarten
                derben WG-Sprüche.
              </p>
              <Button type="submit" disabled={saving}>
                Wochenplan verbindlich starten
              </Button>
            </form>
          </details>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">
            Ein WG-Admin kann den gemeinsamen Wochenplan einrichten.
          </p>
        )}
      </section>
    )
  const nextWeek = addDateDays(data.week, 7),
    next = weeklyAllocation(
      data.plan.startMonday.slice(0, 10),
      nextWeek,
      data.plan.memberOrder,
      data.plan.dutyOrder,
    )
  return (
    <section className="space-y-5" aria-label="Gemeinsamer Wochenplan">
      <header>
        <h1 className="text-2xl font-bold">
          Dienste · Woche ab {weekLabel(data.week)}
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          Montag bis Sonntag · Montag bleibt als Nachholtag für die Vorwoche.
        </p>
      </header>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {!data.assignments.length && (
        <p>Der Plan startet am {weekLabel(data.plan.startMonday)}.</p>
      )}
      {data.freeMemberId && (
        <p className="rounded-xl bg-surface-muted p-4">
          🎉 {data.members.find((m) => m.id === data.freeMemberId)?.name} hat
          diese Woche frei.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {[...data.assignments]
          .sort(
            (a, b) =>
              data.plan!.dutyOrder.indexOf(a.duty.id) -
              data.plan!.dutyOrder.indexOf(b.duty.id),
          )
          .map(card)}
      </div>
      {data.backlog.length > 0 && (
        <section
          className="space-y-3"
          aria-label="Offene Dienste aus Vorwochen"
        >
          <h2 className="text-lg font-semibold">Noch offen aus Vorwochen</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {data.backlog.map(card)}
          </div>
        </section>
      )}
      {!!data.legacyBacklog?.length && (
        <details className="rounded-xl border-2 border-surface-border p-4">
          <summary className="cursor-pointer">
            Offen vor der Umstellung ({data.legacyBacklog.length})
          </summary>
          <div className="grid gap-4 sm:grid-cols-2 mt-3">
            {data.legacyBacklog.map(card)}
          </div>
        </details>
      )}
      {next && (
        <details className="rounded-xl border-2 border-surface-border p-4">
          <summary className="cursor-pointer">
            Nächste Woche · ab {weekLabel(nextWeek)}
          </summary>
          <ul className="mt-3 space-y-2">
            {data.plan.memberOrder.map((id) => {
              const assignment = next.assignments.find((a) => a.userId === id)
              return (
                <li key={id}>
                  {data.members.find((m) => m.id === id)?.name}:{' '}
                  {assignment
                    ? data.duties.find((d) => d.id === assignment.dutyId)?.name
                    : 'Frei 🎉'}
                </li>
              )
            })}
          </ul>
        </details>
      )}
      <Button variant="outline" onClick={load} disabled={saving}>
        Aktualisieren
      </Button>
    </section>
  )
}
