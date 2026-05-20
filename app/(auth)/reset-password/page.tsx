'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Eye, EyeOff, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react'

const schema = z.object({
  password: z.string().min(8, 'Mindestens 8 Zeichen').max(100),
  confirmPassword: z.string().min(1),
}).refine(d => d.password === d.confirmPassword, { message: 'Passwörter stimmen nicht überein', path: ['confirmPassword'] })
type Values = z.infer<typeof schema>

export default function ResetPasswordPage() {
  const router = useRouter()
  const token = useSearchParams().get('token')
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema), defaultValues: { password: '', confirmPassword: '' },
  })

  if (!token) return (
    <Card className="shadow-lg border-0 bg-white dark:bg-gray-900">
      <CardContent className="pt-10 pb-10 flex flex-col items-center gap-4 text-center">
        <div className="rounded-full bg-red-100 p-4"><AlertCircle className="h-10 w-10 text-red-600" /></div>
        <h2 className="text-xl font-bold">Ungültiger Link</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">Der Reset-Link ist ungültig oder fehlt.</p>
        <Link href="/forgot-password" className="text-sm text-indigo-600 font-medium">Neuen Link anfordern</Link>
      </CardContent>
    </Card>
  )

  async function onSubmit(values: Values) {
    setServerError(null)
    try {
      const res = await fetch('/api/auth/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password: values.password }) })
      const data = await res.json()
      if (!res.ok) { setServerError(data.error ?? 'Fehler beim Zurücksetzen.'); return }
      setSuccess(true)
      setTimeout(() => router.push('/login'), 3000)
    } catch { setServerError('Ein unerwarteter Fehler ist aufgetreten.') }
  }

  if (success) return (
    <Card className="shadow-lg border-0 bg-white dark:bg-gray-900">
      <CardContent className="pt-10 pb-10 flex flex-col items-center gap-4 text-center">
        <div className="rounded-full bg-green-100 p-4"><CheckCircle2 className="h-10 w-10 text-green-600" /></div>
        <h2 className="text-xl font-bold">Passwort zurückgesetzt!</h2>
        <p className="text-sm text-gray-600">Du wirst zur Anmeldung weitergeleitet…</p>
      </CardContent>
    </Card>
  )

  return (
    <Card className="shadow-lg border-0 bg-white dark:bg-gray-900">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-2xl font-bold text-center">Neues Passwort</CardTitle>
        <CardDescription className="text-center">Wähle ein sicheres neues Passwort</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardContent className="space-y-4">
          {serverError && <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700"><AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /><span>{serverError}</span></div>}
          <div className="space-y-2"><Label htmlFor="password">Neues Passwort</Label><div className="relative"><Input id="password" type={showPw ? 'text' : 'password'} className="pr-10" {...register('password')} placeholder="Mindestens 8 Zeichen" /><button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>{errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}</div>
          <div className="space-y-2"><Label htmlFor="confirmPassword">Passwort bestätigen</Label><div className="relative"><Input id="confirmPassword" type={showConfirm ? 'text' : 'password'} className="pr-10" {...register('confirmPassword')} placeholder="Passwort wiederholen" /><button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>{errors.confirmPassword && <p className="text-xs text-red-600">{errors.confirmPassword.message}</p>}</div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 pt-2">
          <Button type="submit" className="w-full" disabled={isSubmitting}><KeyRound className="mr-2 h-4 w-4" />{isSubmitting ? 'Speichere…' : 'Passwort speichern'}</Button>
          <Link href="/login" className="text-sm text-center text-gray-600">Zurück zur Anmeldung</Link>
        </CardFooter>
      </form>
    </Card>
  )
}
