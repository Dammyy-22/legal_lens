import type { LucideIcon } from 'lucide-react'
import Image from 'next/image'

// Shared honest "not built yet" state — used instead of fake data or a broken
// interactive UI for features that genuinely don't have a backend yet.
export function ComingSoonPage({
  Icon,
  title,
  description,
  detail,
}: {
  Icon: LucideIcon
  title: string
  description: string
  detail?: string
}) {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 md:py-16 text-center animate-ink-in">
      <div className="relative h-44 mb-8 overflow-hidden rounded-2xl border border-ink-100 bg-white surface-lift">
        <Image src="https://images.unsplash.com/photo-1505664194779-8beaceb93744?auto=format&fit=crop&w=1400&q=85" alt="Rows of law books in a library" fill className="object-cover image-drift opacity-80" sizes="(max-width: 768px) 100vw, 900px" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent" />
        <p className="absolute left-5 bottom-4 font-mono text-[10px] uppercase tracking-[0.2em] text-brass-400">Private workspace / in preparation</p>
      </div>
      <div className="relative w-20 h-20 rounded-2xl bg-ink flex items-center justify-center mx-auto mb-7 shadow-[0_16px_30px_rgba(20,38,30,0.18)] float-slow">
        <div className="absolute inset-2 rounded-xl border border-brass/50" />
        <Icon size={30} strokeWidth={1.5} className="text-brass-600" />
      </div>
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-brass-600 mb-3">Filed for review</p>
      <h1 className="font-display text-4xl text-ink mb-3">{title}</h1>
      <p className="text-ink-400 leading-relaxed mb-4">{description}</p>
      {detail && (
        <p className="text-sm text-ink-400 font-mono border border-ink-100 bg-white/70 rounded-lg px-4 py-3 inline-block surface-lift">
          {detail}
        </p>
      )}
    </div>
  )
}
