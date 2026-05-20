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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Eye, EyeOff, UserPlus, AlertCircle, CheckCircle2 } from 'lucide-react'

const registerSchema = z.object({
  name: z.string().min(2, 'Name muss mindestens 2 Zeichen haben').max(100),
  email: z.string().email('Ungültige E-Mail-Adresse'),
  password: z.string().min(8, 'Passwort muss mindestens 8 Zeichen haben').max(100),
  confirmPassword: z.string().min(1, 'Passwort bestätigen ist erforderlich'),
}).refine(d => d.password === d.confirmPassword, { message: 'Passwörter stimmen nicht überein', path: ['confirmPassword'] })
type RegisterFormValues = z.infer<typeof registerSchema>

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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: values.name, email: values.email, password: values.password, inviteToken: inviteToken ?? undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setServerError(data.error ?? 'Registrierung fehlgeschlagen.'); return }
      setSuccess(true)
      setTimeout(() => router.push('/login'), 2500)
    } catch { setServerError('Ein unerwarteter Fehler ist aufgetreten.') }
  }

  if (success) return (
    <Card className="shadow-lg border-0 bg-white dark:bg-gray-900">
      <CardContent className="pt-10 pb-10 flex flex-col items-center gap-4 text-center">
        <div className="rounded-full bg-green-100 p-4"><CheckCircle2 className="h-10 w-10 text-green-600" /></div>
        <h2 className="text-xl font-bold">Registrierung erfolgreich!</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">Dein Konto wurde erstellt. Du wirst gleich zur Anmeldung weitergeleitet…</p>
      </CardContent>
    </Card>
  )

  return (
    <Card className="shadow-lg border-0 bg-white dark:bg-gray-900">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-2xl font-bold text-center">Konto erstellen</CardTitle>
        <CardDescription className="text-center">{inviteToken ? 'Du wurdest eingeladen' : 'Erstelle ein neues FlatMate-Konto'}</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardContent className="space-y-4">
          {serverError && <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700"><AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /><span>{serverError}</span></div>}
          <div className="space-y-2"><Label htmlFor="name">Name</Label><Input id="name" {...register('name')} placeholder="Max Mustermann" />{errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}</div>
          <div className="space-y-2"><Label htmlFor="email">E-Mail</Label><Input id="email" type="email" {...register('email')} placeholder="name@beispiel.de" />{errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}</div>
          <div className="space-y-2"><Label htmlFor="password">Passwort</Label><div className="relative"><Input id="password" type={showPassword ? 'text' : 'password'} className="pr-10" {...register('password')} placeholder="Mindestens 8 Zeichen" /><button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>{errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}</div>
          <div className="space-y-2"><Label htmlFor="confirmPassword">Passwort bestätigen</Label><div className="relative"><Input id="confirmPassword" type={showConfirm ? 'text' : 'password'} className="pr-10" {...register('confirmPassword')} placeholder="Passwort wiederholen" /><button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>{errors.confirmPassword && <p className="text-xs text-red-600">{errors.confirmPassword.message}</p>}</div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 pt-2">
          <Button type="submit" className="w-full" disabled={isSubmitting}><UserPlus className="mr-2 h-4 w-4" />{isSubmitting ? 'Registrieren…' : 'Konto erstellen'}</Button>
          <p className="text-sm text-center text-gray-600 dark:text-gray-400">Bereits ein Konto?{' '}<Link href="/login" className="text-indigo-600 font-medium">Anmelden</Link></p>
        </CardFooter>
      </form>
    </Card>
  )
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  )
}
