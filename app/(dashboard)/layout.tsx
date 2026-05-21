import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Sidebar, BottomNav } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  const { name, email, image, role } = session.user
  const wgId = (session.user as { wgId?: string }).wgId

  let wgName = 'Meine WG'
  if (wgId) {
    const wgConfig = await prisma.wGConfig.findUnique({ where: { id: wgId }, select: { name: true } })
    if (wgConfig) wgName = wgConfig.name
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface-muted">
      {/* Desktop sidebar */}
      <Sidebar
        userRole={role}
        userName={name ?? undefined}
        userEmail={email ?? undefined}
        userAvatar={image ?? undefined}
        wgName={wgName}
      />

      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <Header
          userName={name}
          userEmail={email}
          userAvatar={image ?? undefined}
          wgName={wgName}
        />

        {/* Main content — extra bottom padding on mobile for the bottom nav */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 lg:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <BottomNav userRole={role} />
    </div>
  )
}
