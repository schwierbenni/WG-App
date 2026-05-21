'use client'

import { SessionProvider } from 'next-auth/react'
import { ServiceWorkerRegister } from './service-worker-register'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ServiceWorkerRegister />
      {children}
    </SessionProvider>
  )
}
