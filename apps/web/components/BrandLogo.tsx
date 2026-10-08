import Link from 'next/link'
import Image from 'next/image'

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
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden transition-transform duration-300 hover:scale-[1.03] focus-visible:outline-offset-4 ${compact ? 'h-12 w-24' : 'h-14 w-28'} ${dark ? 'px-1 py-0.5' : ''}`}
    >
      <Image
        src="/brand/legalens-original.png"
        alt="LegalLens"
        fill
        priority
        sizes={compact ? '96px' : '112px'}
        className="object-cover"
      />
    </Link>
  )
}
