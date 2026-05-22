'use client'

import * as React from 'react'
import { useSession } from 'next-auth/react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  Plus,
  RefreshCw,
  ArrowRight,
  Receipt,
  TrendingUp,
  Wallet,
  Trash2,
  Edit2,
  History,
  X,
  Check,
  TrendingDown,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { cn, formatDate, formatCurrency, getInitials } from '@/lib/utils'

type ExpenseCategory = 'LEBENSMITTEL' | 'HAUSHALT' | 'MIETE_NEBENKOSTEN' | 'SONSTIGES'
type SplitMode = 'EQUAL' | 'INDIVIDUAL' | 'PERCENTAGE'

interface SimpleUser {
  id: string
  name: string
  email: string
  avatarUrl: string | null
}

interface Expense {
  id: string
  amount: number
  description: string
  category: ExpenseCategory
  paidBy: string
  splitWith: string[]
  splitMode: SplitMode
  splits: Record<string, number> | null
  date: string
  settledAt: string | null
  createdAt: string
  paidByUser: SimpleUser
}

interface NetSettlement {
  fromUserId: string
  fromUserName: string
  toUserId: string
  toUserName: string
  amount: number
}

interface SettlementRecord {
  id: string
  fromUserId: string
  toUserId: string
  amount: number
  comment: string | null
  createdAt: string
  fromUser: SimpleUser
  toUser: SimpleUser
}

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  LEBENSMITTEL: 'Lebensmittel',
  HAUSHALT: 'Haushalt',
  MIETE_NEBENKOSTEN: 'Miete & NK',
  SONSTIGES: 'Sonstiges',
}

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  LEBENSMITTEL: 'bg-green-100 text-green-700',
  HAUSHALT: 'bg-blue-100 text-blue-700',
  MIETE_NEBENKOSTEN: 'bg-purple-100 text-purple-700',
  SONSTIGES: 'bg-gray-100 text-gray-600',
}

const CATEGORIES: ExpenseCategory[] = ['LEBENSMITTEL', 'HAUSHALT', 'MIETE_NEBENKOSTEN', 'SONSTIGES']

const SPLIT_MODES: SplitMode[] = ['EQUAL', 'INDIVIDUAL', 'PERCENTAGE']
const SPLIT_MODE_LABELS: Record<SplitMode, string> = {
  EQUAL: 'Gleich',
  INDIVIDUAL: 'Individuell',
  PERCENTAGE: 'Prozentuell',
}

function todayIso() {
  return new Date().toISOString().split('T')[0]
}

function buildSplitsPayload(
  splitMode: SplitMode,
  splitWith: string[],
  individual: Record<string, string>,
  percentages: Record<string, string>
): Record<string, number> | undefined {
  if (splitMode === 'INDIVIDUAL') {
    const obj: Record<string, number> = {}
    for (const uid of splitWith) obj[uid] = parseFloat(individual[uid] ?? '0') || 0
    return obj
  }
  if (splitMode === 'PERCENTAGE') {
    const obj: Record<string, number> = {}
    for (const uid of splitWith) obj[uid] = parseFloat(percentages[uid] ?? '0') || 0
    return obj
  }
  return undefined
}

function individualSum(individual: Record<string, string>, splitWith: string[]): number {
  return splitWith.reduce((s, uid) => s + (parseFloat(individual[uid] ?? '0') || 0), 0)
}

function percentageSum(percentages: Record<string, string>, splitWith: string[]): number {
  return splitWith.reduce((s, uid) => s + (parseFloat(percentages[uid] ?? '0') || 0), 0)
}

// ─── ExpenseForm ──────────────────────────────────────────────────────────────

interface ExpenseFormProps {
  members: SimpleUser[]
  currentUserId: string
  initialData?: {
    amount: string
    description: string
    category: ExpenseCategory
    paidBy: string
    splitMode: SplitMode
    splitWith: string[]
    individual: Record<string, string>
    percentages: Record<string, string>
    date: string
  }
  onSubmit: (data: {
    amount: number
    description: string
    category: ExpenseCategory
    paidBy: string
    splitMode: SplitMode
    splitWith: string[]
    splits?: Record<string, number>
    date: string
  }) => Promise<string | null>
  onCancel: () => void
  submitLabel?: string
}

