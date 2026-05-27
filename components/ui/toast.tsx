'use client'

import * as React from 'react'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  title?: string
  description?: string
  variant?: ToastVariant
  duration?: number
}

interface ToastContextValue {
  toasts: Toast[]
  toast: (options: Omit<Toast, 'id'>) => void
  dismiss: (id: string) => void
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = React.useCallback(
    ({ duration = 5000, ...options }: Omit<Toast, 'id'>) => {
      const id = Math.random().toString(36).slice(2)
      setToasts((prev) => [...prev, { id, duration, ...options }])
      if (duration > 0) setTimeout(() => dismiss(id), duration)
    },
    [dismiss]
  )

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = React.useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}

const variantConfig: Record<ToastVariant, { icon: React.ReactNode; containerClass: string; iconClass: string }> = {
  default: { icon: <Info className="h-5 w-5" />, containerClass: 'bg-white border-gray-200 text-gray-950', iconClass: 'text-gray-500' },
  success: { icon: <CheckCircle className="h-5 w-5" />, containerClass: 'bg-white border-green-200 text-gray-950', iconClass: 'text-green-500' },
  error: { icon: <AlertCircle className="h-5 w-5" />, containerClass: 'bg-white border-red-200 text-gray-950', iconClass: 'text-red-500' },
  warning: { icon: <AlertTriangle className="h-5 w-5" />, containerClass: 'bg-white border-yellow-200 text-gray-950', iconClass: 'text-yellow-500' },
  info: { icon: <Info className="h-5 w-5" />, containerClass: 'bg-white border-blue-200 text-gray-950', iconClass: 'text-blue-500' },
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const variant = toast.variant ?? 'default'
  const { icon, containerClass, iconClass } = variantConfig[variant]

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        'pointer-events-auto flex w-full items-start gap-3 rounded-lg border p-4 shadow-lg',
        'animate-in slide-in-from-right-full duration-300',
        containerClass
      )}
    >
      <span className={cn('mt-0.5 shrink-0', iconClass)}>{icon}</span>
      <div className="flex-1 space-y-1">
        {toast.title && <p className="text-sm font-semibold leading-snug">{toast.title}</p>}
        {toast.description && <p className="text-sm text-gray-500 leading-snug">{toast.description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 rounded-sm p-0.5 text-gray-400 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        aria-label="Schließen"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

function ToastViewport({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null
  return (
    <div
      aria-label="Benachrichtigungen"
      className="fixed right-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:right-4 sm:top-auto sm:max-w-[420px]"
      style={{ bottom: 'var(--toast-bottom-offset)' }}
    >
      {toasts.map((t) => <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />)}
    </div>
  )
}
