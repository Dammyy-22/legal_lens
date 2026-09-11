import {
  ShieldAlert,
  Home,
  Briefcase,
  ShoppingBag,
  Stethoscope,
  Scale,
} from 'lucide-react'
import Image from 'next/image'

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
    <div className="max-w-5xl mx-auto px-6 py-10 md:py-14 animate-ink-in">
      <p className="font-mono text-xs uppercase tracking-widest text-brass-600 mb-2">
        Rights explorer
      </p>
      <h1 className="font-display text-5xl text-ink mb-3 ink-rule">Common situations</h1>
      <p className="text-ink-400 leading-relaxed mb-10 max-w-2xl">
        Structured, plain-language guidance for situations people actually run into —
        each one grounded in a verified legal source once the underlying content is
        ready. None of these are populated yet.
      </p>

      <div className="relative h-44 md:h-56 mb-10 overflow-hidden rounded-2xl surface-lift border border-ink-100">
        <Image src="/brand/rights-archive.svg" alt="Illustration of a courthouse and scales of justice" fill className="object-cover" priority />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/70 via-ink/20 to-transparent" />
        <p className="absolute left-6 bottom-5 max-w-xs font-display text-xl text-paper">A field guide for the moments when procedure matters.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {SITUATIONS.map(({ Icon, title, note }) => (
          <div key={title} className="group p-6 bg-white/90 border border-ink-100 rounded-2xl opacity-80 hover:opacity-100 hover-lift">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-brass/10 flex items-center justify-center group-hover:bg-ink transition-colors">
                <Icon size={20} strokeWidth={1.75} className="text-brass-600 group-hover:text-brass-400 transition-colors" />
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
