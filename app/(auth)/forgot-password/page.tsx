'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react'

const schema = z.object({ email: z.string().email('Ungültige E-Mail-Adresse') })
type Values = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [serverError, setServerError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const { register, handleSubmit, getValues, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema), defaultValues: { email: '' },
  })

  async function onSubmit(values: Values) {
    setServerError(null)
    try {
      const res = await fetch('/api/auth/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })
      const data = await res.json()
      if (!res.ok) { setServerError(data.error ?? 'Anfrage fehlgeschlagen.'); return }
      setSuccess(true)
    } catch { setServerError('Ein unerwarteter Fehler ist aufgetreten.') }
  }

  if (success) return (
    <Card className="shadow-lg border-0 bg-white dark:bg-gray-900">
      <CardContent className="pt-10 pb-10 flex flex-col items-center gap-4 text-center">
        <div className="rounded-full bg-green-100 p-4"><CheckCircle2 className="h-10 w-10 text-green-600" /></div>
        <h2 className="text-xl font-bold">E-Mail gesendet!</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">Falls ein Konto mit <span className="font-medium">{getValues('email')}</span> existiert, erhältst du einen Reset-Link.</p>
        <Link href="/login" className="mt-2 inline-flex items-center gap-1.5 text-sm text-indigo-600 font-medium"><ArrowLeft className="h-4 w-4" />Zurück zur Anmeldung</Link>
      </CardContent>
    </Card>
  )

  return (
    <Card className="shadow-lg border-0 bg-white dark:bg-gray-900">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-2xl font-bold text-center">Passwort vergessen</CardTitle>
        <CardDescription className="text-center">Gib deine E-Mail-Adresse ein und wir senden dir einen Reset-Link</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardContent className="space-y-4">
          {serverError && <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700"><AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /><span>{serverError}</span></div>}
          <div className="space-y-2"><Label htmlFor="email">E-Mail-Adresse</Label><Input id="email" type="email" placeholder="name@beispiel.de" {...register('email')} />{errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}</div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 pt-2">
          <Button type="submit" className="w-full" disabled={isSubmitting}><Mail className="mr-2 h-4 w-4" />{isSubmitting ? 'Sende E-Mail…' : 'Link anfordern'}</Button>
          <Link href="/login" className="inline-flex items-center justify-center gap-1.5 text-sm text-gray-600 hover:text-gray-800"><ArrowLeft className="h-4 w-4" />Zurück zur Anmeldung</Link>
        </CardFooter>
      </form>
    </Card>
  )
}
