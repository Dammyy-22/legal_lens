import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'LegalLens - AI Legal Information Platform',
  description: 'Understand laws, rights, and procedures with AI assistance in Nigeria',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
