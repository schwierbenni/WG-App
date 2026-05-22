'use client'

import { useEffect, useState } from 'react'
import { Bell, Share, X } from 'lucide-react'

const STORAGE_KEY = 'push-prompt-dismissed'
const IOS_STORAGE_KEY = 'push-ios-prompt-dismissed'

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const bytes = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    bytes[i] = rawData.charCodeAt(i)
  }
  return bytes.buffer
}

export function PushNotificationPrompt() {
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isIOSBrowser, setIsIOSBrowser] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    if (!('PushManager' in window)) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true
      if (isIOS && !isStandalone && !localStorage.getItem(IOS_STORAGE_KEY)) {
        setIsIOSBrowser(true)
        const timer = setTimeout(() => setVisible(true), 3000)
        return () => clearTimeout(timer)
      }
      return
    }

    if (Notification.permission === 'denied') return

    if (Notification.permission === 'granted') {
      ensureSubscription()
      return
    }

    if (localStorage.getItem(STORAGE_KEY)) return

    const timer = setTimeout(() => setVisible(true), 3000)
    return () => clearTimeout(timer)
  }, [])

  async function ensureSubscription() {
    try {
      const reg = await navigator.serviceWorker.ready
      const res = await fetch('/api/push/vapid-public-key')
      const { key } = await res.json()
      if (!key) return

      let subscription = await reg.pushManager.getSubscription()
      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key),
        })
      }

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      })
    } catch (err) {
      console.error('Push subscription ensure failed:', err)
    }
  }

  async function handleAllow() {
    setLoading(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        dismiss()
        return
      }

      const reg = await navigator.serviceWorker.ready

      // Fetch VAPID public key
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

      setVisible(false)
    } catch (err) {
      console.error('Push subscription failed:', err)
      dismiss()
    } finally {
      setLoading(false)
    }
  }

  function dismiss() {
    if (isIOSBrowser) {
      localStorage.setItem(IOS_STORAGE_KEY, '1')
    } else {
      localStorage.setItem(STORAGE_KEY, '1')
    }
    setVisible(false)
  }

  if (!visible) return null

  if (isIOSBrowser) {
    return (
      <div className="fixed bottom-20 left-4 right-4 lg:left-auto lg:right-6 lg:bottom-6 lg:w-96 z-50 animate-in slide-in-from-bottom-4 duration-300">
        <div className="bg-surface rounded-xl border border-surface-border shadow-xl p-4 flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-brand-muted flex items-center justify-center">
            <Share className="w-5 h-5 text-brand-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Push-Benachrichtigungen aktivieren</p>
            <p className="text-xs text-text-muted mt-0.5">
              Tippe auf <span className="font-medium">Teilen</span> und dann auf{' '}
              <span className="font-medium">„Zum Home-Bildschirm"</span>, um Push-Benachrichtigungen auf dem iPhone zu nutzen.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={dismiss}
                className="flex-1 text-xs font-medium bg-surface-muted text-text-muted rounded-lg px-3 py-2 hover:bg-surface-border transition-colors"
              >
                Verstanden
              </button>
            </div>
          </div>
          <button onClick={dismiss} className="flex-shrink-0 text-text-subtle hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 lg:left-auto lg:right-6 lg:bottom-6 lg:w-96 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-surface rounded-xl border border-surface-border shadow-xl p-4 flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-brand-muted flex items-center justify-center">
          <Bell className="w-5 h-5 text-brand-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Push-Benachrichtigungen</p>
          <p className="text-xs text-text-muted mt-0.5">
            Erhalte Benachrichtigungen für Dienste, Ankündigungen und Tausch-Anfragen – auch wenn die App geschlossen ist.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleAllow}
              disabled={loading}
              className="flex-1 text-xs font-medium bg-brand-500 text-white rounded-lg px-3 py-2 hover:bg-brand-600 transition-colors disabled:opacity-60"
            >
              {loading ? 'Wird aktiviert…' : 'Erlauben'}
            </button>
            <button
              onClick={dismiss}
              className="flex-1 text-xs font-medium bg-surface-muted text-text-muted rounded-lg px-3 py-2 hover:bg-surface-border transition-colors"
            >
              Nicht jetzt
            </button>
          </div>
        </div>
        <button onClick={dismiss} className="flex-shrink-0 text-text-subtle hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
