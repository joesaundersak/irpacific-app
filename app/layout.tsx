import { Roboto } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import { ChunkLoadErrorHandler } from '@/components/chunk-load-error-handler'
import { AuthProvider } from '@/components/auth-provider'

export const dynamic = 'force-dynamic'

const roboto = Roboto({ subsets: ['latin'], weight: ['300', '400', '500', '700'], variable: '--font-sans' })

export const metadata = {
  title: 'IR Pacific Operations',
  description: 'Operations management platform for Interior Resources',
  metadataBase: new URL(process.env.NEXTAUTH_URL || 'http://localhost:3000'),
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/icon-192.png',
  },
  openGraph: {
    images: ['/og-image.png'],
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'IR Pacific',
  },
}

export const viewport = {
  themeColor: '#1A7B84',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${roboto.variable} font-sans`}>
        <AuthProvider>
          {children}
          <Toaster />
          <ChunkLoadErrorHandler />
        </AuthProvider>
      </body>
    </html>
  )
}
