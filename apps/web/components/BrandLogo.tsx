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
      aria-label="LegalLens AI home"
      className={`inline-flex shrink-0 items-center transition-transform duration-300 hover:scale-[1.03] focus-visible:outline-offset-4 ${compact ? 'h-11' : 'h-12 sm:h-14'} ${dark ? 'rounded-md bg-paper/95 px-2 py-1' : ''}`}
    >
      <Image
        src="/brand/legalens-lockup.png"
        alt="LegalLens AI"
        width={394}
        height={316}
        priority
        className="h-full w-auto object-contain"
      />
    </Link>
  )
}
