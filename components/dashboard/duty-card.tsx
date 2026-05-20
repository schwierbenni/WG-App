'use client'

import { useState } from 'react'
import { CheckCircle2, ArrowLeftRight, Clock, AlertCircle, CheckSquare, Square } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SwapDialog } from '@/components/duties/swap-dialog'
import { cn, formatDate } from '@/lib/utils'

interface SimpleUser {
  id: string
  name: string
  email: string
  avatarUrl?: string | null
}

interface DutyCardAssignment {
  id: string
  dueDate: string
  completedAt: string | null
  duty: {
    id: string
    name: string
    emoji: string | null
    color: string
    checklistItems: string[]
  }
  user: SimpleUser
}

interface DutyCardProps {
  assignment: DutyCardAssignment
  members?: SimpleUser[]
  onUpdate?: () => void
}

function getAssignmentStatus(assignment: DutyCardAssignment): 'done' | 'overdue' | 'open' {
  if (assignment.completedAt) return 'done'
  const due = new Date(assignment.dueDate)
  if (due < new Date()) return 'overdue'
  return 'open'
}

const statusConfig = {
  done: { label: 'Erledigt', badgeVariant: 'success' as const, cardClass: 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10', iconClass: 'text-green-500', Icon: CheckCircle2 },
  overdue: { label: 'Überfällig', badgeVariant: 'destructive' as const, cardClass: 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10', iconClass: 'text-red-500', Icon: AlertCircle },
  open: { label: 'Offen', badgeVariant: 'warning' as const, cardClass: 'border-yellow-200 dark:border-yellow-800 bg-yellow-50/30 dark:bg-yellow-900/10', iconClass: 'text-yellow-500', Icon: Clock },
}

export function DutyCard({ assignment, members = [], onUpdate }: DutyCardProps) {
  const [completing, setCompleting] = useState(false)
  const [completed, setCompleted] = useState(!!assignment.completedAt)
  const [completedAt, setCompletedAt] = useState(assignment.completedAt)
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const currentStatus = completed ? 'done' : getAssignmentStatus({ ...assignment, completedAt })
  const { label, badgeVariant, cardClass, Icon } = statusConfig[currentStatus]
  const checklistItems = assignment.duty.checklistItems ?? []

  async function handleComplete() {
    setCompleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/assignments/${assignment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Fehler beim Markieren als erledigt.')
        return
      }
      setCompleted(true)
      setCompletedAt(data.assignment?.completedAt ?? new Date().toISOString())
      onUpdate?.()
    } catch {
      setError('Netzwerkfehler. Bitte erneut versuchen.')
    } finally {
      setCompleting(false)
    }
  }

  function toggleCheckItem(index: number) {
    setCheckedItems((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const allChecked = checklistItems.length > 0 && checkedItems.size === checklistItems.length

  return (
    <div className={cn('rounded-xl border p-4 transition-all duration-200 shadow-sm hover:shadow-md', cardClass)}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 min-w-0">
          {assignment.duty.emoji ? (
            <span className="text-2xl shrink-0 leading-none mt-0.5">{assignment.duty.emoji}</span>
          ) : (
            <div className="h-8 w-8 rounded-lg shrink-0 flex items-center justify-center" style={{ backgroundColor: assignment.duty.color + '33' }}>
              <div className="h-4 w-4 rounded" style={{ backgroundColor: assignment.duty.color }} />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm leading-tight truncate">{assignment.duty.name}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {currentStatus === 'done' && completedAt
                ? `Erledigt am ${formatDate(completedAt)}`
                : `Fällig: ${formatDate(assignment.dueDate)}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Icon className={cn('h-4 w-4', statusConfig[currentStatus].iconClass)} />
          <Badge variant={badgeVariant} className="text-xs">{label}</Badge>
        </div>
      </div>

      {checklistItems.length > 0 && (
        <div className="mb-3 space-y-1">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            Checkliste ({checkedItems.size}/{checklistItems.length})
          </p>
          {checklistItems.map((item, i) => (
            <button
              key={i}
              type="button"
              onClick={() => !completed && toggleCheckItem(i)}
              disabled={completed}
              className={cn(
                'flex items-center gap-2 w-full text-left text-xs rounded px-2 py-1 transition-colors',
                completed ? 'cursor-default opacity-60' : 'hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer'
              )}
            >
              {checkedItems.has(i) || completed ? (
                <CheckSquare className="h-3.5 w-3.5 text-green-500 shrink-0" />
              ) : (
                <Square className="h-3.5 w-3.5 text-gray-400 shrink-0" />
              )}
              <span className={cn('text-gray-700 dark:text-gray-300', (checkedItems.has(i) || completed) && 'line-through text-gray-400')}>
                {item}
              </span>
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 mb-2 flex items-center gap-1">
          <AlertCircle className="h-3.5 w-3.5" />{error}
        </p>
      )}

      {!completed && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-black/5 dark:border-white/5">
          <Button
            size="sm"
            variant="default"
            onClick={handleComplete}
            disabled={completing || (checklistItems.length > 0 && !allChecked)}
            className="flex-1 text-xs h-8"
          >
            {completing ? (
              <span className="flex items-center gap-1.5">
                <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Wird markiert…
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />Erledigt
              </span>
            )}
          </Button>
          {members.length > 1 && (
            <SwapDialog
              assignmentId={assignment.id}
              dutyName={assignment.duty.name}
              dutyEmoji={assignment.duty.emoji}
              dueDate={assignment.dueDate}
              members={members}
              onSuccess={onUpdate}
              trigger={
                <Button size="sm" variant="outline" className="flex-1 text-xs h-8">
                  <ArrowLeftRight className="h-3.5 w-3.5 mr-1.5" />Tauschen
                </Button>
              }
            />
          )}
        </div>
      )}
    </div>
  )
}
