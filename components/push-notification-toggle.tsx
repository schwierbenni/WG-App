'use client'

import * as React from 'react'
import { Smartphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'

type PushState = 'loading' | 'unsupported' | 'ios-browser' | 'denied' | 'enabled' | 'disabled'

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const bytes = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) bytes[i] = rawData.charCodeAt(i)
  return bytes.buffer
}

const STATE_LABELS: Record<PushState, string> = {
  loading: 'Wird geladen…',
  unsupported: 'Nicht unterstützt',
  'ios-browser': 'App installieren',
  denied: 'Blockiert im Browser',
  enabled: 'Aktiv',
  disabled: 'Inaktiv',
}

export function PushNotificationToggle() {
  const [state, setState] = React.useState<PushState>('loading')
  const [toggling, setToggling] = React.useState(false)

  React.useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      setState('unsupported')
      return
    }
    if (!('PushManager' in window)) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      const isStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
      setState(isIOS && !isStandalone ? 'ios-browser' : 'unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setState('denied')
      return
    }
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription()
      setState(sub ? 'enabled' : 'disabled')
    }).catch(() => setState('disabled'))
  }, [])

  async function handleEnable() {
    setToggling(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState('denied')
        return
      }
      const reg = await navigator.serviceWorker.ready
      const res = await fetch('/api/push/vapid-public-key')
      const { key } = await res.json()
      if (!key) throw new Error('No VAPID key')

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      })
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      })
      setState('enabled')
    } catch {
      // silent – state stays as-is
    } finally {
      setToggling(false)
    }
  }

  async function handleDisable() {
    setToggling(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setState('disabled')
    } catch {
      // silent
    } finally {
      setToggling(false)
    }
  }

  const isOn = state === 'enabled'
  const isInteractive = state === 'enabled' || state === 'disabled'

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Smartphone className="h-4 w-4 text-indigo-500" />
        <div>
          <Label className="cursor-default">Push-Benachrichtigungen</Label>
          <p className="text-xs text-gray-400">
            {state === 'denied'
              ? 'Im Browser blockiert – bitte in den Browser-Einstellungen erlauben'
              : state === 'unsupported'
              ? 'Dein Browser unterstützt Push-Benachrichtigungen nicht'
              : state === 'ios-browser'
              ? 'Tippe auf „Teilen" → „Zum Home-Bildschirm" und öffne die App von dort'
              : 'Benachrichtigungen für Dienste, Ankündigungen & Kalender'}
          </p>
        </div>
      </div>

      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
        <button
          type="button"
          role="switch"
          aria-checked={isOn}
          disabled={!isInteractive || toggling}
          onClick={isOn ? handleDisable : handleEnable}
          className={cn(
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
            isOn ? 'bg-indigo-600' : 'bg-gray-200'
          )}
        >
          <span
            className={cn(
              'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transition-transform',
              isOn ? 'translate-x-5' : 'translate-x-0'
            )}
          />
        </button>
        <span className="text-[10px] text-gray-400">{toggling ? '…' : STATE_LABELS[state as PushState]}</span>
      </div>
    </div>
  )
}
