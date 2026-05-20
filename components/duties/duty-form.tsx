'use client'

import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const EMOJIS = ['🍳', '🗑️', '🚭', '🛌', '🧹', '🦺', '🪣', '🦼', '🚿', '🛁', '🪴', '🐾', '📦', '🔧', '🏠', '✨', '🌿', '🛒', '📬', '🎦']
const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#f97316', '#14b8a6', '#ec4899', '#84cc16']
const INTERVALS = [
  { value: 'DAILY', label: 'Täglich' },
  { value: 'WEEKLY', label: 'Wöchentlich' },
  { value: 'BIWEEKLY', label: 'Alle 2 Wochen' },
  { value: 'MONTHLY', label: 'Monatlich' },
  { value: 'MANUAL', label: 'Manuell' },
]

const dutyFormSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich').max(100),
  description: z.string().max(500).optional(),
  emoji: z.string().optional(),
  color: z.string(),
  rotationInterval: z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'MANUAL']),
  checklistItems: z.array(z.object({ value: z.string() })),
})

type DutyFormValues = z.infer<typeof dutyFormSchema>

interface DutyFormProps {
  initialValues?: Partial<DutyFormValues>
  onSubmit: (values: Omit<DutyFormValues, 'checklistItems'> & { checklistItems: string[] }) => Promise<void>
  isLoading?: boolean
  submitLabel?: string
}

export function DutyForm({ initialValues, onSubmit, isLoading, submitLabel = 'Speichern' }: DutyFormProps) {
  const [selectedEmoji, setSelectedEmoji] = useState(initialValues?.emoji ?? '')
  const [selectedColor, setSelectedColor] = useState(initialValues?.color ?? '#6366f1')

  const { register, handleSubmit, control, formState: { errors }, setValue } = useForm<DutyFormValues>({
    resolver: zodResolver(dutyFormSchema),
    defaultValues: {
      name: initialValues?.name ?? '',
      description: initialValues?.description ?? '',
      emoji: initialValues?.emoji ?? '',
      color: initialValues?.color ?? '#6366f1',
      rotationInterval: (initialValues?.rotationInterval as DutyFormValues['rotationInterval']) ?? 'WEEKLY',
      checklistItems: initialValues?.checklistItems?.map((v) => ({ value: typeof v === 'string' ? v : '' })) ?? [],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'checklistItems' })

  async function onFormSubmit(values: DutyFormValues) {
    await onSubmit({
      ...values,
      emoji: selectedEmoji,
      color: selectedColor,
      checklistItems: values.checklistItems.map((i) => i.value).filter(Boolean),
    })
  }

  function pickEmoji(e: string) { setSelectedEmoji(e); setValue('emoji', e) }
  function pickColor(c: string) { setSelectedColor(c); setValue('color', c) }

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="duty-name">Name *</Label>
        <Input id="duty-name" placeholder="z. B. Küchendienst" {...register('name')} />
        {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="duty-desc">Beschreibung</Label>
        <Textarea id="duty-desc" placeholder="Was gehört dazu?" rows={2} {...register('description')} />
      </div>

      <div className="space-y-2">
        <Label>Emoji</Label>
        <div className="flex flex-wrap gap-2">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => pickEmoji(e)}
              className={`text-xl p-1.5 rounded-lg border-2 transition-all ${
                selectedEmoji === e
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 scale-110'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
              }`}
            >
              {e}
            </button>
          ))}
          <Input
            placeholder="Eigenes Emoji"
            value={selectedEmoji && !EMOJIS.includes(selectedEmoji) ? selectedEmoji : ''}
            onChange={(ev) => pickEmoji(ev.target.value)}
            className="w-32 text-center"
            maxLength={4}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Farbe</Label>
        <div className="flex flex-wrap gap-2 items-center">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => pickColor(c)}
              style={{ backgroundColor: c }}
              className={`h-8 w-8 rounded-full transition-all ${
                selectedColor === c ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110' : 'opacity-80 hover:opacity-100'
              }`}
              aria-label={`Farbe ${c} auswählen`}
            />
          ))}
          <Input type="color" value={selectedColor} onChange={(ev) => pickColor(ev.target.value)} className="h-8 w-12 p-0.5 rounded cursor-pointer border" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="duty-interval">Rotationsintervall</Label>
        <select
          id="duty-interval"
          {...register('rotationInterval')}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {INTERVALS.map((i) => (
            <option key={i.value} value={i.value}>{i.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label>Checkliste (optional)</Label>
        <div className="space-y-2">
          {fields.map((field, index) => (
            <div key={field.id} className="flex gap-2">
              <Input placeholder={`Aufgabe ${index + 1}`} {...register(`checklistItems.${index}.value`)} className="flex-1" />
              <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0" aria-label="Aufgabe entfernen">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => append({ value: '' })} className="gap-1">
          <Plus className="h-3.5 w-3.5" />Aufgabe hinzufügen
        </Button>
      </div>

      <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
        <Save className="mr-2 h-4 w-4" />
        {isLoading ? 'Speichere…' : submitLabel}
      </Button>
    </form>
  )
}
