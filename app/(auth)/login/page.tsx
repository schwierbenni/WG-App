'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react'

const loginSchema = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse'),
  password: z.string().min(1, 'Passwort ist erforderlich'),
  rememberMe: z.boolean().optional(),
})
type LoginFormValues = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
  })

  async function onSubmit(values: LoginFormValues) {
    setServerError(null)
    try {
      const result = await signIn('credentials', {
        email: values.email,
        password: values.password,
        redirect: false,
      })
      if (!result) { setServerError('Anmeldung fehlgeschlagen.'); return }
      if (result.error) { setServerError('E-Mail oder Passwort ist falsch.'); return }
      router.push('/dashboard')
      router.refresh()
    } catch {
      setServerError('Ein unerwarteter Fehler ist aufgetreten.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Heading */}
      <div>
        <h1
          className="text-2xl font-extrabold text-foreground mb-1"
          style={{ fontFamily: 'var(--font-syne, system-ui)' }}
        >
          Willkommen zurück
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          Melde dich mit deinem WG-Konto an
        </p>
      </div>

      {/* Error banner */}
      {serverError && (
        <div className="flex items-start gap-2.5 rounded-xl bg-[var(--danger-bg)] border border-[color-mix(in_srgb,var(--danger)_30%,transparent)] p-3.5 text-sm text-[var(--danger)]">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="email">E-Mail</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="name@beispiel.de"
            aria-invalid={!!errors.email}
            {...register('email')}
          />
          {errors.email && (
            <p className="text-xs text-[var(--danger)] flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Passwort</Label>
            <Link
              href="/forgot-password"
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors"
            >
              Vergessen?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              className="pr-11"
              aria-invalid={!!errors.password}
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle)] hover:text-foreground transition-colors"
              aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-[var(--danger)] flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Remember me */}
        <div className="flex items-center gap-2.5">
          <input
            id="rememberMe"
            type="checkbox"
            className="h-4 w-4 rounded-md border-2 border-surface-border accent-[var(--brand-600)] cursor-pointer"
            {...register('rememberMe')}
          />
          <Label htmlFor="rememberMe" className="text-sm font-normal cursor-pointer text-[var(--text-muted)]">
            Angemeldet bleiben
          </Label>
        </div>

        {/* Submit */}
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Anmelden…
            </span>
          ) : (
            <>
              <LogIn className="h-4 w-4" />
              Anmelden
            </>
          )}
        </Button>
      </form>

      {/* Register link */}
      <p className="text-sm text-center text-[var(--text-muted)]">
        Noch kein Konto?{' '}
        <Link
          href="/register"
          className="font-semibold text-brand-600 hover:text-brand-700 transition-colors"
        >
          Jetzt registrieren
        </Link>
      </p>
    </div>
  )
}