function ExpenseForm({ members, currentUserId, initialData, onSubmit, onCancel, submitLabel = 'Speichern' }: ExpenseFormProps) {
  const [amount, setAmount] = React.useState(initialData?.amount ?? '')
  const [description, setDescription] = React.useState(initialData?.description ?? '')
  const [category, setCategory] = React.useState<ExpenseCategory>(initialData?.category ?? 'SONSTIGES')
  const [paidBy, setPaidBy] = React.useState(initialData?.paidBy ?? currentUserId)
  const [splitMode, setSplitMode] = React.useState<SplitMode>(initialData?.splitMode ?? 'EQUAL')
  const [splitWith, setSplitWith] = React.useState<string[]>(
    initialData?.splitWith ?? members.map((m) => m.id)
  )
  const [individual, setIndividual] = React.useState<Record<string, string>>(initialData?.individual ?? {})
  const [percentages, setPercentages] = React.useState<Record<string, string>>(initialData?.percentages ?? {})
  const [date, setDate] = React.useState(initialData?.date ?? todayIso())
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState('')

  const parsedAmount = parseFloat(amount.replace(',', '.')) || 0

  const toggleSplitWith = (uid: string) => {
    setSplitWith((prev) => (prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!parsedAmount || parsedAmount <= 0 || !description.trim()) return
    if (splitWith.length === 0) { setError('Mindestens eine Person für die Aufteilung auswählen'); return }
    if (splitMode === 'INDIVIDUAL') {
      const sum = individualSum(individual, splitWith)
      if (Math.abs(sum - parsedAmount) > 0.01) { setError(`Summe der Beträge (${formatCurrency(sum)}) muss dem Gesamtbetrag (${formatCurrency(parsedAmount)}) entsprechen`); return }
    }
    if (splitMode === 'PERCENTAGE') {
      const sum = percentageSum(percentages, splitWith)
      if (Math.abs(sum - 100) > 0.01) { setError(`Prozentsätze müssen 100% ergeben (aktuell: ${sum.toFixed(1)}%)`); return }
    }
    setSubmitting(true)
    setError('')
    const splits = buildSplitsPayload(splitMode, splitWith, individual, percentages)
    const err = await onSubmit({ amount: parsedAmount, description: description.trim(), category, paidBy, splitMode, splitWith, splits, date: new Date(date).toISOString() })
    if (err) setError(err)
    setSubmitting(false)
  }

  const indSum = individualSum(individual, splitWith)
  const pctSum = percentageSum(percentages, splitWith)

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Amount + Date */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="exp-amount">Betrag (€)</Label>
          <Input
            id="exp-amount"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            disabled={submitting}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="exp-date">Datum</Label>
          <Input
            id="exp-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={submitting}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="exp-category">Kategorie</Label>
          <select
            id="exp-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
            className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={submitting}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1">
        <Label htmlFor="exp-description">Titel / Beschreibung</Label>
        <Input
          id="exp-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Wofür?"
          disabled={submitting}
        />
      </div>

      {/* Payer */}
      <div className="space-y-1">
        <Label>Zahler (wer hat vorgestreckt?)</Label>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setPaidBy(m.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors',
                paidBy === m.id
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-semibold'
                  : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
              )}
            >
              <Avatar className="h-4 w-4">
                {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt={m.name} />}
                <AvatarFallback className="text-[8px]">{getInitials(m.name)}</AvatarFallback>
              </Avatar>
              {m.name}{m.id === currentUserId && ' (Du)'}
            </button>
          ))}
        </div>
      </div>

      {/* Split mode tabs */}
      <div className="space-y-3">
        <div className="space-y-1">
          <Label>Aufteilungsmodus</Label>
          <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-1 gap-1">
            {SPLIT_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setSplitMode(mode)}
                className={cn(
                  'flex-1 rounded-md py-1.5 text-xs font-medium transition-colors',
                  splitMode === mode
                    ? 'bg-white text-indigo-700 shadow-sm border border-gray-200'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                {SPLIT_MODE_LABELS[mode]}
              </button>
            ))}
          </div>
        </div>

        {/* Participant selection */}
        <div className="space-y-1">
          <Label>Beteiligt</Label>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => {
              const selected = splitWith.includes(m.id)
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleSplitWith(m.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors',
                    selected
                      ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                  )}
                >
                  <Avatar className="h-4 w-4">
                    {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt={m.name} />}
                    <AvatarFallback className="text-[8px]">{getInitials(m.name)}</AvatarFallback>
                  </Avatar>
                  {m.name}{m.id === currentUserId && ' (Du)'}
                  {splitMode === 'EQUAL' && selected && parsedAmount > 0 && (
                    <span className="ml-1 text-indigo-500 font-semibold">
                      {formatCurrency(parsedAmount / splitWith.length)}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Individual amounts */}
        {splitMode === 'INDIVIDUAL' && splitWith.length > 0 && (
          <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-medium text-gray-600">Betrag pro Person</p>
            {splitWith.map((uid) => {
              const member = members.find((m) => m.id === uid)
              if (!member) return null
              return (
                <div key={uid} className="flex items-center gap-2">
                  <span className="text-sm text-gray-700 w-28 truncate">
                    {member.name}{uid === currentUserId && ' (Du)'}
                  </span>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={individual[uid] ?? ''}
                    onChange={(e) => setIndividual((prev) => ({ ...prev, [uid]: e.target.value }))}
                    placeholder="0,00"
                    className="h-8 text-sm w-28"
                    disabled={submitting}
                  />
                  <span className="text-xs text-gray-400">€</span>
                </div>
              )
            })}
            <div className={cn('text-xs font-medium', Math.abs(indSum - parsedAmount) < 0.01 ? 'text-green-600' : 'text-red-500')}>
              Summe: {formatCurrency(indSum)} / {formatCurrency(parsedAmount)}
            </div>
          </div>
        )}

        {/* Percentage inputs */}
        {splitMode === 'PERCENTAGE' && splitWith.length > 0 && (
          <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-medium text-gray-600">Prozentsatz pro Person</p>
            {splitWith.map((uid) => {
              const member = members.find((m) => m.id === uid)
              if (!member) return null
              const pct = parseFloat(percentages[uid] ?? '0') || 0
              const personAmt = parsedAmount * pct / 100
              return (
                <div key={uid} className="flex items-center gap-2">
                  <span className="text-sm text-gray-700 w-28 truncate">
                    {member.name}{uid === currentUserId && ' (Du)'}
                  </span>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={percentages[uid] ?? ''}
                    onChange={(e) => setPercentages((prev) => ({ ...prev, [uid]: e.target.value }))}
                    placeholder="0"
                    className="h-8 text-sm w-20"
                    disabled={submitting}
                  />
                  <span className="text-xs text-gray-400">%</span>
                  {parsedAmount > 0 && pct > 0 && (
                    <span className="text-xs text-gray-500">= {formatCurrency(personAmt)}</span>
                  )}
                </div>
              )
            })}
            <div className={cn('text-xs font-medium', Math.abs(pctSum - 100) < 0.01 ? 'text-green-600' : 'text-red-500')}>
              Gesamt: {pctSum.toFixed(1)}% {Math.abs(pctSum - 100) < 0.01 ? '✓' : '(muss 100% ergeben)'}
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={submitting}>
          Abbrechen
        </Button>
        <Button type="submit" size="sm" disabled={submitting || !amount || !description.trim()}>
          {submitting ? 'Speichern...' : submitLabel}
        </Button>
      </div>
    </form>
  )
}

// ─── SettleDialog ─────────────────────────────────────────────────────────────

function SettleDialog({
  settlement,
  onConfirm,
  onClose,
}: {
  settlement: NetSettlement
  onConfirm: (comment: string) => Promise<void>
  onClose: () => void
}) {
  const [comment, setComment] = React.useState('')
  const [loading, setLoading] = React.useState(false)

  const handleConfirm = async () => {
    setLoading(true)
    await onConfirm(comment)
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Schulden ausgleichen</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-3 mb-4 text-sm text-indigo-800">
          <strong>{settlement.fromUserName}</strong> zahlt <strong>{settlement.toUserName}</strong>
          {' '}<strong className="text-indigo-600">{formatCurrency(settlement.amount)}</strong>
        </div>
        <div className="space-y-1 mb-4">
          <Label htmlFor="settle-comment">Kommentar (optional)</Label>
          <Input
            id="settle-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="z.B. per PayPal, Bargeld..."
            disabled={loading}
          />
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>Abbrechen</Button>
          <Button size="sm" onClick={handleConfirm} disabled={loading}>
            <Check className="h-4 w-4 mr-1" />
            {loading ? 'Wird markiert...' : 'Als beglichen markieren'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── EditDialog ───────────────────────────────────────────────────────────────

function EditDialog({
  expense,
  members,
  currentUserId,
  onSave,
  onClose,
}: {
  expense: Expense
  members: SimpleUser[]
  currentUserId: string
  onSave: (id: string, data: Parameters<ExpenseFormProps['onSubmit']>[0]) => Promise<string | null>
  onClose: () => void
}) {
  const initialData = {
    amount: expense.amount.toFixed(2),
    description: expense.description,
    category: expense.category,
    paidBy: expense.paidBy,
    splitMode: expense.splitMode,
    splitWith: expense.splitWith,
    individual: expense.splitMode === 'INDIVIDUAL' && expense.splits
      ? Object.fromEntries(Object.entries(expense.splits).map(([k, v]) => [k, v.toFixed(2)]))
      : {},
    percentages: expense.splitMode === 'PERCENTAGE' && expense.splits
      ? Object.fromEntries(Object.entries(expense.splits).map(([k, v]) => [k, v.toFixed(1)]))
      : {},
    date: expense.date.split('T')[0],
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl my-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Edit2 className="h-4 w-4 text-indigo-500" />
            Ausgabe bearbeiten
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <ExpenseForm
          members={members}
          currentUserId={currentUserId}
          initialData={initialData}
          onSubmit={(data) => onSave(expense.id, data)}
          onCancel={onClose}
          submitLabel="Änderungen speichern"
        />
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const { data: session } = useSession()
  const myId = session?.user?.id ?? ''

  const [expenses, setExpenses] = React.useState<Expense[]>([])
  const [settlements, setSettlements] = React.useState<NetSettlement[]>([])
  const [settlementHistory, setSettlementHistory] = React.useState<SettlementRecord[]>([])
  const [members, setMembers] = React.useState<SimpleUser[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')

  const [showForm, setShowForm] = React.useState(false)
  const [editingExpense, setEditingExpense] = React.useState<Expense | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [settlingSettlement, setSettlingSettlement] = React.useState<NetSettlement | null>(null)

  // Filters
  const [filterCategory, setFilterCategory] = React.useState<string>('all')
  const [filterPeriod, setFilterPeriod] = React.useState<string>('all')
  const [filterPerson, setFilterPerson] = React.useState<string>('all')

  const fetchData = React.useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [expRes, settleRes, usersRes, historyRes] = await Promise.all([
        fetch('/api/expenses'),
        fetch('/api/expenses/settlements'),
        fetch('/api/users'),
        fetch('/api/expenses/settlements/history'),
      ])
      if (!expRes.ok) throw new Error('Fehler beim Laden der Ausgaben')
      const [expData, settleData, usersData, historyData] = await Promise.all([
        expRes.json(),
        settleRes.ok ? settleRes.json() : { settlements: [] },
        usersRes.ok ? usersRes.json() : { users: [] },
        historyRes.ok ? historyRes.json() : { settlements: [] },
      ])
      setExpenses(expData.expenses ?? [])
      setSettlements(settleData.settlements ?? [])
      setMembers(usersData.users ?? [])
      setSettlementHistory(historyData.settlements ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { fetchData() }, [fetchData])

  const handleAdd = async (data: Parameters<ExpenseFormProps['onSubmit']>[0]): Promise<string | null> => {
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) return json.error ?? 'Fehler beim Speichern'
      setShowForm(false)
      fetchData()
      return null
    } catch {
      return 'Netzwerkfehler. Bitte erneut versuchen.'
    }
  }

  const handleEdit = async (id: string, data: Parameters<ExpenseFormProps['onSubmit']>[0]): Promise<string | null> => {
    try {
      const res = await fetch(`/api/expenses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) return json.error ?? 'Fehler beim Bearbeiten'
      setEditingExpense(null)
      fetchData()
      return null
    } catch {
      return 'Netzwerkfehler. Bitte erneut versuchen.'
    }
  }

  const handleDelete = async (expenseId: string) => {
    setDeletingId(expenseId)
    try {
      const res = await fetch(`/api/expenses/${expenseId}`, { method: 'DELETE' })
      if (res.ok) fetchData()
    } catch {
      // ignore
    } finally {
      setDeletingId(null)
    }
  }

  const handleSettle = async (comment: string) => {
    if (!settlingSettlement) return
    const s = settlingSettlement
    setSettlingSettlement(null)
    try {
      await fetch('/api/expenses/settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromUserId: s.fromUserId, toUserId: s.toUserId, amount: s.amount, comment }),
      })
      fetchData()
    } catch {
      // ignore
    }
  }

  // Filtered expenses for history
  const filteredExpenses = React.useMemo(() => {
    return expenses.filter((e) => {
      if (filterCategory !== 'all' && e.category !== filterCategory) return false
      if (filterPerson !== 'all' && e.paidBy !== filterPerson && !e.splitWith.includes(filterPerson)) return false
      if (filterPeriod !== 'all') {
        const d = new Date(e.date)
        const now = new Date()
        if (filterPeriod === 'this_month') {
          if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false
        } else if (filterPeriod === 'last_3months') {
          const cutoff = new Date(now.getFullYear(), now.getMonth() - 2, 1)
          if (d < cutoff) return false
        }
      }
      return true
    })
  }, [expenses, filterCategory, filterPeriod, filterPerson])

  const chartData = React.useMemo(() => {
    return CATEGORIES.map((cat) => ({
      name: CATEGORY_LABELS[cat],
      Betrag: expenses.filter((e) => e.category === cat).reduce((sum, e) => sum + e.amount, 0),
    })).filter((d) => d.Betrag > 0)
  }, [expenses])

  const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0)
  const myPaidExpenses = expenses.filter((e) => e.paidBy === myId)
  const myPaidTotal = myPaidExpenses.reduce((sum, e) => sum + e.amount, 0)
  const iOwe = settlements.filter((s) => s.fromUserId === myId).reduce((s, x) => s + x.amount, 0)
  const owedToMe = settlements.filter((s) => s.toUserId === myId).reduce((s, x) => s + x.amount, 0)

  const myDebts = settlements.filter((s) => s.fromUserId === myId)
  const othersDebts = settlements.filter((s) => s.toUserId === myId)

  const memberMap = React.useMemo(
    () => new Map(members.map((m) => [m.id, m])),
    [members]
  )

  const getExpenseSplitDetail = (expense: Expense): string => {
    if (expense.splitMode === 'EQUAL') {
      return `gleichmäßig auf ${expense.splitWith.length} Personen (${formatCurrency(expense.amount / expense.splitWith.length)} je)`
    }
    if (expense.splitMode === 'INDIVIDUAL' && expense.splits) {
      const parts = expense.splitWith.map((uid) => {
        const name = uid === myId ? 'Du' : (memberMap.get(uid)?.name ?? uid)
        return `${name}: ${formatCurrency(expense.splits![uid] ?? 0)}`
      })
      return parts.join(', ')
    }
    if (expense.splitMode === 'PERCENTAGE' && expense.splits) {
      const parts = expense.splitWith.map((uid) => {
        const name = uid === myId ? 'Du' : (memberMap.get(uid)?.name ?? uid)
        return `${name}: ${expense.splits![uid] ?? 0}%`
      })
      return parts.join(', ')
    }
    return ''
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finanzen</h1>
          <p className="text-sm text-gray-500 mt-1">Ausgaben und Schuldenausgleich</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            <span className="hidden sm:inline ml-1">Aktualisieren</span>
          </Button>
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">Ausgabe</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {/* ── Summary Cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Gesamt WG</CardDescription>
            <CardTitle className="text-2xl font-bold text-indigo-600">
              {loading ? <Skeleton className="h-8 w-24" /> : formatCurrency(totalAmount)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-400">{expenses.length} Ausgaben</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Meine Zahlungen</CardDescription>
            <CardTitle className="text-2xl font-bold text-purple-600">
              {loading ? <Skeleton className="h-8 w-24" /> : formatCurrency(myPaidTotal)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-400">{myPaidExpenses.length} Ausgaben bezahlt</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Ich schulde</CardDescription>
            <CardTitle className={cn('text-2xl font-bold', iOwe > 0 ? 'text-red-500' : 'text-gray-400')}>
              {loading ? <Skeleton className="h-8 w-24" /> : formatCurrency(iOwe)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-400">{myDebts.length} offene Posten</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Mir schuldet man</CardDescription>
            <CardTitle className={cn('text-2xl font-bold', owedToMe > 0 ? 'text-green-600' : 'text-gray-400')}>
              {loading ? <Skeleton className="h-8 w-24" /> : formatCurrency(owedToMe)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-400">{othersDebts.length} offene Posten</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Add Form ── */}
      {showForm && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-5 w-5 text-indigo-500" />
              Neue Ausgabe
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ExpenseForm
              members={members}
              currentUserId={myId}
              onSubmit={handleAdd}
              onCancel={() => setShowForm(false)}
            />
          </CardContent>
        </Card>
      )}

      {/* ── Schulden (Settle Up) ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-5 w-5 text-indigo-500" />
              Schuldenausgleich
            </CardTitle>
            <CardDescription>Minimale Transaktionen (Greedy-Algorithmus)</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : settlements.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">Keine offenen Schulden 🎉</p>
            ) : (
              <div className="space-y-2">
                {settlements.map((s) => {
                  const isMyDebt = s.fromUserId === myId
                  const isOwedToMe = s.toUserId === myId
                  return (
                    <div
                      key={`${s.fromUserId}-${s.toUserId}`}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border p-3',
                        isMyDebt ? 'border-red-200 bg-red-50' : isOwedToMe ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'
                      )}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className={cn('text-sm font-medium truncate', isMyDebt ? 'text-red-700' : 'text-gray-700')}>
                          {isMyDebt ? 'Du' : s.fromUserName}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        <span className={cn('text-sm font-medium truncate', isOwedToMe ? 'text-green-700' : 'text-gray-700')}>
                          {isOwedToMe ? 'Dir' : s.toUserName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={cn('font-semibold text-sm', isMyDebt ? 'text-red-600' : isOwedToMe ? 'text-green-600' : 'text-gray-700')}>
                          {formatCurrency(s.amount)}
                        </span>
                        {isMyDebt && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-2"
                            onClick={() => setSettlingSettlement(s)}
                          >
                            Begleichen
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-5 w-5 text-indigo-500" />
              Ausgaben nach Kategorie
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-end gap-4 h-40">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="flex-1" style={{ height: `${(i + 1) * 25}%` }} />)}
              </div>
            ) : chartData.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">Keine Daten vorhanden</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}€`} />
                  <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Betrag']} contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }} />
                  <Bar dataKey="Betrag" radius={[4, 4, 0, 0]} fill="#6366f1" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Ausgaben-Historie ── */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Receipt className="h-5 w-5 text-indigo-500" />
                Ausgaben-Historie
              </CardTitle>
              <CardDescription>{filteredExpenses.length} von {expenses.length} Ausgaben</CardDescription>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 pt-2">
            <select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value)}
              className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">Alle Zeiträume</option>
              <option value="this_month">Dieser Monat</option>
              <option value="last_3months">Letzte 3 Monate</option>
            </select>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">Alle Kategorien</option>
              {CATEGORIES.map((cat) => <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>)}
            </select>
            <select
              value={filterPerson}
              onChange={(e) => setFilterPerson(e.target.value)}
              className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">Alle Personen</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}{m.id === myId ? ' (Du)' : ''}</option>)}
            </select>
            {(filterPeriod !== 'all' || filterCategory !== 'all' || filterPerson !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => { setFilterPeriod('all'); setFilterCategory('all'); setFilterPerson('all') }}
              >
                <X className="h-3 w-3 mr-1" />
                Filter zurücksetzen
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="px-6 py-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}
            </div>
          ) : filteredExpenses.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">Keine Ausgaben gefunden</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filteredExpenses.map((expense) => {
                const canEdit = expense.paidBy === myId
                const canDelete = expense.paidBy === myId
                const isDeleting = deletingId === expense.id
                const splitDetail = getExpenseSplitDetail(expense)
                return (
                  <li key={expense.id} className="flex items-start gap-3 px-6 py-3 group hover:bg-gray-50">
                    <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                      {expense.paidByUser.avatarUrl && (
                        <AvatarImage src={expense.paidByUser.avatarUrl} alt={expense.paidByUser.name} />
                      )}
                      <AvatarFallback className="text-xs bg-indigo-100 text-indigo-700">
                        {getInitials(expense.paidByUser.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{expense.description}</p>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        <span className="text-xs text-gray-400">{expense.paidByUser.name} bezahlt</span>
                        <Separator orientation="vertical" className="h-3" />
                        <span className="text-xs text-gray-400">{formatDate(expense.date)}</span>
                      </div>
                      {splitDetail && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          Aufgeteilt: {splitDetail}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge className={CATEGORY_COLORS[expense.category]} variant="outline">
                        {CATEGORY_LABELS[expense.category]}
                      </Badge>
                      <span className="font-semibold text-sm text-gray-900 ml-1">
                        {formatCurrency(expense.amount)}
                      </span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {canEdit && (
                          <button
                            onClick={() => setEditingExpense(expense)}
                            className="p-1.5 rounded-lg text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 transition-colors"
                            title="Ausgabe bearbeiten"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(expense.id)}
                            disabled={isDeleting}
                            className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                            title="Ausgabe löschen"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ── Ausgleich-Historie ── */}
      {settlementHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-5 w-5 text-indigo-500" />
              Ausgleich-Historie
            </CardTitle>
            <CardDescription>Vergangene Schuldenausgleiche</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-gray-100">
              {settlementHistory.map((s) => {
                const isMyPayment = s.fromUserId === myId
                const isReceivedByMe = s.toUserId === myId
                return (
                  <li key={s.id} className="flex items-center gap-3 px-6 py-3">
                    <div className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full shrink-0',
                      isMyPayment ? 'bg-red-50' : isReceivedByMe ? 'bg-green-50' : 'bg-gray-50'
                    )}>
                      {isMyPayment ? (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      ) : (
                        <Check className="h-4 w-4 text-green-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {isMyPayment ? 'Du' : s.fromUser.name}
                        {' → '}
                        {isReceivedByMe ? 'Dir' : s.toUser.name}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-gray-400">{formatDate(s.createdAt)}</span>
                        {s.comment && (
                          <>
                            <Separator orientation="vertical" className="h-3" />
                            <span className="text-xs text-gray-400 italic">{s.comment}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className={cn('font-semibold text-sm shrink-0', isMyPayment ? 'text-red-600' : isReceivedByMe ? 'text-green-600' : 'text-gray-700')}>
                      {formatCurrency(s.amount)}
                    </span>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* ── Dialogs ── */}
      {settlingSettlement && (
        <SettleDialog
          settlement={settlingSettlement}
          onConfirm={handleSettle}
          onClose={() => setSettlingSettlement(null)}
        />
      )}

      {editingExpense && (
        <EditDialog
          expense={editingExpense}
          members={members}
          currentUserId={myId}
          onSave={handleEdit}
          onClose={() => setEditingExpense(null)}
        />
      )}
    </div>
  )
}
