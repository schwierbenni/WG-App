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
  done: { label: 'Erledigt', badgeVariant: 'success' as const, Icon: CheckCircle2, iconClass: 'text-green-500' },
  overdue: { label: 'Überfällig', badgeVariant: 'destructive' as const, Icon: AlertCircle, iconClass: 'text-red-500' },
  open: { label: 'Offen', badgeVariant: 'warning' as const, Icon: Clock, iconClass: 'text-yellow-500' },
}

export function AssignmentOverview({ assignments }: { assignments: OverviewAssignment[] }) {
  if (assignments.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-8 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">Keine Dienste vorhanden.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden shadow-sm">
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Dienst</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Zugewiesen an</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fällig am</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((assignment, i) => {
              const status = getStatus(assignment)
              const { label, badgeVariant, Icon, iconClass } = statusConfig[status]
              return (
                <tr key={assignment.id} className={cn('border-b border-gray-100 dark:border-gray-700 last:border-0 transition-colors hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10', i % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/50 dark:bg-gray-800/30')}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {assignment.duty.emoji ? (
                        <span className="text-lg leading-none">{assignment.duty.emoji}</span>
                      ) : (
                        <div className="h-5 w-5 rounded" style={{ backgroundColor: assignment.duty.color }} />
                      )}
                      <span className="font-medium text-gray-900 dark:text-gray-100">{assignment.duty.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        {assignment.user.avatarUrl && <AvatarImage src={assignment.user.avatarUrl} alt={assignment.user.name} />}
                        <AvatarFallback className="text-[10px]">{getInitials(assignment.user.name)}</AvatarFallback>
                      </Avatar>
                      <span className="text-gray-700 dark:text-gray-300">{assignment.user.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatDate(assignment.dueDate)}</td>
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

      <div className="sm:hidden divide-y divide-gray-100 dark:divide-gray-700">
        {assignments.map((assignment) => {
          const status = getStatus(assignment)
          const { label, badgeVariant, Icon, iconClass } = statusConfig[status]
          return (
            <div key={assignment.id} className="flex items-center gap-3 px-4 py-3">
              <div className="shrink-0">
                {assignment.duty.emoji ? <span className="text-xl">{assignment.duty.emoji}</span> : <div className="h-8 w-8 rounded-lg" style={{ backgroundColor: assignment.duty.color + '33' }} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{assignment.duty.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Avatar className="h-4 w-4">
                    {assignment.user.avatarUrl && <AvatarImage src={assignment.user.avatarUrl} alt={assignment.user.name} />}
                    <AvatarFallback className="text-[8px]">{getInitials(assignment.user.name)}</AvatarFallback>
                  </Avatar>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{assignment.user.name} · {formatDate(assignment.dueDate)}</p>
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
