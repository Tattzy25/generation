import type { Metadata } from 'next'

import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { Geist, Geist_Mono, Source_Serif_4 } from 'next/font/google'

const geist = Geist({ variable: '--font-geist', subsets: ['latin'], weight: ["100","200","300","400","500","600","700","800","900"] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'], weight: ["100","200","300","400","500","600","700","800","900"] })
const sourceSerif4 = Source_Serif_4({ variable: '--font-source-serif-4', subsets: ['latin'], weight: ["200","300","400","500","600","700","800","900"] })

export const metadata: Metadata = {
  title: 'Image Studio',
  description: 'AI-powered image generation',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${sourceSerif4.variable}`}>
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
