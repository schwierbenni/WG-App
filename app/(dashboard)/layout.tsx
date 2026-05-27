import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Sidebar, BottomNav } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { PushNotificationPrompt } from '@/components/push-notification-prompt'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  const { name, email, image, role } = session.user
  const wgId = (session.user as { wgId?: string }).wgId

  let wgName = 'Meine WG'
  let wgAvatarUrl: string | null = null
  if (wgId) {
    const wgConfig = await prisma.wGConfig.findUnique({ where: { id: wgId }, select: { name: true, avatarUrl: true } })
    if (wgConfig) {
      wgName = wgConfig.name
      wgAvatarUrl = wgConfig.avatarUrl
    }
  }

  return (
    <div className="fixed inset-0 flex overflow-hidden bg-surface-muted" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Desktop sidebar */}
      <Sidebar
        userRole={role}
        userName={name ?? undefined}
        userEmail={email ?? undefined}
        userAvatar={image ?? undefined}
        wgName={wgName}
        wgAvatarUrl={wgAvatarUrl}
      />

      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <Header
          userName={name}
          userEmail={email}
          userAvatar={image ?? undefined}
          wgName={wgName}
          wgAvatarUrl={wgAvatarUrl}
        />

        {/* Main content — extra bottom padding on mobile for the bottom nav */}
        <main className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6"
          style={{ paddingBottom: 'max(4.5rem, calc(4rem + env(safe-area-inset-bottom, 0px)))' }}>
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <BottomNav userRole={role} userEmail={email ?? undefined} />

      {/* Push notification permission prompt */}
      <PushNotificationPrompt />
    </div>
  )
}
