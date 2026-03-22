import type { Metadata, Viewport } from 'next'
import { DM_Sans, DM_Mono, Caveat } from 'next/font/google'
import './globals.css'
import Nav from '@/components/Nav'
import { ShutdownProvider } from '@/components/ShutdownProvider'

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

export const metadata: Metadata = {
  title: 'Operator',
  description: 'Executive reporting, unified.',
  icons: {
    icon: '/icon.svg',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmMono.variable} ${caveat.variable} h-full`}>
      <body className="min-h-full bg-[#fafafa]">
        <ShutdownProvider>
          <Nav />
          <main className="pt-24 pb-12 max-w-5xl mx-auto px-4 sm:px-6">{children}</main>
        </ShutdownProvider>
      </body>
    </html>
  )
}
