'use client'

import * as React from 'react'
import { useSession } from 'next-auth/react'
import { Send, RefreshCw, MessageSquare } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { cn, formatDate, getInitials } from '@/lib/utils'

interface Author {
  id: string
  name: string
  email: string
  avatarUrl: string | null
}

interface Reaction {
  id: string
  userId: string
  emoji: string
}

interface Announcement {
  id: string
  content: string
  createdAt: string
  author: Author
  reactions: Reaction[]
  reactionCounts: Record<string, number>
}

const REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉']
const MAX_LENGTH = 500

function RelativeTime({ date }: { date: string }) {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (diff < 60) return <>gerade eben</>
  if (diff < 3600) return <>vor {Math.floor(diff / 60)} Min.</>
  if (diff < 86400) return <>vor {Math.floor(diff / 3600)} Std.</>
  if (diff < 604800) return <>vor {Math.floor(diff / 86400)} Tagen</>
  return <>{new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</>
}

export default function AnnouncementsPage() {
  const { data: session } = useSession()
  const [announcements, setAnnouncements] = React.useState<Announcement[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [content, setContent] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [submitError, setSubmitError] = React.useState('')
  const [reactionLoading, setReactionLoading] = React.useState<string | null>(null)

  const fetchData = React.useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/announcements')
      if (!res.ok) throw new Error('Fehler beim Laden')
      const data = await res.json()
      setAnnouncements(data.announcements ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || content.length > MAX_LENGTH) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSubmitError(data.error ?? 'Fehler beim Senden')
      } else {
        setContent('')
        fetchData()
      }
    } catch {
      setSubmitError('Netzwerkfehler. Bitte erneut versuchen.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReaction = async (announcementId: string, emoji: string) => {
    const key = `${announcementId}-${emoji}`
    setReactionLoading(key)
    try {
      const res = await fetch(`/api/announcements/${announcementId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      })
      if (res.ok) {
        setAnnouncements((prev) =>
          prev.map((a) => {
            if (a.id !== announcementId) return a
            const myReaction = a.reactions.find(
              (r) => r.userId === session?.user?.id && r.emoji === emoji
            )
            let reactions: Reaction[]
            let reactionCounts: Record<string, number>

            if (myReaction) {
              reactions = a.reactions.filter((r) => r.id !== myReaction.id)
              reactionCounts = {
                ...a.reactionCounts,
                [emoji]: Math.max(0, (a.reactionCounts[emoji] ?? 1) - 1),
              }
            } else {
              const newReaction: Reaction = {
                id: Date.now().toString(),
                userId: session?.user?.id ?? '',
                emoji,
              }
              reactions = [...a.reactions, newReaction]
              reactionCounts = {
                ...a.reactionCounts,
                [emoji]: (a.reactionCounts[emoji] ?? 0) + 1,
              }
            }
            return { ...a, reactions, reactionCounts }
          })
        )
      }
    } catch {
      // ignore
    } finally {
      setReactionLoading(null)
    }
  }

  const hasMyReaction = (announcement: Announcement, emoji: string) => {
    return announcement.reactions.some(
      (r) => r.userId === session?.user?.id && r.emoji === emoji
    )
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Schwarzes Brett</h1>
          <p className="text-sm text-gray-500 mt-1">Ankündigungen und Mitteilungen</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          <span className="hidden sm:inline">Aktualisieren</span>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-indigo-500" />
            <h2 className="text-base font-semibold text-gray-900">Neue Ankündigung</h2>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Was möchtest du mitteilen?"
                rows={4}
                maxLength={MAX_LENGTH}
                className="resize-none pr-16 text-base sm:text-sm min-h-[100px]"
              />
              <span
                className={cn(
                  'absolute bottom-2 right-2 text-xs',
                  content.length > MAX_LENGTH * 0.9 ? 'text-red-500' : 'text-gray-400'
                )}
              >
                {content.length}/{MAX_LENGTH}
              </span>
            </div>
            {submitError && (
              <p className="text-sm text-red-600 bg-red-50 rounded-xl p-2">{submitError}</p>
            )}
            <Button
              type="submit"
              disabled={submitting || !content.trim() || content.length > MAX_LENGTH}
              className="w-full sm:w-auto sm:ml-auto sm:flex min-h-[44px]"
            >
              <Send className="h-4 w-4" />
              {submitting ? 'Sende...' : 'Veröffentlichen'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="space-y-1 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))
        ) : announcements.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 py-16 text-center">
            <MessageSquare className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 font-medium">Keine Ankündigungen</p>
            <p className="text-sm text-gray-400 mt-1">Schreibe die erste Nachricht!</p>
          </div>
        ) : (
          announcements.map((announcement) => (
            <Card key={announcement.id} className="overflow-hidden">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-9 w-9 shrink-0">
                    {announcement.author.avatarUrl && (
                      <AvatarImage
                        src={announcement.author.avatarUrl}
                        alt={announcement.author.name}
                      />
                    )}
                    <AvatarFallback className="text-sm bg-indigo-100 text-indigo-700">
                      {getInitials(announcement.author.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">
                        {announcement.author.name}
                        {announcement.author.id === session?.user?.id && (
                          <span className="ml-1 text-indigo-500 font-normal text-xs">(Du)</span>
                        )}
                      </span>
                      <span className="text-xs text-gray-400">
                        <RelativeTime date={announcement.createdAt} />
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">
                      {announcement.content}
                    </p>
                  </div>
                </div>

                <Separator className="mt-4 mb-3" />

                <div className="flex flex-wrap gap-2">
                  {REACTION_EMOJIS.map((emoji) => {
                    const count = announcement.reactionCounts[emoji] ?? 0
                    const mine = hasMyReaction(announcement, emoji)
                    const loadingKey = `${announcement.id}-${emoji}`
                    return (
                      <button
                        key={emoji}
                        onClick={() => handleReaction(announcement.id, emoji)}
                        disabled={reactionLoading === loadingKey}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm transition-all min-h-[44px] min-w-[44px] active:scale-90',
                          mine
                            ? 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
                          reactionLoading === loadingKey && 'opacity-50 cursor-wait'
                        )}
                      >
                        <span className="text-base">{emoji}</span>
                        {count > 0 && (
                          <span className="text-sm font-medium">{count}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
