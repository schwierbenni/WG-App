'use client'

import { SessionProvider } from 'next-auth/react'
import { ServiceWorkerRegister } from './service-worker-register'
import { ToastProvider } from '@/components/ui/toast'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>
        <ServiceWorkerRegister />
        {children}
      </ToastProvider>
    </SessionProvider>
  )
}
