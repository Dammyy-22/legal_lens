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
      className={`relative inline-flex shrink-0 items-center justify-center transition-transform hover:-translate-y-0.5 ${compact ? 'h-10 w-28' : 'h-16 w-40'} ${dark ? 'rounded-lg bg-paper px-2 py-1' : ''}`}
    >
      <Image
        src="/brand/legalens-ai.png"
        alt="LegalLens AI"
        width={compact ? 224 : 288}
        height={compact ? 112 : 144}
        priority
        sizes={compact ? '112px' : '160px'}
        className="h-full w-full object-contain scale-[2.05]"
      />
    </Link>
  )
}
