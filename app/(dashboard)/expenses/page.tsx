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
  ChevronDown,
  ChevronUp,
  Settings,
  Tag,
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

type SplitMode = 'EQUAL' | 'INDIVIDUAL' | 'PERCENTAGE'

interface WGExpenseCategory {
  id: string
  name: string
  slug: string
  color: string
  emoji: string | null
  isDefault: boolean
  sortOrder: number
}

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
  category: string
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

const FALLBACK_CATEGORIES: WGExpenseCategory[] = [
  { id: 'fb-1', name: 'Lebensmittel', slug: 'LEBENSMITTEL',     color: '#16a34a', emoji: '🛒', isDefault: true, sortOrder: 1 },
  { id: 'fb-2', name: 'Haushalt',     slug: 'HAUSHALT',          color: '#2563eb', emoji: '🏠', isDefault: true, sortOrder: 2 },
  { id: 'fb-3', name: 'Miete & NK',   slug: 'MIETE_NEBENKOSTEN', color: '#9333ea', emoji: '🏡', isDefault: true, sortOrder: 3 },
  { id: 'fb-4', name: 'Sonstiges',    slug: 'SONSTIGES',         color: '#6b7280', emoji: '📝', isDefault: true, sortOrder: 4 },
  { id: 'fb-5', name: 'Skat',         slug: 'SKAT',              color: '#d97706', emoji: '🃏', isDefault: true, sortOrder: 5 },
  { id: 'fb-6', name: 'Doppelkopf',   slug: 'DOPPELKOPF',        color: '#ea580c', emoji: '🀄', isDefault: true, sortOrder: 6 },
]

const SPLIT_MODES: SplitMode[] = ['EQUAL', 'INDIVIDUAL', 'PERCENTAGE']
const SPLIT_MODE_LABELS: Record<SplitMode, string> = {
  EQUAL: 'Gleich',
  INDIVIDUAL: 'Individuell',
  PERCENTAGE: 'Prozentuell',
}

function todayIso() {
  return new Date().toISOString().split('T')[0]
}

