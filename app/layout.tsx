import type { Metadata, Viewport } from 'next'
import { Syne, DM_Sans } from 'next/font/google'
import { Providers } from '@/components/providers'
import './globals.css'

const syne = Syne({
  variable: '--font-syne',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

const dmSans = DM_Sans({
  variable: '--font-dmsans',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: { default: 'FlatMate – WG-Verwaltung', template: '%s | FlatMate' },
  description: 'Verwalte deine WG einfach und übersichtlich. Dienste, Ausgaben, Einkaufslisten und mehr.',
  keywords: ['WG', 'Wohngemeinschaft', 'Verwaltung', 'Dienste', 'Haushalt'],
  authors: [{ name: 'FlatMate' }],
  robots: 'noindex, nofollow',
  appleWebApp: {
    capable: true,
    title: 'FlatMate',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f4ef' },
    { media: '(prefers-color-scheme: dark)',  color: '#0f0d0b' },
  ],
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="de"
      className={`${syne.variable} ${dmSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
