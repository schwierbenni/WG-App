import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  const { name, email, image, role } = session.user

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--surface-muted)]">
      <Sidebar
        userRole={role}
        userName={name ?? undefined}
        userEmail={email ?? undefined}
        userAvatar={image ?? undefined}
      />

      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <Header
          userName={name}
          userEmail={email}
          userAvatar={image ?? undefined}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
