// Shared honest "not built yet" state — used instead of fake data or a broken
// interactive UI for features that genuinely don't have a backend yet.
export function ComingSoonPage({
  mark,
  title,
  description,
  detail,
}: {
  mark: string
  title: string
  description: string
  detail?: string
}) {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16 text-center">
      <div className="font-display text-5xl text-brass-600 mb-6" aria-hidden="true">
        {mark}
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
