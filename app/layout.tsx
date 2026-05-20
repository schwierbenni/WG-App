import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: { default: 'FlatMate – WG-Verwaltung', template: '%s | FlatMate' },
  description: 'Verwalte deine WG einfach und übersichtlich. Dienste, Ausgaben, Einkaufslisten und mehr.',
  keywords: ['WG', 'Wohngemeinschaft', 'Verwaltung', 'Dienste', 'Haushalt'],
  authors: [{ name: 'FlatMate' }],
  robots: 'noindex, nofollow',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full bg-background text-foreground">{children}</body>
    </html>
  )
}
