import type { LucideIcon } from 'lucide-react'

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
    <div className="max-w-2xl mx-auto px-6 py-16 text-center">
      <div className="w-16 h-16 rounded-xl bg-brass/10 flex items-center justify-center mx-auto mb-6">
        <Icon size={30} strokeWidth={1.5} className="text-brass-600" />
      </div>
      <h1 className="font-display text-3xl text-ink mb-3">{title}</h1>
      <p className="text-ink-400 leading-relaxed mb-4">{description}</p>
      {detail && (
        <p className="text-sm text-ink-100 font-mono border border-ink-100 rounded-lg px-4 py-3 inline-block">
          {detail}
        </p>
      )}
    </div>
  )
}
