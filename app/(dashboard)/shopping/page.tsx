'use client'

import * as React from 'react'
import { useSession } from 'next-auth/react'
import { Plus, ShoppingCart, Trash2, CheckCircle2, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { cn, formatDate, getInitials } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface ExpenseCategory {
  id: string
  slug: string
  name: string
  color: string
  emoji: string | null
  sortOrder: number
}

interface SimpleUser {
  id: string
  name: string
  avatarUrl: string | null
}

interface ShoppingItem {
  id: string
  name: string
  category: string
  note: string | null
  boughtAt: string | null
  createdAt: string
  user: SimpleUser
}

const FALLBACK_CATEGORIES: ExpenseCategory[] = [
  { id: 'f1', slug: 'LEBENSMITTEL', name: 'Lebensmittel', color: '#16a34a', emoji: '🛒', sortOrder: 1 },
  { id: 'f2', slug: 'HAUSHALT',     name: 'Haushalt',     color: '#2563eb', emoji: '🏠', sortOrder: 2 },
  { id: 'f3', slug: 'SONSTIGES',    name: 'Sonstiges',    color: '#6b7280', emoji: '📝', sortOrder: 3 },
]

function hexToTailwindStyle(color: string): React.CSSProperties {
  return { backgroundColor: color + '20', color }
}

export default function ShoppingPage() {
  const { data: session } = useSession()
  const [items, setItems] = React.useState<ShoppingItem[]>([])
  const [categories, setCategories] = React.useState<ExpenseCategory[]>(FALLBACK_CATEGORIES)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')

  const [name, setName] = React.useState('')
  const [category, setCategory] = React.useState('')
  const [note, setNote] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [submitError, setSubmitError] = React.useState('')

  const [actionLoading, setActionLoading] = React.useState<string | null>(null)

  const fetchCategories = React.useCallback(async () => {
    try {
      const res = await fetch('/api/expenses/categories')
      if (res.ok) {
        const data = await res.json()
        if (data.categories?.length) {
          setCategories(data.categories)
          setCategory((prev) => prev || data.categories[0].slug)
        }
      }
    } catch {
      // keep fallback categories
    }
  }, [])

  const fetchData = React.useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/shopping')
      if (!res.ok) throw new Error('Fehler beim Laden der Einkaufsliste')
      const data = await res.json()
      setItems(data.items ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchCategories()
    fetchData()
  }, [fetchCategories, fetchData])

  // Set default category once categories load
  React.useEffect(() => {
    if (categories.length > 0 && !category) {
      setCategory(categories[0].slug)
    }
  }, [categories, category])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch('/api/shopping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), category: category || categories[0]?.slug, note: note.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSubmitError(data.error ?? 'Fehler beim Hinzufügen')
      } else {
        setName('')
        setNote('')
        setItems((prev) => [data.item, ...prev])
      }
    } catch {
      setSubmitError('Netzwerkfehler. Bitte erneut versuchen.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleBought = async (item: ShoppingItem) => {
    setActionLoading(item.id + '-buy')
    try {
      const res = await fetch(`/api/shopping/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: item.boughtAt ? 'unbuy' : 'buy' }),
      })
      if (res.ok) {
        const data = await res.json()
        setItems((prev) => prev.map((i) => (i.id === item.id ? data.item : i)))
      }
    } catch {
      // ignore
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (itemId: string) => {
    setActionLoading(itemId + '-delete')
    try {
      const res = await fetch(`/api/shopping/${itemId}`, { method: 'DELETE' })
      if (res.ok || res.status === 204) {
        setItems((prev) => prev.filter((i) => i.id !== itemId))
      }
    } catch {
      // ignore
    } finally {
      setActionLoading(null)
    }
  }

  const getCategoryBySlug = React.useCallback(
    (slug: string) => categories.find((c) => c.slug === slug) ?? null,
    [categories]
  )

  const unboughtByCategory = React.useMemo(() => {
    const unbought = items.filter((i) => !i.boughtAt)
    return categories
      .map((cat) => ({
        category: cat,
        items: unbought.filter((i) => i.category === cat.slug),
      }))
      .filter((g) => g.items.length > 0)
  }, [items, categories])

  const boughtItems = React.useMemo(() => items.filter((i) => i.boughtAt), [items])
  const unboughtCount = items.filter((i) => !i.boughtAt).length

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Einkaufsliste</h1>
          <p className="text-sm text-gray-500 mt-1">
            {unboughtCount} {unboughtCount === 1 ? 'Artikel' : 'Artikel'} noch zu kaufen
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          <span className="hidden sm:inline">Aktualisieren</span>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-5 w-5 text-indigo-500" />
            Artikel hinzufügen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1">
                <Label htmlFor="item-name" className="sr-only">Artikelname</Label>
                <Input
                  id="item-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Artikelname..."
                  disabled={submitting}
                  autoComplete="off"
                />
              </div>
              <div className="sm:w-48">
                <Label htmlFor="item-category" className="sr-only">Kategorie</Label>
                <select
                  id="item-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="h-11 w-full rounded-xl border-2 border-surface-border bg-white px-3 py-2 text-base focus:outline-none focus:border-brand-600"
                  disabled={submitting}
                >
                  {categories.map((cat) => (
                    <option key={cat.slug} value={cat.slug}>
                      {cat.emoji ? `${cat.emoji} ` : ''}{cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="item-note" className="sr-only">Notiz (optional)</Label>
              <Input
                id="item-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Notiz (optional)..."
                disabled={submitting}
                autoComplete="off"
              />
            </div>
            {submitError && (
              <p className="text-sm text-red-600 bg-red-50 rounded-xl p-2">{submitError}</p>
            )}
            <Button type="submit" disabled={submitting || !name.trim()} className="w-full sm:w-auto min-h-[44px]">
              <Plus className="h-4 w-4" />
              {submitting ? 'Hinzufügen...' : 'Hinzufügen'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <Card>
          <CardContent className="pt-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-16 text-center">
          <ShoppingCart className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 font-medium">Einkaufsliste ist leer</p>
          <p className="text-sm text-gray-400 mt-1">Füge den ersten Artikel hinzu!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {unboughtByCategory.map(({ category: cat, items: catItems }) => (
            <Card key={cat.slug}>
              <CardHeader className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <Badge
                    className="text-sm px-3 py-0.5 font-medium border-0"
                    style={hexToTailwindStyle(cat.color)}
                  >
                    {cat.emoji && <span className="mr-1">{cat.emoji}</span>}
                    {cat.name}
                  </Badge>
                  <span className="text-sm text-gray-400">{catItems.length}</span>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <ul className="space-y-1">
                  {catItems.map((item) => (
                    <ShoppingItemRow
                      key={item.id}
                      item={item}
                      category={getCategoryBySlug(item.category)}
                      actionLoading={actionLoading}
                      onToggleBought={handleToggleBought}
                      onDelete={handleDelete}
                      currentUserId={session?.user?.id}
                    />
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}

          {boughtItems.length > 0 && (
            <Card className="opacity-70">
              <CardHeader className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium text-gray-500">
                    Erledigt ({boughtItems.length})
                  </span>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <ul className="space-y-1">
                  {boughtItems.map((item) => (
                    <ShoppingItemRow
                      key={item.id}
                      item={item}
                      category={getCategoryBySlug(item.category)}
                      actionLoading={actionLoading}
                      onToggleBought={handleToggleBought}
                      onDelete={handleDelete}
                      currentUserId={session?.user?.id}
                    />
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

interface ShoppingItemRowProps {
  item: ShoppingItem
  category: ExpenseCategory | null
  actionLoading: string | null
  onToggleBought: (item: ShoppingItem) => void
  onDelete: (id: string) => void
  currentUserId?: string
}

function ShoppingItemRow({
  item,
  category,
  actionLoading,
  onToggleBought,
  onDelete,
  currentUserId,
}: ShoppingItemRowProps) {
  const isBought = !!item.boughtAt
  const isOwner = item.user.id === currentUserId

  return (
    <li className="flex items-center gap-2 py-1.5">
      <button
        onClick={() => onToggleBought(item)}
        disabled={actionLoading === item.id + '-buy'}
        className={cn(
          'shrink-0 h-8 w-8 rounded-lg border-2 transition-colors flex items-center justify-center active:scale-90',
          isBought
            ? 'border-green-500 bg-green-500 text-white'
            : 'border-gray-300 hover:border-indigo-500'
        )}
        title={isBought ? 'Als unverkauft markieren' : 'Als gekauft markieren'}
      >
        {isBought && <CheckCircle2 className="h-3.5 w-3.5" />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              'text-sm text-gray-900',
              isBought && 'line-through text-gray-400'
            )}
          >
            {item.name}
          </span>
          {item.note && (
            <span className="text-xs text-gray-400 truncate max-w-[200px]">
              ({item.note})
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Avatar className="h-4 w-4">
            {item.user.avatarUrl && (
              <AvatarImage src={item.user.avatarUrl} alt={item.user.name} />
            )}
            <AvatarFallback className="text-[8px]">{getInitials(item.user.name)}</AvatarFallback>
          </Avatar>
          <span className="text-xs text-gray-400">{item.user.name}</span>
          {category && !isBought && (
            <>
              <Separator orientation="vertical" className="h-3" />
              <span
                className="text-xs px-1.5 py-0.5 rounded font-medium"
                style={hexToTailwindStyle(category.color)}
              >
                {category.emoji && `${category.emoji} `}{category.name}
              </span>
            </>
          )}
          {isBought && item.boughtAt && (
            <>
              <Separator orientation="vertical" className="h-3" />
              <span className="text-xs text-gray-400">
                Gekauft {formatDate(item.boughtAt)}
              </span>
            </>
          )}
        </div>
      </div>

      {(isOwner || isBought) && (
        <button
          onClick={() => onDelete(item.id)}
          disabled={actionLoading === item.id + '-delete'}
          className="shrink-0 h-9 w-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 active:scale-90 transition-all"
          title="Löschen"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </li>
  )
}
