'use client'

import { formatDate, getInitials, cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react'

interface SimpleUser {
  id: string
  name: string
  email: string
  avatarUrl?: string | null
}

interface OverviewAssignment {
  id: string
  dueDate: string
  completedAt: string | null
  duty: { id: string; name: string; emoji: string | null; color: string }
  user: SimpleUser
}

function getStatus(assignment: OverviewAssignment): 'done' | 'overdue' | 'open' {
  if (assignment.completedAt) return 'done'
  if (new Date(assignment.dueDate) < new Date()) return 'overdue'
  return 'open'
}

const statusConfig = {
  done:    { label: 'Erledigt',   badgeVariant: 'success' as const,     Icon: CheckCircle2, iconClass: 'text-[var(--success)]' },
  overdue: { label: 'Überfällig', badgeVariant: 'destructive' as const,  Icon: AlertCircle,  iconClass: 'text-[var(--danger)]' },
  open:    { label: 'Offen',      badgeVariant: 'warning' as const,      Icon: Clock,        iconClass: 'text-[var(--warning)]' },
}

export function AssignmentOverview({ assignments }: { assignments: OverviewAssignment[] }) {
  if (assignments.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-surface-border bg-surface p-8 text-center">
        <p className="text-sm text-[var(--text-muted)]">Keine Dienste vorhanden.</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border-2 border-surface-border bg-surface overflow-hidden shadow-sm">
      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-surface-border bg-surface-muted">
              <th className="px-4 py-3 text-left text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider"
                  style={{ fontFamily: 'var(--font-syne, system-ui)' }}>
                Dienst
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider"
                  style={{ fontFamily: 'var(--font-syne, system-ui)' }}>
                Zugewiesen an
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider"
                  style={{ fontFamily: 'var(--font-syne, system-ui)' }}>
                Fällig am
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider"
                  style={{ fontFamily: 'var(--font-syne, system-ui)' }}>
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((assignment, i) => {
              const status = getStatus(assignment)
              const { label, badgeVariant, Icon, iconClass } = statusConfig[status]
              return (
                <tr
                  key={assignment.id}
                  className={cn(
                    'border-b border-surface-border last:border-0 transition-colors hover:bg-brand-muted',
                    i % 2 === 0 ? 'bg-surface' : 'bg-surface-muted'
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      {assignment.duty.emoji ? (
                        <span className="text-lg leading-none">{assignment.duty.emoji}</span>
                      ) : (
                        <div className="h-5 w-5 rounded-lg" style={{ backgroundColor: assignment.duty.color }} />
                      )}
                      <span className="font-semibold text-foreground">{assignment.duty.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        {assignment.user.avatarUrl && (
                          <AvatarImage src={assignment.user.avatarUrl} alt={assignment.user.name} />
                        )}
                        <AvatarFallback className="text-[10px] bg-brand-muted text-brand-600">
                          {getInitials(assignment.user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-[var(--text-muted)]">{assignment.user.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{formatDate(assignment.dueDate)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Icon className={cn('h-3.5 w-3.5 shrink-0', iconClass)} />
                      <Badge variant={badgeVariant} className="text-xs">{label}</Badge>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="sm:hidden divide-y divide-surface-border">
        {assignments.map((assignment) => {
          const status = getStatus(assignment)
          const { label, badgeVariant, Icon, iconClass } = statusConfig[status]
          return (
            <div key={assignment.id} className="flex items-center gap-3 px-4 py-3.5">
              <div className="shrink-0">
                {assignment.duty.emoji ? (
                  <span className="text-2xl">{assignment.duty.emoji}</span>
                ) : (
                  <div
                    className="h-9 w-9 rounded-xl"
                    style={{ backgroundColor: assignment.duty.color + '33' }}
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{assignment.duty.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Avatar className="h-4 w-4">
                    {assignment.user.avatarUrl && (
                      <AvatarImage src={assignment.user.avatarUrl} alt={assignment.user.name} />
                    )}
                    <AvatarFallback className="text-[8px] bg-brand-muted text-brand-600">
                      {getInitials(assignment.user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <p className="text-xs text-[var(--text-muted)] truncate">
                    {assignment.user.name} · {formatDate(assignment.dueDate)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Icon className={cn('h-3.5 w-3.5', iconClass)} />
                <Badge variant={badgeVariant} className="text-xs">{label}</Badge>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
