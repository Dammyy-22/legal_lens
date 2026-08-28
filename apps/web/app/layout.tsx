import type { Metadata } from 'next'

// Self-hosted fonts via @fontsource — no runtime dependency on Google's font CDN
// being reachable. Weights match what's actually used in the design (see
// tailwind.config.ts fontFamily mapping).
import '@fontsource/newsreader/400.css'
import '@fontsource/newsreader/400-italic.css'
import '@fontsource/newsreader/500.css'
import '@fontsource/newsreader/600.css'
import '@fontsource/public-sans/400.css'
import '@fontsource/public-sans/500.css'
import '@fontsource/public-sans/600.css'
import '@fontsource/public-sans/700.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'

import './globals.css'

export const metadata: Metadata = {
  title: 'LegalLens — Understand Nigerian Law, Grounded in Real Sources',
  description:
    'AI-powered legal information for Nigeria. Every answer traced to a verified, citable source — never invented.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased font-body bg-paper text-charcoal">
        {children}
      </body>
    </html>
  )
}