function getCategoryBadgeStyle(color: string): React.CSSProperties {
  return {
    backgroundColor: `${color}20`,
    color: color,
    borderColor: `${color}50`,
  }
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

// ─── CategoryManager ──────────────────────────────────────────────────────────

const PRESET_EMOJIS = ['🛒','🍕','🚗','🏠','🎮','🍺','💊','📚','✈️','💻','👕','🎁','🐾','💇','🎵','🏋️','🔧','📝','🎭','💡','🏖️','🎉','🍔','🌿']

function CategoryManager({
  categories,
  onCreated,
  onDeleted,
  onClose,
}: {
  categories: WGExpenseCategory[]
  onCreated: (cat: WGExpenseCategory) => void
  onDeleted: (id: string) => void
  onClose: () => void
}) {
  const [name, setName] = React.useState('')
  const [color, setColor] = React.useState('#6366f1')
  const [emoji, setEmoji] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState('')
  const [deletingId, setDeletingId] = React.useState<string | null>(null)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/expenses/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), color, emoji: emoji || undefined }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Fehler'); return }
      onCreated(json.category)
      setName('')
      setEmoji('')
    } catch {
      setError('Netzwerkfehler')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await fetch(`/api/expenses/categories/${id}`, { method: 'DELETE' })
      onDeleted(id)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl my-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Tag className="h-4 w-4 text-indigo-500" />
            Kategorien verwalten
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Existing categories */}
        <div className="space-y-1.5 mb-4 max-h-48 overflow-y-auto">
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2 bg-gray-50">
              <span className="text-base w-6 text-center">{cat.emoji ?? '🏷️'}</span>
              <span
                className="flex-1 text-sm font-medium rounded-full px-2 py-0.5 border"
                style={getCategoryBadgeStyle(cat.color)}
              >
                {cat.name}
              </span>
              {cat.isDefault ? (
                <span className="text-[10px] text-gray-400">Standard</span>
              ) : (
                <button
                  onClick={() => handleDelete(cat.id)}
                  disabled={deletingId === cat.id}
                  className="p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        <Separator className="mb-4" />

        {/* Create new */}
        <form onSubmit={handleCreate} className="space-y-3">
          <p className="text-xs font-medium text-gray-600">Neue Kategorie hinzufügen</p>

          {/* Name + Color */}
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label htmlFor="cat-name" className="text-xs">Name</Label>
              <Input
                id="cat-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z.B. Freizeit"
                disabled={submitting}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Farbe</Label>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                disabled={submitting}
                className="h-9 w-9 cursor-pointer rounded border border-gray-200 p-0.5"
              />
            </div>
          </div>

          {/* Emoji picker */}
          <div className="space-y-1.5">
            <Label className="text-xs">Emoji {emoji && <span className="ml-1 text-base">{emoji}</span>}</Label>
            <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-gray-200 bg-gray-50">
              {PRESET_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(emoji === e ? '' : e)}
                  disabled={submitting}
                  className={cn(
                    'text-lg w-9 h-9 rounded-lg border flex items-center justify-center transition-all active:scale-90',
                    emoji === e
                      ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-400'
                      : 'border-gray-200 bg-white hover:bg-gray-100'
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          {name && (
            <div className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2 bg-gray-50">
              <span className="text-base w-6 text-center">{emoji || '🏷️'}</span>
              <span className="text-sm font-medium rounded-full px-2 py-0.5 border" style={getCategoryBadgeStyle(color)}>
                {name}
              </span>
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}
          <Button type="submit" disabled={submitting || !name.trim()} className="w-full" size="sm">
            <Plus className="h-3.5 w-3.5 mr-1" />
            {submitting ? 'Wird erstellt...' : 'Kategorie erstellen'}
          </Button>
        </form>
      </div>
    </div>
  )
}

// ─── ExpenseForm ──────────────────────────────────────────────────────────────

interface ExpenseFormProps {
  members: SimpleUser[]
  categories: WGExpenseCategory[]
  currentUserId: string
  initialData?: {
    amount: string
    description: string
    category: string
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
    category: string
    paidBy: string
    splitMode: SplitMode
    splitWith: string[]
    splits?: Record<string, number>
    date: string
  }) => Promise<string | null>
  onCancel: () => void
  submitLabel?: string
}

function ExpenseForm({ members, categories: rawCategories, currentUserId, initialData, onSubmit, onCancel, submitLabel = 'Speichern' }: ExpenseFormProps) {
  const categories = rawCategories.length > 0 ? rawCategories : FALLBACK_CATEGORIES
  const defaultCategory = categories.find((c) => c.slug === 'SONSTIGES')?.slug ?? categories[0]?.slug ?? 'SONSTIGES'
  const [amount, setAmount] = React.useState(initialData?.amount ?? '')
  const [description, setDescription] = React.useState(initialData?.description ?? '')
  const [category, setCategory] = React.useState(initialData?.category ?? defaultCategory)
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
      {/* Amount + Date + Category */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
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
            autoComplete="off"
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
        <div className="space-y-1 col-span-2 sm:col-span-1">
          <Label htmlFor="exp-category">Kategorie</Label>
          <select
            id="exp-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="flex h-11 w-full rounded-xl border-2 border-surface-border bg-white px-3 py-2 text-base focus:outline-none focus:border-brand-600"
            disabled={submitting}
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.slug}>
                {cat.emoji ? `${cat.emoji} ` : ''}{cat.name}
              </option>
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
                'inline-flex items-center gap-2 rounded-xl border-2 px-3 min-h-[44px] text-sm transition-all active:scale-95',
                paidBy === m.id
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-semibold'
                  : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
              )}
            >
              <Avatar className="h-6 w-6">
                {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt={m.name} />}
                <AvatarFallback className="text-[10px]">{getInitials(m.name)}</AvatarFallback>
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

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl p-2">{error}</p>}

      <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting} className="w-full sm:w-auto min-h-[44px]">
          Abbrechen
        </Button>
        <Button type="submit" disabled={submitting || !amount || !description.trim()} className="w-full sm:w-auto min-h-[44px]">
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
        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading} className="w-full sm:w-auto min-h-[44px] sm:min-h-0">
            Abbrechen
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={loading} className="w-full sm:w-auto min-h-[44px] sm:min-h-0">
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
  categories,
  currentUserId,
  onSave,
  onClose,
}: {
  expense: Expense
  members: SimpleUser[]
  categories: WGExpenseCategory[]
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
          categories={categories}
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
  const [categories, setCategories] = React.useState<WGExpenseCategory[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')

  const [showForm, setShowForm] = React.useState(false)
  const [editingExpense, setEditingExpense] = React.useState<Expense | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [settlingSettlement, setSettlingSettlement] = React.useState<NetSettlement | null>(null)
  const [expandedSettlements, setExpandedSettlements] = React.useState<Set<string>>(new Set())
  const [settlingExpenseId, setSettlingExpenseId] = React.useState<string | null>(null)
  const [showCategoryManager, setShowCategoryManager] = React.useState(false)
  const [showSettleAll, setShowSettleAll] = React.useState(false)
  const [settlingAll, setSettlingAll] = React.useState(false)

  // Filters
  const [filterCategory, setFilterCategory] = React.useState<string>('all')
  const [filterPeriod, setFilterPeriod] = React.useState<string>('all')
  const [filterPerson, setFilterPerson] = React.useState<string>('all')

  const fetchData = React.useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [expRes, settleRes, usersRes, historyRes, catRes] = await Promise.all([
        fetch('/api/expenses'),
        fetch('/api/expenses/settlements'),
        fetch('/api/users'),
        fetch('/api/expenses/settlements/history'),
        fetch('/api/expenses/categories'),
      ])
      if (!expRes.ok) throw new Error('Fehler beim Laden der Ausgaben')
      const [expData, settleData, usersData, historyData, catData] = await Promise.all([
        expRes.json(),
        settleRes.ok ? settleRes.json() : { settlements: [] },
        usersRes.ok ? usersRes.json() : { users: [] },
        historyRes.ok ? historyRes.json() : { settlements: [] },
        catRes.ok ? catRes.json() : { categories: [] },
      ])
      setExpenses(expData.expenses ?? [])
      setSettlements(settleData.settlements ?? [])
      setMembers(usersData.users ?? [])
      setSettlementHistory(historyData.settlements ?? [])
      setCategories(catData.categories ?? [])
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

  const handleSettleExpense = async (expenseId: string) => {
    setSettlingExpenseId(expenseId)
    try {
      await fetch(`/api/expenses/${expenseId}/settle`, { method: 'POST' })
      fetchData()
    } catch {
      // ignore
    } finally {
      setSettlingExpenseId(null)
    }
  }

  const toggleSettlementExpand = (key: string) => {
    setExpandedSettlements((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const getCategoryBySlug = React.useCallback((slug: string): WGExpenseCategory | undefined => {
    return categories.find((c) => c.slug === slug)
  }, [categories])

  const getShareForUser = (expense: Expense, userId: string): number => {
    if (expense.splitMode === 'INDIVIDUAL') return expense.splits?.[userId] ?? 0
    if (expense.splitMode === 'PERCENTAGE') return expense.amount * ((expense.splits?.[userId] ?? 0) / 100)
    return expense.amount / expense.splitWith.length
  }

  const getExpensesBetween = (userA: string, userB: string): Expense[] =>
    expenses.filter(
      (e) =>
        e.settledAt === null &&
        ((e.paidBy === userA && e.splitWith.includes(userB)) ||
          (e.paidBy === userB && e.splitWith.includes(userA)))
    )

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
    return categories.map((cat) => ({
      name: cat.name,
      Betrag: expenses.filter((e) => e.category === cat.slug).reduce((sum, e) => sum + e.amount, 0),
    })).filter((d) => d.Betrag > 0)
  }, [expenses, categories])

  const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0)
  const myPaidExpenses = expenses.filter((e) => e.paidBy === myId)
  const myPaidTotal = myPaidExpenses.reduce((sum, e) => sum + e.amount, 0)
  const iOwe = settlements.filter((s) => s.fromUserId === myId).reduce((s, x) => s + x.amount, 0)
  const owedToMe = settlements.filter((s) => s.toUserId === myId).reduce((s, x) => s + x.amount, 0)

  const myDebts = settlements.filter((s) => s.fromUserId === myId)
  const othersDebts = settlements.filter((s) => s.toUserId === myId)
  const myBalance = owedToMe - iOwe

  const allDebtLines = React.useMemo(() => {
    const lines: { text: string; negative: boolean }[] = []
    myDebts.forEach((s) => lines.push({ text: `Du schuldest ${s.toUserName} ${formatCurrency(s.amount)}`, negative: true }))
    othersDebts.forEach((s) => lines.push({ text: `${s.fromUserName} schuldet dir ${formatCurrency(s.amount)}`, negative: false }))
    return lines
  }, [myDebts, othersDebts])

  const handleSettleAll = async () => {
    setSettlingAll(true)
    setShowSettleAll(false)
    const mySettlements = settlements.filter((s) => s.fromUserId === myId || s.toUserId === myId)
    for (const s of mySettlements) {
      try {
        await fetch('/api/expenses/settlements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fromUserId: s.fromUserId, toUserId: s.toUserId, amount: s.amount, comment: 'Alle Schulden ausgeglichen' }),
        })
      } catch { /* ignore individual errors */ }
    }
    setSettlingAll(false)
    fetchData()
  }

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

      {/* ── WG-Kasse (persönliche Schuldenübersicht) ── */}
      <Card className="border-2 border-surface-border">
        <CardContent className="pt-4 pb-4">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-40" />
            </div>
          ) : (
            <>
              {/* Header row */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 shrink-0">
                  <Wallet className="h-5 w-5 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900">WG-Kasse</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {myBalance === 0
                      ? 'Alles ausgeglichen ✓'
                      : myBalance > 0
                      ? `Du bekommst ${formatCurrency(owedToMe)}`
                      : `Du schuldest ${formatCurrency(iOwe)}`}
                  </p>
                </div>
                {myBalance !== 0 && (
                  <span className={cn('text-xl font-extrabold shrink-0', myBalance > 0 ? 'text-green-600' : 'text-red-500')}>
                    {myBalance > 0 ? '+' : ''}{formatCurrency(Math.abs(myBalance))}
                  </span>
                )}
              </div>

              {/* Debt lines */}
              {allDebtLines.length > 0 && (
                <div className="space-y-1 mb-3">
                  {allDebtLines.map((line, i) => (
                    <p key={i} className={cn('text-xs font-medium', line.negative ? 'text-red-600' : 'text-green-600')}>
                      {line.text}
                    </p>
                  ))}
                </div>
              )}

              {/* Settle-all button */}
              {allDebtLines.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-9 text-xs font-medium"
                  onClick={() => setShowSettleAll(true)}
                  disabled={settlingAll}
                >
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                  {settlingAll ? 'Wird ausgeglichen...' : 'Alle Schulden begleichen'}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Settle-All Confirmation Dialog ── */}
      {showSettleAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Alle Schulden begleichen</h3>
              <button onClick={() => setShowSettleAll(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 mb-4 space-y-1">
              {allDebtLines.map((line, i) => (
                <p key={i} className={cn('text-xs font-medium', line.negative ? 'text-red-600' : 'text-green-600')}>
                  {line.text}
                </p>
              ))}
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Alle offenen Schulden werden als beglichen markiert. Das kann nicht rückgängig gemacht werden.
            </p>
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowSettleAll(false)} className="w-full sm:w-auto min-h-[44px] sm:min-h-0">
                Abbrechen
              </Button>
              <Button size="sm" onClick={handleSettleAll} className="w-full sm:w-auto min-h-[44px] sm:min-h-0">
                <Check className="h-4 w-4 mr-1" />
                Alle als beglichen markieren
              </Button>
            </div>
          </div>
        </div>
      )}

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
              categories={categories}
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
            <CardDescription>Minimale Transaktionen</CardDescription>
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
                  const key = `${s.fromUserId}-${s.toUserId}`
                  const isMyDebt = s.fromUserId === myId
                  const isOwedToMe = s.toUserId === myId
                  const isExpanded = expandedSettlements.has(key)
                  const pairExpenses = isExpanded ? getExpensesBetween(s.fromUserId, s.toUserId) : []

                  return (
                    <div key={key} className={cn('rounded-lg border overflow-hidden', isMyDebt ? 'border-red-200' : isOwedToMe ? 'border-green-200' : 'border-gray-200')}>
                      {/* Settlement header row - mobile optimized */}
                      <div className={cn('p-3', isMyDebt ? 'bg-red-50' : isOwedToMe ? 'bg-green-50' : 'bg-white')}>
                        {/* Names row: grid gives equal space to both sides */}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => toggleSettlementExpand(key)}
                            className="shrink-0 p-1"
                          >
                            {isExpanded
                              ? <ChevronUp className="h-3.5 w-3.5 text-gray-400" />
                              : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
                          </button>
                          {/* Equal-width grid for from/arrow/to */}
                          <div className="flex-1 grid grid-cols-[1fr_auto_1fr] items-center gap-1 min-w-0">
                            <div className="flex items-center gap-1 min-w-0">
                              <Avatar className="h-5 w-5 shrink-0">
                                {memberMap.get(s.fromUserId)?.avatarUrl && <AvatarImage src={memberMap.get(s.fromUserId)!.avatarUrl!} alt={s.fromUserName} />}
                                <AvatarFallback className="text-[8px] bg-indigo-100 text-indigo-700">{getInitials(s.fromUserName)}</AvatarFallback>
                              </Avatar>
                              <span className={cn('text-sm font-medium truncate', isMyDebt ? 'text-red-700' : 'text-gray-700')}>
                                {isMyDebt ? 'Du' : s.fromUserName}
                              </span>
                            </div>
                            <ArrowRight className="h-3 w-3 text-gray-400 shrink-0" />
                            <div className="flex items-center gap-1 min-w-0">
                              <Avatar className="h-5 w-5 shrink-0">
                                {memberMap.get(s.toUserId)?.avatarUrl && <AvatarImage src={memberMap.get(s.toUserId)!.avatarUrl!} alt={s.toUserName} />}
                                <AvatarFallback className="text-[8px] bg-indigo-100 text-indigo-700">{getInitials(s.toUserName)}</AvatarFallback>
                              </Avatar>
                              <span className={cn('text-sm font-medium truncate', isOwedToMe ? 'text-green-700' : 'text-gray-700')}>
                                {isOwedToMe ? 'Dir' : s.toUserName}
                              </span>
                            </div>
                          </div>
                          <span className={cn('font-semibold text-sm shrink-0 ml-1', isMyDebt ? 'text-red-600' : isOwedToMe ? 'text-green-600' : 'text-gray-700')}>
                            {formatCurrency(s.amount)}
                          </span>
                        </div>
                        {/* Settle button: full width on mobile */}
                        {(isMyDebt || isOwedToMe) && (
                          <div className="mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs w-full sm:w-auto"
                              onClick={() => setSettlingSettlement(s)}
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Alles begleichen
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Expanded: individual expenses */}
                      {isExpanded && (
                        <div className="border-t border-gray-100 divide-y divide-gray-100 bg-white">
                          {pairExpenses.length === 0 ? (
                            <p className="text-xs text-gray-400 px-4 py-3 text-center">Keine einzelnen Ausgaben gefunden</p>
                          ) : (
                            pairExpenses.map((exp) => {
                              const relevantUserId = exp.paidBy === s.toUserId ? s.fromUserId : s.toUserId
                              const shareAmount = getShareForUser(exp, relevantUserId)
                              const isSettling = settlingExpenseId === exp.id
                              const isDeleting = deletingId === exp.id

                              return (
                                <div key={exp.id} className="flex items-center gap-3 px-4 py-2.5 group">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-gray-800 truncate">{exp.description}</p>
                                    <p className="text-[11px] text-gray-400 mt-0.5">
                                      {exp.paidBy === myId ? 'Du hast bezahlt' : `${memberMap.get(exp.paidBy)?.name ?? exp.paidBy} hat bezahlt`}
                                      {' · '}{formatDate(exp.date)}
                                    </p>
                                  </div>
                                  <span className="text-xs font-semibold text-gray-700 shrink-0">
                                    {formatCurrency(shareAmount)}
                                    <span className="text-gray-400 font-normal">
                                      {exp.paidBy === s.toUserId
                                        ? ` (${s.fromUserId === myId ? 'dein' : `${s.fromUserName}s`} Anteil)`
                                        : ` (${s.toUserId === myId ? 'dein' : `${s.toUserName}s`} Anteil)`}
                                    </span>
                                  </span>
                                  <div className="flex gap-1 shrink-0">
                                    <button
                                      onClick={() => handleSettleExpense(exp.id)}
                                      disabled={isSettling || isDeleting}
                                      className="p-1.5 rounded text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                                      title="Ausgabe als beglichen markieren"
                                    >
                                      <Check className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDelete(exp.id)}
                                      disabled={isDeleting || isSettling}
                                      className="p-1.5 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                                      title="Ausgabe löschen"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                              )
                            })
                          )}
                        </div>
                      )}
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
              <div className="h-[180px] sm:h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}€`} />
                    <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Betrag']} contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }} />
                    <Bar dataKey="Betrag" radius={[4, 4, 0, 0]} fill="#6366f1" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── WG-Gesamtübersicht (sekundär) ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Gesamt WG (alle Ausgaben)</CardDescription>
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
            <CardDescription className="text-xs font-medium">Meine Zahlungen (vorgestreckt)</CardDescription>
            <CardTitle className="text-2xl font-bold text-purple-600">
              {loading ? <Skeleton className="h-8 w-24" /> : formatCurrency(myPaidTotal)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-400">{myPaidExpenses.length} Ausgaben bezahlt</p>
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
              <CardDescription>Alle WG-Ausgaben · {filteredExpenses.length} von {expenses.length} angezeigt</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCategoryManager(true)}
              className="shrink-0 text-xs"
            >
              <Settings className="h-3.5 w-3.5 mr-1" />
              Kategorien
            </Button>
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
              {categories.map((cat) => (
                <option key={cat.id} value={cat.slug}>
                  {cat.emoji ? `${cat.emoji} ` : ''}{cat.name}
                </option>
              ))}
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
                const isDeleting = deletingId === expense.id
                const isSettled = !!expense.settledAt
                const splitDetail = getExpenseSplitDetail(expense)
                const cat = getCategoryBySlug(expense.category)
                return (
                  <li key={expense.id} className={cn('flex items-start gap-3 px-6 py-3 group hover:bg-gray-50', isSettled && 'opacity-60')}>
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
                        {isSettled && (
                          <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-1.5 py-0.5">
                            ✓ Beglichen
                          </span>
                        )}
                      </div>
                      {splitDetail && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          Aufgeteilt: {splitDetail}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {cat ? (
                        <Badge
                          className="hidden sm:inline-flex border text-xs"
                          style={getCategoryBadgeStyle(cat.color)}
                        >
                          {cat.emoji && <span className="mr-1">{cat.emoji}</span>}
                          {cat.name}
                        </Badge>
                      ) : (
                        <Badge className="hidden sm:inline-flex bg-gray-100 text-gray-600 border-gray-200" variant="outline">
                          {expense.category}
                        </Badge>
                      )}
                      <span className="font-semibold text-sm text-gray-900 ml-1">
                        {formatCurrency(expense.amount)}
                      </span>
                      <div className="flex gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setEditingExpense(expense)}
                          className="p-1.5 rounded-lg text-orange-400 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                          title="Ausgabe bearbeiten"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(expense.id)}
                          disabled={isDeleting}
                          className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                          title="Ausgabe löschen"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ── Ausgleich-Historie (sekundär, ganz unten) ── */}
      {settlementHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-5 w-5 text-indigo-500" />
              Ausgleich-Historie
            </CardTitle>
            <CardDescription>Vergangene Schuldenausgleiche der WG</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-gray-100">
              {settlementHistory.map((s) => {
                const isMyPayment = s.fromUserId === myId
                const isReceivedByMe = s.toUserId === myId
                return (
                  <li key={s.id} className="flex items-center gap-3 px-6 py-3">
                    <div className="flex items-center gap-1 shrink-0">
                      <Avatar className="h-7 w-7">
                        {s.fromUser.avatarUrl && <AvatarImage src={s.fromUser.avatarUrl} alt={s.fromUser.name} />}
                        <AvatarFallback className="text-[9px] bg-indigo-100 text-indigo-700">{getInitials(s.fromUser.name)}</AvatarFallback>
                      </Avatar>
                      <ArrowRight className="h-3 w-3 text-gray-300 shrink-0" />
                      <Avatar className="h-7 w-7">
                        {s.toUser.avatarUrl && <AvatarImage src={s.toUser.avatarUrl} alt={s.toUser.name} />}
                        <AvatarFallback className="text-[9px] bg-indigo-100 text-indigo-700">{getInitials(s.toUser.name)}</AvatarFallback>
                      </Avatar>
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
          categories={categories}
          currentUserId={myId}
          onSave={handleEdit}
          onClose={() => setEditingExpense(null)}
        />
      )}

      {showCategoryManager && (
        <CategoryManager
          categories={categories}
          onCreated={(cat) => setCategories((prev) => [...prev, cat])}
          onDeleted={(id) => setCategories((prev) => prev.filter((c) => c.id !== id))}
          onClose={() => setShowCategoryManager(false)}
        />
      )}
    </div>
  )
}
