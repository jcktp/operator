import type { Metadata, Viewport } from 'next'
import { DM_Sans, DM_Mono, Caveat } from 'next/font/google'
import './globals.css'
import Nav from '@/components/Nav'
import { ShutdownProvider } from '@/components/ShutdownProvider'
import { DispatchProvider } from '@/components/DispatchContext'
import { ModeProvider } from '@/components/ModeContext'
import MainLayout from '@/components/MainLayout'
import { prisma } from '@/lib/db'

const dmSans = DM_Sans({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const dmMono = DM_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  weight: ['300', '400', '500'],
})

const caveat = Caveat({
  variable: '--font-caveat',
  subsets: ['latin'],
  weight: ['600', '700'],
})

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Operator',
  description: 'Executive reporting, unified.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  let appMode: string | null = null
  try {
    const row = await prisma.setting.findUnique({ where: { key: 'app_mode' } })
    appMode = row?.value ?? null
  } catch { /* DB not ready yet */ }

  return (
    <html lang="en" className={`${dmSans.variable} ${dmMono.variable} ${caveat.variable} h-full`}>
      <body className="min-h-full bg-[#fafafa]">
        <ShutdownProvider>
          <DispatchProvider>
            <ModeProvider initialMode={appMode}>
              <Nav />
              <MainLayout>{children}</MainLayout>
            </ModeProvider>
          </DispatchProvider>
        </ShutdownProvider>
      </body>
    </html>
  )
}
