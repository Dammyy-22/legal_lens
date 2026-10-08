import type { Metadata } from 'next'

// Self-hosted fonts via @fontsource — no runtime dependency on any external font CDN.
// Space Grotesk (display) + Plus Jakarta Sans (body) replace the earlier
// Newsreader/Public Sans pairing — same "professional, modern grotesk" spirit as
// Clash Display/Grotesk, which aren't available here (Fontshare's CDN isn't reachable
// from this build environment, and bundling their font files without being able to
// fetch/verify them isn't something to fake). See DECISIONS.md.
import '@fontsource/space-grotesk/400.css'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/600.css'
import '@fontsource/space-grotesk/700.css'
import '@fontsource/plus-jakarta-sans/400.css'
import '@fontsource/plus-jakarta-sans/500.css'
import '@fontsource/plus-jakarta-sans/600.css'
import '@fontsource/plus-jakarta-sans/700.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'

import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'LegalLens | Nigerian Legal Information',
    template: '%s | LegalLens',
  },
  description:
    'Understand Nigerian law through clear explanations, searchable primary sources, and practical guides.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className="font-body bg-paper text-charcoal">
        {children}
      </body>
    </html>
  )
}
