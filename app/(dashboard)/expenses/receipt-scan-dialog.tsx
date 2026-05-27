'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Camera, Upload, ScanLine, Check, AlertCircle, Image as ImageIcon, Trash2, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn, formatCurrency } from '@/lib/utils'

type Stage = 'upload' | 'processing' | 'review' | 'confirming'

interface ReceiptItem {
  id: string
  name: string
  quantity: number
  unitPrice: number
  totalPrice: number
  selected: boolean
}

interface ParsedReceipt {
  shopName: string | null
  date: string | null
  items: ReceiptItem[]
  total: number | null
}

interface SimpleUser { id: string; name: string }
interface WGExpenseCategory { id: string; name: string; slug: string; emoji: string | null }

interface ReceiptScanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  members: SimpleUser[]
  currentUserId: string
  categories: WGExpenseCategory[]
  onExpenseCreated: () => void
}

function mkItem(overrides?: Partial<ReceiptItem>): ReceiptItem {
  return { id: Math.random().toString(36).slice(2, 9), name: '', quantity: 1, unitPrice: 0, totalPrice: 0, selected: true, ...overrides }
}

export function ReceiptScanDialog({ open, onOpenChange, members, currentUserId, categories, onExpenseCreated }: ReceiptScanDialogProps) {
  const [stage, setStage] = React.useState<Stage>('upload')
  const [imageFile, setImageFile] = React.useState<File | null>(null)
  const [imagePreview, setImagePreview] = React.useState<string | null>(null)
  const [receipt, setReceipt] = React.useState<ParsedReceipt | null>(null)
  const [items, setItems] = React.useState<ReceiptItem[]>([])
  const [description, setDescription] = React.useState('')
  const [category, setCategory] = React.useState(categories.find(c => c.slug === 'LEBENSMITTEL')?.slug ?? categories[0]?.slug ?? '')
  const [paidBy, setPaidBy] = React.useState(currentUserId)
  const [splitWith, setSplitWith] = React.useState<string[]>(members.map(m => m.id))
  const [error, setError] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const cameraInputRef = React.useRef<HTMLInputElement>(null)
  const newItemRefs = React.useRef<Record<string, HTMLInputElement | null>>({})

  React.useEffect(() => {
    if (open) {
      setStage('upload'); setImageFile(null); setImagePreview(null)
      setReceipt(null); setItems([]); setDescription(''); setError(null)
      setCategory(categories.find(c => c.slug === 'LEBENSMITTEL')?.slug ?? categories[0]?.slug ?? '')
      setPaidBy(currentUserId); setSplitWith(members.map(m => m.id))
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleFile(file: File) { setImageFile(file); setImagePreview(URL.createObjectURL(file)); setError(null) }

  async function runOcr() {
    if (!imageFile) return
    setStage('processing'); setError(null)
    try {
      const fd = new FormData(); fd.append('image', imageFile)
      const res = await fetch('/api/receipts/scan', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'OCR fehlgeschlagen')

      const parsed: ParsedReceipt = {
        shopName: data.shopName ?? null,
        date: data.date ?? null,
        total: typeof data.total === 'number' ? data.total : null,
        items: Array.isArray(data.items) ? data.items.map((it: { name?: string; quantity?: number; unitPrice?: number; totalPrice?: number }) => mkItem({
          name: String(it.name ?? ''),
          quantity: Number(it.quantity ?? 1),
          unitPrice: Number(it.unitPrice ?? it.totalPrice ?? 0),
          totalPrice: Number(it.totalPrice ?? it.unitPrice ?? 0),
        })) : [],
      }
      setReceipt(parsed); setItems(parsed.items)
      setDescription(parsed.shopName ? `Einkauf ${parsed.shopName}` : 'Einkauf')
      setStage('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler'); setStage('upload')
    }
  }

  function toggleItem(id: string) { setItems(p => p.map(i => i.id === id ? { ...i, selected: !i.selected } : i)) }
  function updateName(id: string, name: string) { setItems(p => p.map(i => i.id === id ? { ...i, name } : i)) }
  function updatePrice(id: string, val: string) {
    const price = parseFloat(val.replace(',', '.'))
    if (!isNaN(price) && price >= 0) setItems(p => p.map(i => i.id === id ? { ...i, totalPrice: price, unitPrice: price / i.quantity } : i))
  }
  function removeItem(id: string) { setItems(p => p.filter(i => i.id !== id)) }
  function addItem() {
    const item = mkItem()
    setItems(p => [...p, item])
    requestAnimationFrame(() => newItemRefs.current[item.id]?.focus())
  }

  const selectedItems = items.filter(i => i.selected)
  const subtotal = selectedItems.reduce((s, i) => s + i.totalPrice, 0)

  async function handleConfirm() {
    if (!description.trim()) { setError('Bitte gib eine Bezeichnung ein.'); return }
    if (selectedItems.length === 0) { setError('Bitte wähle mindestens einen Posten aus.'); return }
    if (splitWith.length === 0) { setError('Bitte wähle mindestens eine Person.'); return }
    setStage('confirming'); setError(null)
    try {
      let receiptImageUrl: string | undefined
      if (imageFile) {
        const fd = new FormData(); fd.append('file', imageFile)
        const uploadRes = await fetch('/api/upload/receipt', { method: 'POST', body: fd })
        if (uploadRes.ok) {
          receiptImageUrl = (await uploadRes.json()).url
        } else {
          const uploadErr = await uploadRes.json()
          throw new Error('Belegbild konnte nicht gespeichert werden: ' + (uploadErr.error ?? 'Fehler'))
        }
      }
      const splitWithFinal = splitWith.includes(paidBy) ? splitWith : [paidBy, ...splitWith]
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Math.round(subtotal * 100) / 100, description: description.trim(), category, paidBy, splitWith: splitWithFinal, splitMode: 'EQUAL', receiptImageUrl }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Fehler beim Speichern')
      onExpenseCreated(); onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler'); setStage('review')
    }
  }

  const stageLabel = { upload: 'Beleg hochladen', processing: 'Wird analysiert…', review: 'Posten auswählen', confirming: 'Wird gespeichert…' }[stage]

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Overlay */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        {/* Bottom-sheet on mobile, centered modal on sm+ */}
        <DialogPrimitive.Content className={cn(
          'fixed z-50 flex flex-col bg-white focus:outline-none',
          // Mobile: bottom sheet
          'inset-x-0 bottom-0 rounded-t-2xl max-h-[92dvh]',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
          // Desktop: centered modal
          'sm:inset-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2',
          'sm:w-full sm:max-w-md sm:rounded-2xl sm:max-h-[90dvh]',
          'sm:data-[state=closed]:slide-out-to-top-[48%] sm:data-[state=open]:slide-in-from-top-[48%]',
          'sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95',
        )}>

          {/* Drag handle – mobile only */}
          <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-gray-300" />
          </div>

          {/* Sticky header */}
          <div className="shrink-0 flex items-start justify-between px-5 pt-3 pb-3 sm:pt-5 border-b border-gray-100">
            <div>
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <ScanLine className="h-4 w-4 text-indigo-600" /> Beleg scannen
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">{stageLabel}</p>
            </div>
            <DialogPrimitive.Close className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors mt-0.5">
              <X className="h-4 w-4" />
              <span className="sr-only">Schließen</span>
            </DialogPrimitive.Close>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 min-h-0">

            {/* ── Upload ── */}
            {stage === 'upload' && (
              <div className="space-y-4">
                {imagePreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-gray-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imagePreview} alt="Beleg-Vorschau" className="w-full max-h-64 object-contain bg-gray-50" />
                    <button onClick={() => { setImageFile(null); setImagePreview(null) }}
                      className="absolute top-2 right-2 rounded-full bg-white/90 p-1.5 shadow hover:bg-white transition-colors" type="button">
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-10 hover:bg-gray-100 transition-colors">
                    <ImageIcon className="h-10 w-10 text-gray-400" />
                    <span className="text-sm text-gray-500">Bild hochladen oder Foto aufnehmen</span>
                  </button>
                )}

                <input ref={fileInputRef} type="file" accept="image/*" className="sr-only"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="sr-only"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => fileInputRef.current?.click()} type="button">
                    <Upload className="h-4 w-4 mr-2" /> Datei
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => cameraInputRef.current?.click()} type="button">
                    <Camera className="h-4 w-4 mr-2" /> Kamera
                  </Button>
                </div>

                {error && <ErrorBanner>{error}</ErrorBanner>}

                <Button className="w-full" disabled={!imageFile} onClick={runOcr} type="button">
                  <ScanLine className="h-4 w-4 mr-2" /> Beleg analysieren
                </Button>
              </div>
            )}

            {/* ── Processing ── */}
            {stage === 'processing' && (
              <div className="flex flex-col items-center justify-center gap-6 py-12">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50">
                  <ScanLine className="h-8 w-8 text-indigo-600 animate-pulse" />
                </div>
                <div className="w-full space-y-2">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full w-1/2 bg-indigo-500 rounded-full animate-[slide_1.4s_ease-in-out_infinite]" />
                  </div>
                  <p className="text-center text-sm text-gray-500">KI analysiert den Beleg…</p>
                </div>
              </div>
            )}

            {/* ── Review ── */}
            {stage === 'review' && receipt && (
              <div className="space-y-5">
                {/* Bezeichnung + Beleg-Metadaten */}
                <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 space-y-2">
                  <div>
                    <label htmlFor="receipt-description" className="text-[10px] uppercase tracking-wide text-gray-400 block mb-1">
                      Bezeichnung
                    </label>
                    <input
                      id="receipt-description"
                      type="text"
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="z. B. Einkauf REWE"
                      // eslint-disable-next-line jsx-a11y/no-autofocus
                      autoFocus
                      className="w-full bg-transparent text-base font-semibold text-gray-900 outline-none placeholder-gray-400 border-b border-transparent focus:border-indigo-400 pb-0.5 transition-colors"
                    />
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                    {receipt.shopName && <span>{receipt.shopName}</span>}
                    {receipt.date && <span>📅 {receipt.date}</span>}
                    {receipt.total != null && <span>Beleg-Summe: {formatCurrency(receipt.total)}</span>}
                  </div>
                </div>

                {/* Posten */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-700">Posten ({items.length})</p>
                    <div className="flex gap-2 text-xs text-indigo-600">
                      <button type="button" className="hover:underline" onClick={() => setItems(p => p.map(i => ({ ...i, selected: true })))}>Alle</button>
                      <span className="text-gray-300">/</span>
                      <button type="button" className="hover:underline" onClick={() => setItems(p => p.map(i => ({ ...i, selected: false })))}>Keine</button>
                    </div>
                  </div>

                  {items.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-4">Keine Posten erkannt – füge sie manuell hinzu.</p>
                  )}

                  <div className="space-y-1.5">
                    {items.map(item => (
                      <div key={item.id} className={cn(
                        'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors',
                        item.selected ? 'border-indigo-200 bg-indigo-50' : 'border-gray-100 bg-white opacity-60'
                      )}>
                        <input type="checkbox" checked={item.selected} onChange={() => toggleItem(item.id)}
                          className="h-4 w-4 rounded accent-indigo-600 shrink-0" />
                        <input
                          ref={el => { newItemRefs.current[item.id] = el }}
                          type="text" value={item.name} onChange={e => updateName(item.id, e.target.value)}
                          placeholder="Artikelname"
                          className="flex-1 min-w-0 bg-transparent outline-none text-gray-900 placeholder-gray-400"
                        />
                        <div className="flex items-center gap-0.5 shrink-0">
                          <span className="text-gray-400 text-xs">€</span>
                          <input
                            type="text"
                            defaultValue={item.totalPrice > 0 ? item.totalPrice.toFixed(2).replace('.', ',') : ''}
                            onBlur={e => updatePrice(item.id, e.target.value)}
                            placeholder="0,00"
                            className="w-14 bg-transparent outline-none text-right text-gray-900 text-xs placeholder-gray-300"
                          />
                        </div>
                        <button type="button" onClick={() => removeItem(item.id)} className="text-gray-300 hover:text-red-400 transition-colors shrink-0">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button type="button" onClick={addItem}
                    className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 py-2 text-xs text-gray-500 hover:bg-gray-50 hover:border-gray-400 transition-colors">
                    <Plus className="h-3.5 w-3.5" /> Posten hinzufügen
                  </button>
                </div>

                {/* Zwischensumme */}
                <div className="rounded-xl bg-indigo-50 border border-indigo-200 px-4 py-2.5 flex items-center justify-between">
                  <p className="text-sm font-medium text-indigo-800">{selectedItems.length} von {items.length} ausgewählt</p>
                  <p className="text-base font-bold text-indigo-900">{formatCurrency(subtotal)}</p>
                </div>

                {/* Kategorie */}
                <div>
                  <Label className="text-xs text-gray-600 mb-1.5 block">Kategorie</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map(cat => (
                      <button key={cat.slug} type="button" onClick={() => setCategory(cat.slug)}
                        className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                          category === cat.slug ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300')}>
                        {cat.emoji} {cat.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bezahlt von */}
                <div>
                  <Label className="text-xs text-gray-600 mb-1.5 block">Bezahlt von</Label>
                  <select value={paidBy} onChange={e => setPaidBy(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>

                {/* Aufteilen mit */}
                <div>
                  <Label className="text-xs text-gray-600 mb-1.5 block">Aufteilen mit</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {members.map(m => (
                      <button key={m.id} type="button"
                        onClick={() => setSplitWith(p => p.includes(m.id) ? p.filter(id => id !== m.id) : [...p, m.id])}
                        className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                          splitWith.includes(m.id) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300')}>
                        {splitWith.includes(m.id) && <Check className="h-3 w-3 inline mr-1" />}{m.name}
                      </button>
                    ))}
                  </div>
                </div>

                {error && <ErrorBanner>{error}</ErrorBanner>}
              </div>
            )}

            {/* ── Confirming ── */}
            {stage === 'confirming' && (
              <div className="flex flex-col items-center justify-center gap-4 py-12">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
                  <Check className="h-7 w-7 text-green-600 animate-pulse" />
                </div>
                <p className="text-sm text-gray-600">Ausgabe wird gespeichert…</p>
              </div>
            )}
          </div>

          {/* Sticky footer – only in review */}
          {stage === 'review' && (
            <div className="shrink-0 px-5 pt-3 pb-5 border-t border-gray-100 bg-white">
              <Button className="w-full min-h-[48px]" onClick={handleConfirm}
                disabled={selectedItems.length === 0 && items.length > 0}>
                <Check className="h-4 w-4 mr-2" />
                {formatCurrency(subtotal)} übernehmen
              </Button>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />{children}
    </p>
  )
}
