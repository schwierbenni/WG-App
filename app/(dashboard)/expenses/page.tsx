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
  date: string
  settledAt: string | null
  paidByUser: SimpleUser
}

interface Settlement {
  fromUserId: string
  fromUserName: string
  toUserId: string
  toUserName: string
  amount: number
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

export default function ExpensesPage() {
  const { data: session } = useSession()
  const [expenses, setExpenses] = React.useState<Expense[]>([])
  const [settlements, setSettlements] = React.useState<Settlement[]>([])
  const [members, setMembers] = React.useState<SimpleUser[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [settleLoading, setSettleLoading] = React.useState<string | null>(null)

  const [showForm, setShowForm] = React.useState(false)
  const [amount, setAmount] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [category, setCategory] = React.useState<ExpenseCategory>('SONSTIGES')
  const [splitWith, setSplitWith] = React.useState<string[]>([])
  const [submitting, setSubmitting] = React.useState(false)
  const [submitError, setSubmitError] = React.useState('')

  const fetchData = React.useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [expRes, settleRes, usersRes] = await Promise.all([
        fetch('/api/expenses'),
        fetch('/api/expenses/settlements'),
        fetch('/api/users'),
      ])
      if (!expRes.ok) throw new Error('Fehler beim Laden der Ausgaben')
      const [expData, settleData, usersData] = await Promise.all([
        expRes.json(),
        settleRes.ok ? settleRes.json() : { settlements: [] },
        usersRes.ok ? usersRes.json() : { users: [] },
      ])
      setExpenses(expData.expenses ?? [])
      setSettlements(settleData.settlements ?? [])
      setMembers(usersData.users ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  React.useEffect(() => {
    if (members.length > 0) {
      setSplitWith(members.map((m) => m.id))
    }
  }, [members])

  const handleToggleSplitWith = (userId: string) => {
    setSplitWith((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsedAmount = parseFloat(amount.replace(',', '.'))
    if (!parsedAmount || parsedAmount <= 0 || !description.trim()) return
    if (splitWith.length === 0) {
      setSubmitError('Wähle mindestens eine Person für die Aufteilung aus')
      return
    }
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parsedAmount,
          description: description.trim(),
          category,
          splitWith,
          date: new Date().toISOString(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSubmitError(data.error ?? 'Fehler beim Speichern')
      } else {
        setAmount('')
        setDescription('')
        setCategory('SONSTIGES')
        setSplitWith(members.map((m) => m.id))
        setShowForm(false)
        fetchData()
      }
    } catch {
      setSubmitError('Netzwerkfehler. Bitte erneut versuchen.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSettle = async (settlement: Settlement) => {
    const key = `${settlement.fromUserId}-${settlement.toUserId}`
    setSettleLoading(key)
    try {
      await fetch('/api/expenses')
      fetchData()
    } catch {
      // ignore
    } finally {
      setSettleLoading(null)
    }
  }

  const chartData = React.useMemo(() => {
    return CATEGORIES.map((cat) => ({
      name: CATEGORY_LABELS[cat],
      Betrag: expenses
        .filter((e) => e.category === cat)
        .reduce((sum, e) => sum + e.amount, 0),
    })).filter((d) => d.Betrag > 0)
  }, [expenses])

  const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0)
  const myExpenses = expenses.filter((e) => e.paidBy === session?.user?.id)
  const myTotal = myExpenses.reduce((sum, e) => sum + e.amount, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finanzen</h1>
          <p className="text-sm text-gray-500 mt-1">Ausgaben und Schuldenausgleich</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            <span className="hidden sm:inline">Aktualisieren</span>
          </Button>
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Ausgabe</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Gesamt</CardDescription>
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
            <CardDescription className="text-xs font-medium">Meine Ausgaben</CardDescription>
            <CardTitle className="text-2xl font-bold text-purple-600">
              {loading ? <Skeleton className="h-8 w-24" /> : formatCurrency(myTotal)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-400">{myExpenses.length} Ausgaben bezahlt</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Offene Schulden</CardDescription>
            <CardTitle className="text-2xl font-bold text-red-500">
              {loading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                formatCurrency(
                  settlements
                    .filter((s) => s.fromUserId === session?.user?.id)
                    .reduce((sum, s) => sum + s.amount, 0)
                )
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-400">
              {settlements.filter((s) => s.fromUserId === session?.user?.id).length} offene Posten
            </p>
          </CardContent>
        </Card>
      </div>

      {showForm && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-5 w-5 text-indigo-500" />
              Neue Ausgabe
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
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
                  <Label htmlFor="exp-category">Kategorie</Label>
                  <select
                    id="exp-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                    className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={submitting}
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {CATEGORY_LABELS[cat]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="exp-description">Beschreibung</Label>
                <Input
                  id="exp-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Wofür?"
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label>Aufteilen mit</Label>
                <div className="flex flex-wrap gap-2">
                  {members.map((member) => {
                    const selected = splitWith.includes(member.id)
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => handleToggleSplitWith(member.id)}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors',
                          selected
                            ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                            : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                        )}
                      >
                        <Avatar className="h-4 w-4">
                          {member.avatarUrl && (
                            <AvatarImage src={member.avatarUrl} alt={member.name} />
                          )}
                          <AvatarFallback className="text-[8px]">{getInitials(member.name)}</AvatarFallback>
                        </Avatar>
                        {member.name}
                        {member.id === session?.user?.id && ' (Du)'}
                      </button>
                    )
                  })}
                </div>
              </div>
              {submitError && (
                <p className="text-sm text-red-600 bg-red-50 rounded p-2">{submitError}</p>
              )}
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowForm(false)}
                  disabled={submitting}
                >
                  Abbrechen
                </Button>
                <Button type="submit" size="sm" disabled={submitting || !amount || !description.trim()}>
                  {submitting ? 'Speichern...' : 'Speichern'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-5 w-5 text-indigo-500" />
              Schulden
            </CardTitle>
            <CardDescription>Wer schuldet wem was</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : settlements.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">
                Keine offenen Schulden 🎉
              </p>
            ) : (
              <div className="space-y-2">
                {settlements.map((s) => {
                  const key = `${s.fromUserId}-${s.toUserId}`
                  const isMe = s.fromUserId === session?.user?.id
                  return (
                    <div
                      key={key}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border p-3',
                        isMe ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'
                      )}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-sm font-medium text-gray-700 truncate">
                          {isMe ? 'Du' : s.fromUserName}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        <span className="text-sm font-medium text-gray-700 truncate">
                          {s.toUserId === session?.user?.id ? 'Dir' : s.toUserName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={cn('font-semibold text-sm', isMe ? 'text-red-600' : 'text-gray-700')}>
                          {formatCurrency(s.amount)}
                        </span>
                        {isMe && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-2"
                            disabled={settleLoading === key}
                            onClick={() => handleSettle(s)}
                          >
                            Beglichen
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
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="flex-1" style={{ height: `${(i + 1) * 25}%` }} />
                ))}
              </div>
            ) : chartData.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">Keine Daten vorhanden</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}€`}
                  />
                  <Tooltip
                    formatter={(value) => [formatCurrency(Number(value)), 'Betrag']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                  />
                  <Bar dataKey="Betrag" radius={[4, 4, 0, 0]} fill="#6366f1" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-5 w-5 text-indigo-500" />
            Letzte Ausgaben
          </CardTitle>
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
          ) : expenses.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">Noch keine Ausgaben</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {expenses.map((expense) => (
                <li key={expense.id} className="flex items-center gap-3 px-6 py-3">
                  <Avatar className="h-8 w-8 shrink-0">
                    {expense.paidByUser.avatarUrl && (
                      <AvatarImage src={expense.paidByUser.avatarUrl} alt={expense.paidByUser.name} />
                    )}
                    <AvatarFallback className="text-xs bg-indigo-100 text-indigo-700">
                      {getInitials(expense.paidByUser.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{expense.description}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-400">{expense.paidByUser.name}</span>
                      <Separator orientation="vertical" className="h-3" />
                      <span className="text-xs text-gray-400">{formatDate(expense.date)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={CATEGORY_COLORS[expense.category]} variant="outline">
                      {CATEGORY_LABELS[expense.category]}
                    </Badge>
                    <span className="font-semibold text-sm text-gray-900">
                      {formatCurrency(expense.amount)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
