// Signature element: a column of small citation-style annotations running down the
// page edge, echoing LegalLens's actual core principle — every claim traced to a
// source. Ambient, not interactive; hidden on small screens where space is tight and
// it would compete with content instead of framing it.
const ANNOTATIONS = [
  { mark: '§ 35', note: 'Right to personal liberty' },
  { mark: '§ 41', note: 'Right of movement' },
  { mark: 'Cap. C23', note: 'Consumer Protection' },
  { mark: '§ 254C', note: 'Labour disputes' },
  { mark: 'Art. 1999', note: 'Constitution' },
  { mark: '§ 17', note: 'Tenancy notice' },
]

export function MarginaliaRail({ side = 'left' }: { side?: 'left' | 'right' }) {
  return (
    <div
      aria-hidden="true"
      className={`hidden xl:flex flex-col justify-between fixed top-0 ${
        side === 'left' ? 'left-4' : 'right-4'
      } h-screen py-32 pointer-events-none select-none z-0`}
    >
      {ANNOTATIONS.map((a, i) => (
        <div
          key={a.mark}
          className={`text-ink-400/40 ${side === 'right' ? 'text-right' : ''}`}
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className="font-mono text-[11px] tracking-tight">{a.mark}</div>
          <div className="font-body text-[10px] italic max-w-[7rem] leading-tight">
            {a.note}
          </div>
        </div>
      ))}
    </div>
  )
}
