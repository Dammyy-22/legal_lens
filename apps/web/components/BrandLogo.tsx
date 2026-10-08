import Link from 'next/link'
import { Landmark } from 'lucide-react'

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
      className={`inline-flex shrink-0 items-center gap-2.5 rounded-md transition-opacity hover:opacity-80 focus-visible:outline-offset-4 ${dark ? 'text-paper' : 'text-ink'}`}
    >
      <span className={`flex items-center justify-center rounded-xl bg-ink text-brass-400 ${compact ? 'h-9 w-9' : 'h-11 w-11'}`}>
        <Landmark size={compact ? 19 : 22} strokeWidth={1.7} aria-hidden="true" />
      </span>
      <span className={`font-display font-semibold tracking-tight ${compact ? 'text-lg' : 'text-xl'}`}>
        LegalLens
      </span>
    </Link>
  )
}
