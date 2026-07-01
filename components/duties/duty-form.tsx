'use client'

import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, Save, ChevronUp, ChevronDown, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { getInitials } from '@/lib/utils'

const EMOJIS = ['🍳', '🗑️', '🚭', '🛌', '🧹', '🦺', '🪣', '🦼', '🚿', '🛁', '🪴', '🐾', '📦', '🔧', '🏠', '✨', '🌿', '🛒', '📬', '🎦']
const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#f97316', '#14b8a6', '#ec4899', '#84cc16']
const INTERVALS = [
  { value: 'DAILY', label: 'Täglich' },
  { value: 'WEEKLY', label: 'Wöchentlich' },
  { value: 'BIWEEKLY', label: 'Alle 2 Wochen' },
  { value: 'MONTHLY', label: 'Monatlich' },
  { value: 'MANUAL', label: 'Manuell' },
]

const WEEKDAYS = [
  { value: '1', label: 'Montag' },
  { value: '2', label: 'Dienstag' },
  { value: '3', label: 'Mittwoch' },
  { value: '4', label: 'Donnerstag' },
  { value: '5', label: 'Freitag' },
  { value: '6', label: 'Samstag' },
  { value: '0', label: 'Sonntag' },
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

interface Member {
  id: string
  name: string
}

interface DutyFormProps {
  initialValues?: Partial<DutyFormValues> & { dueWeekday?: number | null }
  initialRotationOrder?: string[]
  members?: Member[]
  onSubmit: (values: Omit<DutyFormValues, 'checklistItems'> & { checklistItems: string[]; rotationOrder: string[]; dueWeekday: number | null }) => Promise<void>
  onCancel?: () => void
  isLoading?: boolean
  submitLabel?: string
}

export function DutyForm({ initialValues, initialRotationOrder, members = [], onSubmit, onCancel, isLoading, submitLabel = 'Speichern' }: DutyFormProps) {
  const [selectedEmoji, setSelectedEmoji] = useState(initialValues?.emoji ?? '')
  const [selectedColor, setSelectedColor] = useState(initialValues?.color ?? '#6366f1')
  const [rotationOrder, setRotationOrder] = useState<string[]>(initialRotationOrder ?? [])
  const [dueWeekday, setDueWeekday] = useState<string>(
    initialValues?.dueWeekday !== null && initialValues?.dueWeekday !== undefined ? String(initialValues.dueWeekday) : ''
  )
  const initialInterval = (initialValues?.rotationInterval as DutyFormValues['rotationInterval']) ?? 'WEEKLY'
  const [rotationInterval, setRotationInterval] = useState<DutyFormValues['rotationInterval']>(initialInterval)

  const { register, handleSubmit, control, formState: { errors }, setValue } = useForm<DutyFormValues>({
    resolver: zodResolver(dutyFormSchema),
    defaultValues: {
      name: initialValues?.name ?? '',
      description: initialValues?.description ?? '',
      emoji: initialValues?.emoji ?? '',
      color: initialValues?.color ?? '#6366f1',
      rotationInterval: initialInterval,
      checklistItems: initialValues?.checklistItems?.map((v) => ({ value: typeof v === 'string' ? v : '' })) ?? [],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'checklistItems' })
  const registerInterval = register('rotationInterval')
  const showWeekdayPicker = rotationInterval === 'WEEKLY' || rotationInterval === 'BIWEEKLY'

  async function onFormSubmit(values: DutyFormValues) {
    await onSubmit({
      ...values,
      emoji: selectedEmoji,
      color: selectedColor,
      checklistItems: values.checklistItems.map((i) => i.value).filter(Boolean),
      rotationOrder,
      dueWeekday: showWeekdayPicker && dueWeekday !== '' ? Number(dueWeekday) : null,
    })
  }

  function pickEmoji(e: string) { setSelectedEmoji(e); setValue('emoji', e) }
  function pickColor(c: string) { setSelectedColor(c); setValue('color', c) }

  function toggleMember(id: string) {
    setRotationOrder((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    )
  }

  function moveUp(index: number) {
    if (index === 0) return
    setRotationOrder((prev) => {
      const next = [...prev]
      ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
      return next
    })
  }

  function moveDown(index: number) {
    setRotationOrder((prev) => {
      if (index === prev.length - 1) return prev
      const next = [...prev]
      ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
      return next
    })
  }

  const memberById = Object.fromEntries(members.map((m) => [m.id, m]))
  const unselectedMembers = members.filter((m) => !rotationOrder.includes(m.id))

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
          {...registerInterval}
          onChange={(e) => { registerInterval.onChange(e); setRotationInterval(e.target.value as DutyFormValues['rotationInterval']) }}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {INTERVALS.map((i) => (
            <option key={i.value} value={i.value}>{i.label}</option>
          ))}
        </select>
      </div>

      {showWeekdayPicker && (
        <div className="space-y-2">
          <Label htmlFor="duty-weekday">Stichtag (Wochentag)</Label>
          <select
            id="duty-weekday"
            value={dueWeekday}
            onChange={(e) => setDueWeekday(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Kein fester Wochentag</option>
            {WEEKDAYS.map((w) => (
              <option key={w.value} value={w.value}>{w.label}</option>
            ))}
          </select>
          <p className="text-xs text-gray-400">
            Der Dienst ist bis zu diesem Wochentag erledigt zu markieren. Danach springt die Rotation automatisch zur nächsten Person.
          </p>
        </div>
      )}

      {members.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-500" />
            <Label>Rotationsreihenfolge</Label>
          </div>

          {rotationOrder.length > 0 && (
            <div className="space-y-1 rounded-lg border border-gray-200 dark:border-gray-700 p-2 bg-gray-50 dark:bg-gray-800/50">
              {rotationOrder.map((id, index) => {
                const member = memberById[id]
                if (!member) return null
                return (
                  <div key={id} className="flex items-center gap-2 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                      {getInitials(member.name)}
                    </span>
                    <span className="flex-1 text-sm font-medium truncate">{member.name}</span>
                    <span className="text-xs text-gray-400">#{index + 1}</span>
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => moveUp(index)}
                        disabled={index === 0}
                        className="p-1 rounded text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="Nach oben"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveDown(index)}
                        disabled={index === rotationOrder.length - 1}
                        className="p-1 rounded text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="Nach unten"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleMember(id)}
                        className="p-1 rounded text-red-400 hover:text-red-600"
                        aria-label="Entfernen"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {unselectedMembers.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-gray-500">Mitglied hinzufügen:</p>
              <div className="flex flex-wrap gap-2">
                {unselectedMembers.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleMember(m.id)}
                    className="flex items-center gap-1.5 rounded-full border border-dashed border-gray-300 dark:border-gray-600 px-3 py-1 text-xs text-gray-600 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {rotationOrder.length === 0 && unselectedMembers.length === 0 && (
            <p className="text-xs text-gray-400 italic">Keine Mitglieder vorhanden.</p>
          )}
        </div>
      )}

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

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading} className="min-h-[44px]">
            Abbrechen
          </Button>
        )}
        <Button type="submit" disabled={isLoading} className="min-h-[44px] sm:w-auto">
          <Save className="mr-2 h-4 w-4" />
          {isLoading ? 'Speichere…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
