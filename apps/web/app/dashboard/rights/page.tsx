import {
  ShieldAlert,
  Home,
  Briefcase,
  ShoppingBag,
  Stethoscope,
  Scale,
} from 'lucide-react'

const SITUATIONS = [
  { Icon: ShieldAlert, title: 'Stopped by police', note: 'Traffic stops, ID checks, searches' },
  { Icon: Home, title: 'Tenant & landlord', note: 'Notices, deposits, evictions' },
  { Icon: Briefcase, title: 'The workplace', note: 'Termination, wages, disputes' },
  { Icon: ShoppingBag, title: 'Consumer rights', note: 'Refunds, faulty goods, contracts' },
  { Icon: Stethoscope, title: 'Arrest & detention', note: 'Rights during and after arrest' },
  { Icon: Scale, title: 'Civil procedure', note: 'Small claims, filing a case' },
]

export default function RightsPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-10 md:py-14">
      <p className="font-mono text-xs uppercase tracking-widest text-brass-600 mb-2">
        Rights explorer
      </p>
      <h1 className="font-display text-4xl text-ink mb-3">Common situations</h1>
      <p className="text-ink-400 leading-relaxed mb-10 max-w-2xl">
        Structured, plain-language guidance for situations people actually run into —
        each one grounded in a verified legal source once the underlying content is
        ready. None of these are populated yet.
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {SITUATIONS.map(({ Icon, title, note }) => (
          <div key={title} className="p-6 bg-white border border-ink-100 rounded-lg opacity-70">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-brass/10 flex items-center justify-center">
                <Icon size={20} strokeWidth={1.75} className="text-brass-600" />
              </div>
              <span className="text-[10px] uppercase tracking-wide font-mono text-ink-400 border border-ink-100 rounded-full px-2 py-0.5">
                Coming soon
              </span>
            </div>
            <h3 className="font-display text-lg text-ink mb-1">{title}</h3>
            <p className="text-ink-400 text-sm">{note}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
