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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
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
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
  })

  async function onSubmit(values: LoginFormValues) {
    setServerError(null)
    try {
      const result = await signIn('credentials', { email: values.email, password: values.password, redirect: false })
      if (!result) { setServerError('Anmeldung fehlgeschlagen.'); return }
      if (result.error) { setServerError('E-Mail oder Passwort ist falsch.'); return }
      router.push('/dashboard')
      router.refresh()
    } catch { setServerError('Ein unerwarteter Fehler ist aufgetreten.') }
  }

  return (
    <Card className="shadow-lg border-0 bg-white dark:bg-gray-900">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-2xl font-bold text-center">Anmelden</CardTitle>
        <CardDescription className="text-center">Melde dich mit deiner E-Mail und deinem Passwort an</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardContent className="space-y-4">
          {serverError && (
            <div className="flex items-start gap-2 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-400">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /><span>{serverError}</span>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">E-Mail</Label>
            <Input id="email" type="email" autoComplete="email" placeholder="name@beispiel.de" aria-invalid={!!errors.email} {...register('email')} />
            {errors.email && <p className="text-xs text-red-600 dark:text-red-400">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Passwort</Label>
              <Link href="/forgot-password" className="text-xs text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">Passwort vergessen?</Link>
            </div>
            <div className="relative">
              <Input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="••••••••" className="pr-10" aria-invalid={!!errors.password} {...register('password')} />
              <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-600 dark:text-red-400">{errors.password.message}</p>}
          </div>
          <div className="flex items-center gap-2">
            <input id="rememberMe" type="checkbox" className="h-4 w-4 rounded border-gray-300 text-indigo-600" {...register('rememberMe')} />
            <Label htmlFor="rememberMe" className="text-sm font-normal cursor-pointer">Angemeldet bleiben</Label>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 pt-2">
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            <LogIn className="mr-2 h-4 w-4" />{isSubmitting ? 'Anmelden…' : 'Anmelden'}
          </Button>
          <p className="text-sm text-center text-gray-600 dark:text-gray-400">
            Noch kein Konto?{' '}
            <Link href="/register" className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 font-medium">Registrieren</Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
