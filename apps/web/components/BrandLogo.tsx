'use client'

import Image from 'next/image'
import Link from 'next/link'

export function BrandLogo({
  href = '/',
  compact = false,
  dark = false,
}: {
  href?: string
  compact?: boolean
  dark?: boolean
}) {
  return (
    <Link
      href={href}
      aria-label="LegalLens home"
      className={`relative inline-flex items-center shrink-0 overflow-hidden transition-transform hover:-translate-y-0.5 ${compact ? 'h-10 w-28' : 'h-14 w-40'} ${dark ? 'rounded-lg bg-ink px-2 py-1' : ''}`}
    >
      <Image
        src={dark ? '/brand/legalens-lockup-dark.jpg' : '/brand/legalens-logo.png'}
        alt="LegalLens"
        width={compact ? 240 : 320}
        height={compact ? 128 : 170}
        priority={compact}
        className={`absolute inset-0 h-full w-full object-contain scale-[2.2] ${dark ? 'mix-blend-screen' : ''}`}
      />
    </Link>
  )
}
