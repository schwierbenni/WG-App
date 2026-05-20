'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Mail, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react'

const schema = z.object({ email: z.string().email('Ungültige E-Mail-Adresse') })
type Values = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [serverError, setServerError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  })

  async function onSubmit(values: Values) {
    setServerError(null)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json()
      if (!res.ok) { setServerError(data.error ?? 'Anfrage fehlgeschlagen.'); return }
      setSuccess(true)
    } catch {
      setServerError('Ein unerwarteter Fehler ist aufgetreten.')
    }
  }

  if (success) return (
    <div className="flex flex-col items-center gap-4 text-center py-8">
      <div className="rounded-full bg-[var(--success-bg)] p-4">
        <CheckCircle2 className="h-10 w-10 text-[var(--success)]" />
      </div>
      <h2
        className="text-xl font-extrabold text-foreground"
        style={{ fontFamily: 'var(--font-syne, system-ui)' }}
      >
        E-Mail gesendet!
      </h2>
      <p className="text-sm text-[var(--text-muted)]">
        Falls ein Konto mit{' '}
        <span className="font-semibold text-foreground">{getValues('email')}</span>{' '}
        existiert, erhältst du einen Reset-Link.
      </p>
      <Link
        href="/login"
        className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Zurück zur Anmeldung
      </Link>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--text-muted)] hover:text-brand-600 transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Zurück
        </Link>
        <h1
          className="text-2xl font-extrabold text-foreground mb-1"
          style={{ fontFamily: 'var(--font-syne, system-ui)' }}
        >
          Passwort vergessen?
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          Gib deine E-Mail-Adresse ein und wir senden dir einen Reset-Link.
        </p>
      </div>

      {serverError && (
        <div className="flex items-start gap-2.5 rounded-xl bg-[var(--danger-bg)] border border-[color-mix(in_srgb,var(--danger)_30%,transparent)] p-3.5 text-sm text-[var(--danger)]">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="email">E-Mail-Adresse</Label>
          <Input
            id="email"
            type="email"
            placeholder="name@beispiel.de"
            {...register('email')}
          />
          {errors.email && (
            <p className="text-xs text-[var(--danger)] flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {errors.email.message}
            </p>
          )}
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Sende E-Mail…
            </span>
          ) : (
            <>
              <Mail className="h-4 w-4" />
              Reset-Link anfordern
            </>
          )}
        </Button>
      </form>
    </div>
  )
}
