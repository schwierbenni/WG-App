'use client'

import { Suspense, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff, UserPlus, AlertCircle, CheckCircle2 } from 'lucide-react'

const registerSchema = z.object({
  name: z.string().min(2, 'Name muss mindestens 2 Zeichen haben').max(100),
  email: z.string().email('Ungültige E-Mail-Adresse'),
  password: z.string().min(8, 'Passwort muss mindestens 8 Zeichen haben').max(100),
  confirmPassword: z.string().min(1, 'Passwort bestätigen ist erforderlich'),
}).refine(d => d.password === d.confirmPassword, {
  message: 'Passwörter stimmen nicht überein',
  path: ['confirmPassword'],
})
type RegisterFormValues = z.infer<typeof registerSchema>

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p className="text-xs text-[var(--danger)] flex items-center gap-1">
      <AlertCircle className="h-3 w-3" />{message}
    </p>
  )
}

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteToken = searchParams.get('token')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  })

  async function onSubmit(values: RegisterFormValues) {
    setServerError(null)
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name,
          email: values.email,
          password: values.password,
          inviteToken: inviteToken ?? undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setServerError(data.error ?? 'Registrierung fehlgeschlagen.'); return }
      setSuccess(true)
      setTimeout(() => router.push('/login'), 2500)
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
        Konto erstellt!
      </h2>
      <p className="text-sm text-[var(--text-muted)]">
        Du wirst gleich zur Anmeldung weitergeleitet…
      </p>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-2xl font-extrabold text-foreground mb-1"
          style={{ fontFamily: 'var(--font-syne, system-ui)' }}
        >
          {inviteToken ? 'Einladung annehmen' : 'Konto erstellen'}
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          {inviteToken ? 'Erstelle dein Konto und tritt der WG bei' : 'Erstelle dein kostenloses Konto'}
        </p>
      </div>

      {serverError && (
        <div className="flex items-start gap-2.5 rounded-xl bg-[var(--danger-bg)] border border-[color-mix(in_srgb,var(--danger)_30%,transparent)] p-3.5 text-sm text-[var(--danger)]">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" placeholder="Max Mustermann" {...register('name')} />
          <FieldError message={errors.name?.message} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">E-Mail</Label>
          <Input id="email" type="email" placeholder="name@beispiel.de" {...register('email')} />
          <FieldError message={errors.email?.message} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Passwort</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              className="pr-11"
              placeholder="Mindestens 8 Zeichen"
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle)] hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <FieldError message={errors.password?.message} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Passwort bestätigen</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirm ? 'text' : 'password'}
              className="pr-11"
              placeholder="Passwort wiederholen"
              {...register('confirmPassword')}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle)] hover:text-foreground transition-colors"
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <FieldError message={errors.confirmPassword?.message} />
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Registrieren…
            </span>
          ) : (
            <>
              <UserPlus className="h-4 w-4" />
              Konto erstellen
            </>
          )}
        </Button>
      </form>

      <p className="text-sm text-center text-[var(--text-muted)]">
        Bereits ein Konto?{' '}
        <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-700 transition-colors">
          Anmelden
        </Link>
      </p>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <Card className="shadow-lg border-0 bg-white dark:bg-gray-900">
        <CardContent className="pt-10 pb-10 text-center text-gray-400">Laden…</CardContent>
      </Card>
    }>
      <RegisterForm />
    </Suspense>
  )
}
