'use client'

import * as React from 'react'
import { useSession } from 'next-auth/react'
import { Plus, ShoppingCart, Trash2, CheckCircle2, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { categorizeShoppingItem, shoppingCategories } from '@/lib/shopping-categories'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { cn, formatDate, getInitials } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

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

export default function ShoppingPage() {
  const { data: session } = useSession()
  const [items, setItems] = React.useState<ShoppingItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')

  const [name, setName] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [submitError, setSubmitError] = React.useState('')
  const nameInput = React.useRef<HTMLInputElement>(null)
  const submitPending = React.useRef(false)
  const focusAfterSubmit = React.useRef(false)

  React.useEffect(() => {
    if (!submitting && focusAfterSubmit.current) {
      focusAfterSubmit.current = false
      nameInput.current?.focus()
    }
  }, [submitting])

  const handleEntryKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
    event.preventDefault()
    if (!event.repeat && !submitPending.current) event.currentTarget.form?.requestSubmit()
  }

  const [actionLoading, setActionLoading] = React.useState<string | null>(null)

  const fetchData = React.useCallback((signal?: AbortSignal) => {
    return fetch('/api/shopping', { signal })
      .then((response) => {
        if (!response.ok) throw new Error('Fehler beim Laden der Einkaufsliste')
        return response.json()
      })
      .then((data) => {
        if (signal?.aborted) return
        setItems(data.items ?? [])
        setError('')
      })
      .catch((err) => {
        if (!signal?.aborted) setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
      })
      .finally(() => {
        if (!signal?.aborted) setLoading(false)
      })
  }, [])

  React.useEffect(() => {
    const controller = new AbortController()
    void fetchData(controller.signal)
    return () => controller.abort()
  }, [fetchData])

  const refresh = () => {
    setLoading(true)
    setError('')
    void fetchData()
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || loading || submitPending.current) return
    submitPending.current = true
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch('/api/shopping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSubmitError(data.error ?? 'Fehler beim Hinzufügen')
      } else {
        focusAfterSubmit.current = true
        setName('')
        setItems((prev) => [data.item, ...prev])
      }
    } catch {
      setSubmitError('Netzwerkfehler. Bitte erneut versuchen.')
    } finally {
      submitPending.current = false
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

  const unboughtByCategory = React.useMemo(() => {
    const groups = new Map(shoppingCategories.map((category) => [category.id, [] as ShoppingItem[]]))
    for (const item of items) {
      if (!item.boughtAt) groups.get(categorizeShoppingItem(item.name, item.category))?.push(item)
    }
    return shoppingCategories.flatMap((category) => {
      const categoryItems = groups.get(category.id) ?? []
      return categoryItems.length ? [{ category, items: categoryItems }] : []
    })
  }, [items])

  const boughtItems = React.useMemo(() => items.filter((i) => i.boughtAt), [items])
  const unboughtCount = items.filter((i) => !i.boughtAt).length

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Einkaufsliste</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {unboughtCount} Artikel noch zu kaufen
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading || submitting} aria-label="Aktualisieren">
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
          <form onSubmit={handleAdd} className="space-y-2">
            <div className="flex gap-2">
              <Label htmlFor="item-name" className="sr-only">Artikelname</Label>
              <Input
                id="item-name"
                ref={nameInput}
                enterKeyHint="enter"
                onKeyDown={handleEntryKeyDown}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Artikelname"
                disabled={submitting}
                autoComplete="off"
                className="min-w-0 placeholder:text-[var(--text-muted)]"
              />
              <Button type="submit" disabled={loading || submitting || !name.trim()} className="h-11 w-11 shrink-0 px-0" aria-label="Artikel hinzufügen">
                <Plus className="h-5 w-5" />
              </Button>
            </div>
            {submitError && (
              <p role="alert" className="rounded-xl bg-[var(--danger-bg)] p-2 text-sm text-[var(--danger)]">{submitError}</p>
            )}
          </form>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-lg border border-surface-border bg-[var(--danger-bg)] p-4 text-sm text-[var(--danger)]">
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
        <div className="rounded-xl border-2 border-dashed border-surface-border py-16 text-center">
          <ShoppingCart className="h-8 w-8 text-[var(--text-muted)] mx-auto mb-2" />
          <p className="text-[var(--text-muted)] font-medium">Einkaufsliste ist leer</p>
          <p className="text-sm text-[var(--text-muted)] mt-1">Füge den ersten Artikel hinzu!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {unboughtByCategory.map(({ category: cat, items: catItems }) => (
            <Card key={cat.id}>
              <CardHeader className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <h2 className="rounded-full bg-brand-muted px-3 py-0.5 text-sm font-semibold text-brand-600">{cat.label}</h2>
                  <span className="text-sm text-[var(--text-muted)]">{catItems.length}</span>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <ul className="space-y-1">
                  {catItems.map((item) => (
                    <ShoppingItemRow
                      key={item.id}
                      item={item}
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
            <Card>
              <CardHeader className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[var(--success)]" />
                  <span className="text-sm font-medium text-[var(--text-muted)]">
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
  actionLoading: string | null
  onToggleBought: (item: ShoppingItem) => void
  onDelete: (id: string) => void
  currentUserId?: string
}

function ShoppingItemRow({
  item,
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
            ? 'border-brand-600 bg-brand-600 text-[var(--brand-text)]'
            : 'border-[var(--text-muted)] hover:border-brand-600'
        )}
        title={isBought ? 'Als unverkauft markieren' : 'Als gekauft markieren'}
      >
        {isBought && <CheckCircle2 className="h-3.5 w-3.5" />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              'text-sm break-words [overflow-wrap:anywhere]',
              isBought ? 'line-through text-[var(--text-muted)]' : 'font-medium text-foreground'
            )}
          >
            {item.name}
          </span>
          {item.note && (
            <span className="text-xs text-[var(--text-muted)] truncate max-w-[200px]">
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
          <span className="text-xs text-[var(--text-muted)]">{item.user.name}</span>
          {isBought && item.boughtAt && (
            <>
              <Separator orientation="vertical" className="h-3" />
              <span className="text-xs text-[var(--text-muted)]">
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
          className="shrink-0 h-9 w-9 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)] active:scale-90 transition-all"
          title="Löschen"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </li>
  )
}
