import Link from 'next/link'
import {
  type LucideIcon,
  MessageCircleQuestion,
  Search,
  Landmark,
  Scale,
  UserSearch,
  FileText,
  ArrowUpRight,
} from 'lucide-react'

export default function DashboardOverview({ fullName }: { fullName: string | null }) {
  const firstName = fullName?.trim().split(' ')[0] || null

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 md:py-14">
      <div className="grid lg:grid-cols-[1fr_19rem] gap-8 items-end mb-10 animate-ink-in">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-brass-600 mb-2">
            LegalLens / source desk
          </p>
          <h1 className="font-display text-5xl leading-[1.02] text-ink mb-3 ink-rule">
            {firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
          </h1>
          <p className="text-ink-400 max-w-xl">A calm place to ask, search, and read the law with the source trail kept visible.</p>
        </div>
        <div className="bg-ink text-paper rounded-2xl p-5 surface-lift legal-grain">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-brass-400 mb-5">Corpus status</p>
          <div className="flex items-end justify-between">
            <span className="font-display text-4xl">07</span>
            <span className="text-xs text-paper/65 pb-1">verified source paths</span>
          </div>
          <div className="mt-4 h-1 rounded-full bg-paper/15 shimmer-line"><div className="h-full w-4/5 rounded-full bg-brass" /></div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
        <NavCard href="/dashboard/ask" Icon={MessageCircleQuestion} title="Ask a question" eyebrow="Live assistant">
          Ask about laws, rights, and procedures in Nigeria. Answers will be grounded
          and cited to real sources.
        </NavCard>
        <NavCard href="/dashboard/search" Icon={Search} title="Search the law" eyebrow="Verified corpus">
          Search Nigerian legislation and regulations with semantic understanding.
        </NavCard>
        <NavCard href="/dashboard/constitution" Icon={Landmark} title="Constitution" eyebrow="Primary source">
          Browse the Constitution of the Federal Republic of Nigeria by part and
          section.
        </NavCard>
        <NavCard href="/dashboard/rights" Icon={Scale} title="Rights explorer" eyebrow="Field guide">
          Structured guidance for common situations — police stops, tenancy, the
          workplace, and more.
        </NavCard>
        <NavCard href="/dashboard/lawyers" Icon={UserSearch} title="Find a lawyer" eyebrow="Referral desk">
          Browse legal practice areas and join the waitlist for verified lawyer
          referrals.
        </NavCard>
        <NavCard href="/dashboard/documents" Icon={FileText} title="My documents" eyebrow="Private vault" comingSoon>
          Upload your own documents and ask questions about them.
        </NavCard>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 border border-seal/25 bg-white/70 rounded-xl text-sm text-seal leading-relaxed">
        <p><strong>Important:</strong> LegalLens provides legal information, not legal advice.</p>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-seal/70">Read before relying</span>
      </div>
    </div>
  )
}

function NavCard({
  href,
  Icon,
  title,
  eyebrow,
  comingSoon,
  children,
}: {
  href: string
  Icon: LucideIcon
  title: string
  eyebrow: string
  comingSoon?: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="group relative block p-6 bg-white/90 border border-ink-100 rounded-2xl hover-lift overflow-hidden"
    >
      <div className="flex items-start justify-between mb-7">
        <div className="w-11 h-11 rounded-xl bg-paper flex items-center justify-center group-hover:bg-ink transition-colors">
          <Icon size={20} strokeWidth={1.75} className="text-brass-600 group-hover:text-brass-400 transition-colors" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide font-mono text-ink-400">{eyebrow}</span>
          {comingSoon && <span className="w-2 h-2 rounded-full bg-brass" title="Coming soon" />}
          <ArrowUpRight size={16} className="text-ink-100 group-hover:text-brass-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
        </div>
      </div>
      <h3 className="font-display text-2xl text-ink mb-2">{title}</h3>
      <p className="text-ink-400 text-sm leading-relaxed">{children}</p>
      <div className="mt-7 h-px bg-ink-100 group-hover:bg-brass/60 transition-colors" />
    </Link>
  )
}
