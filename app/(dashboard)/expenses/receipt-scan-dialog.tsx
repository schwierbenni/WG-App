'use client'

import * as React from 'react'
import { Camera, Upload, ScanLine, Check, AlertCircle, Image as ImageIcon, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { cn, formatCurrency } from '@/lib/utils'
import type { ParsedReceiptItem, ParsedReceipt } from '@/lib/receipt-parser'

type Stage = 'upload' | 'processing' | 'review' | 'confirming'

interface SimpleUser {
  id: string
  name: string
}

interface WGExpenseCategory {
  id: string
  name: string
  slug: string
  emoji: string | null
}

interface ReceiptScanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  members: SimpleUser[]
  currentUserId: string
  categories: WGExpenseCategory[]
  onExpenseCreated: () => void
}

export function ReceiptScanDialog({
  open,
  onOpenChange,
  members,
  currentUserId,
  categories,
  onExpenseCreated,
}: ReceiptScanDialogProps) {
  const [stage, setStage] = React.useState<Stage>('upload')
  const [imageFile, setImageFile] = React.useState<File | null>(null)
  const [imagePreview, setImagePreview] = React.useState<string | null>(null)
  const [ocrProgress, setOcrProgress] = React.useState(0)
  const [ocrStatus, setOcrStatus] = React.useState('')
  const [receipt, setReceipt] = React.useState<ParsedReceipt | null>(null)
  const [items, setItems] = React.useState<ParsedReceiptItem[]>([])
  const [description, setDescription] = React.useState('')
  const [category, setCategory] = React.useState('')
  const [paidBy, setPaidBy] = React.useState(currentUserId)
  const [splitWith, setSplitWith] = React.useState<string[]>(members.map((m) => m.id))
  const [error, setError] = React.useState<string | null>(null)

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const cameraInputRef = React.useRef<HTMLInputElement>(null)

  const defaultCategory = categories.find((c) => c.slug === 'LEBENSMITTEL') ?? categories[0]

  React.useEffect(() => {
    if (open) {
      setStage('upload')
      setImageFile(null)
      setImagePreview(null)
      setOcrProgress(0)
      setOcrStatus('')
      setReceipt(null)
      setItems([])
      setDescription('')
      setCategory(defaultCategory?.slug ?? 'LEBENSMITTEL')
      setPaidBy(currentUserId)
      setSplitWith(members.map((m) => m.id))
      setError(null)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleFileSelected(file: File) {
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setError(null)
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFileSelected(file)
  }

  async function runOcr() {
    if (!imageFile) return
    setStage('processing')
    setOcrProgress(0)
    setError(null)

    try {
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('deu', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.round(m.progress * 90))
          } else if (m.status === 'loading language traineddata') {
            setOcrStatus('Sprachmodell laden…')
            setOcrProgress(10)
          } else if (m.status === 'initializing api') {
            setOcrStatus('OCR initialisieren…')
            setOcrProgress(20)
          } else {
            setOcrStatus(m.status)
          }
        },
      })

      setOcrStatus('Beleg wird analysiert…')
      const result = await worker.recognize(imageFile)
      await worker.terminate()

      setOcrProgress(95)
      setOcrStatus('Posten werden extrahiert…')

      const { parseReceiptText } = await import('@/lib/receipt-parser')
      const parsed = parseReceiptText(result.data.text)

      setReceipt(parsed)
      setItems(parsed.items)

      if (parsed.shopName) {
        setDescription(`Einkauf ${parsed.shopName}`)
      } else {
        setDescription('Einkauf')
      }

      setOcrProgress(100)
      setStage('review')
    } catch (err) {
      console.error('OCR error:', err)
      setError('OCR-Analyse fehlgeschlagen. Bitte versuche es erneut.')
      setStage('upload')
    }
  }

  function toggleItem(id: string) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    )
  }

  function updateItemName(id: string, name: string) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, name } : item)))
  }

  function updateItemPrice(id: string, value: string) {
    const price = parseFloat(value.replace(',', '.'))
    if (!isNaN(price) && price >= 0) {
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, totalPrice: price, unitPrice: price / item.quantity } : item
        )
      )
    }
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  const selectedItems = items.filter((i) => i.selected)
  const subtotal = selectedItems.reduce((sum, i) => sum + i.totalPrice, 0)

  function toggleSplitMember(userId: string) {
    setSplitWith((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  async function handleConfirm() {
    if (selectedItems.length === 0) {
      setError('Bitte wähle mindestens einen Posten aus.')
      return
    }
    if (splitWith.length === 0) {
      setError('Bitte wähle mindestens eine Person für die Aufteilung.')
      return
    }
    if (!description.trim()) {
      setError('Bitte gib eine Beschreibung ein.')
      return
    }

    setStage('confirming')
    setError(null)

    try {
      let receiptImageUrl: string | undefined

      if (imageFile) {
        const formData = new FormData()
        formData.append('file', imageFile)
        const uploadRes = await fetch('/api/upload/receipt', { method: 'POST', body: formData })
        if (uploadRes.ok) {
          const data = await uploadRes.json()
          receiptImageUrl = data.url
        }
      }

      const splitWithFinal = splitWith.includes(paidBy) ? splitWith : [paidBy, ...splitWith]

      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Math.round(subtotal * 100) / 100,
          description: description.trim(),
          category,
          paidBy,
          splitWith: splitWithFinal,
          splitMode: 'EQUAL',
          receiptImageUrl,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Fehler beim Speichern')
      }

      onExpenseCreated()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
      setStage('review')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-indigo-600" />
            Beleg scannen
          </DialogTitle>
          <DialogDescription>
            {stage === 'upload' && 'Foto oder PDF des Kassenbons hochladen'}
            {stage === 'processing' && 'Kassenbon wird analysiert…'}
            {stage === 'review' && 'Posten auswählen und bestätigen'}
            {stage === 'confirming' && 'Ausgabe wird gespeichert…'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          {/* ── Upload Stage ── */}
          {stage === 'upload' && (
            <div className="space-y-4 py-2">
              {imagePreview ? (
                <div className="relative rounded-lg overflow-hidden border border-gray-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreview}
                    alt="Beleg-Vorschau"
                    className="w-full max-h-56 object-contain bg-gray-50"
                  />
                  <button
                    onClick={() => { setImageFile(null); setImagePreview(null) }}
                    className="absolute top-2 right-2 rounded-full bg-white/90 p-1 shadow hover:bg-white"
                    type="button"
                    aria-label="Bild entfernen"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </button>
                </div>
              ) : (
                <div
                  className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImageIcon className="h-10 w-10 text-gray-400" />
                  <p className="text-sm text-gray-500 text-center">
                    Bild hochladen oder Foto aufnehmen
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleFileInputChange}
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={handleFileInputChange}
                />
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Bild wählen
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => cameraInputRef.current?.click()}
                  type="button"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Kamera
                </Button>
              </div>

              {error && (
                <p className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </p>
              )}

              <Button
                className="w-full"
                disabled={!imageFile}
                onClick={runOcr}
                type="button"
              >
                <ScanLine className="h-4 w-4 mr-2" />
                Beleg analysieren
              </Button>
            </div>
          )}

          {/* ── Processing Stage ── */}
          {stage === 'processing' && (
            <div className="flex flex-col items-center justify-center gap-6 py-10">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50">
                <ScanLine className="h-8 w-8 text-indigo-600 animate-pulse" />
              </div>
              <div className="w-full space-y-2">
                <Progress value={ocrProgress} className="h-2" />
                <p className="text-center text-sm text-gray-500">{ocrStatus || 'Bitte warten…'}</p>
              </div>
              <p className="text-xs text-gray-400 text-center max-w-xs">
                Beim ersten Scan wird das Sprachmodell heruntergeladen (~3 MB). Das dauert einen Moment.
              </p>
            </div>
          )}

          {/* ── Review Stage ── */}
          {stage === 'review' && receipt && (
            <div className="space-y-4 py-2">
              {/* Beleg-Kopf */}
              <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm space-y-1">
                {receipt.shopName && (
                  <p className="font-semibold text-gray-900">{receipt.shopName}</p>
                )}
                {receipt.date && (
                  <p className="text-gray-500 text-xs">Datum: {receipt.date}</p>
                )}
                {receipt.total != null && (
                  <p className="text-gray-500 text-xs">
                    Gesamtbetrag (Beleg): {formatCurrency(receipt.total)}
                  </p>
                )}
              </div>

              {items.length === 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  <AlertCircle className="h-4 w-4 inline mr-2" />
                  Keine Posten erkannt. Du kannst die Ausgabe trotzdem manuell erstellen.
                </div>
              ) : (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-gray-700">
                        Erkannte Posten ({items.length})
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="text-xs text-indigo-600 hover:underline"
                          onClick={() => setItems((prev) => prev.map((i) => ({ ...i, selected: true })))}
                        >
                          Alle
                        </button>
                        <span className="text-xs text-gray-400">/</span>
                        <button
                          type="button"
                          className="text-xs text-indigo-600 hover:underline"
                          onClick={() => setItems((prev) => prev.map((i) => ({ ...i, selected: false })))}
                        >
                          Keine
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className={cn(
                            'flex items-center gap-2 rounded-lg border px-2 py-1.5 text-sm transition-colors',
                            item.selected
                              ? 'border-indigo-200 bg-indigo-50'
                              : 'border-gray-100 bg-white opacity-60'
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={() => toggleItem(item.id)}
                            className="h-4 w-4 rounded accent-indigo-600 shrink-0"
                          />
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => updateItemName(item.id, e.target.value)}
                            className="flex-1 min-w-0 bg-transparent outline-none text-gray-900 placeholder-gray-400 truncate"
                          />
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-gray-400 text-xs">€</span>
                            <input
                              type="text"
                              defaultValue={item.totalPrice.toFixed(2).replace('.', ',')}
                              onBlur={(e) => updateItemPrice(item.id, e.target.value)}
                              className="w-14 bg-transparent outline-none text-right text-gray-900 text-xs"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="text-gray-300 hover:text-red-400 transition-colors shrink-0"
                            aria-label="Posten entfernen"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-2 flex items-center justify-between">
                    <p className="text-sm font-medium text-indigo-800">
                      {selectedItems.length} von {items.length} ausgewählt
                    </p>
                    <p className="text-base font-bold text-indigo-900">{formatCurrency(subtotal)}</p>
                  </div>
                </>
              )}

              {/* Ausgaben-Details */}
              <div className="space-y-3 border-t border-gray-100 pt-3">
                <div>
                  <Label htmlFor="receipt-description" className="text-xs text-gray-600 mb-1 block">
                    Beschreibung
                  </Label>
                  <Input
                    id="receipt-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="z. B. Einkauf REWE"
                  />
                </div>

                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Kategorie</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map((cat) => (
                      <button
                        key={cat.slug}
                        type="button"
                        onClick={() => setCategory(cat.slug)}
                        className={cn(
                          'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
                          category === cat.slug
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                        )}
                      >
                        {cat.emoji} {cat.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Bezahlt von</Label>
                  <select
                    value={paidBy}
                    onChange={(e) => setPaidBy(e.target.value)}
                    className="w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Aufteilen mit</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {members.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleSplitMember(m.id)}
                        className={cn(
                          'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
                          splitWith.includes(m.id)
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                        )}
                      >
                        {splitWith.includes(m.id) && <Check className="h-3 w-3 inline mr-1" />}
                        {m.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {error && (
                <p className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </p>
              )}
            </div>
          )}

          {/* ── Confirming Stage ── */}
          {stage === 'confirming' && (
            <div className="flex flex-col items-center justify-center gap-4 py-10">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
                <Check className="h-7 w-7 text-green-600 animate-pulse" />
              </div>
              <p className="text-sm text-gray-600">Ausgabe wird gespeichert…</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {stage === 'review' && (
          <div className="shrink-0 border-t border-gray-100 pt-3 mt-2">
            <Button
              className="w-full"
              onClick={handleConfirm}
              disabled={selectedItems.length === 0 && items.length > 0}
            >
              <Check className="h-4 w-4 mr-2" />
              {formatCurrency(subtotal)} übernehmen
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
