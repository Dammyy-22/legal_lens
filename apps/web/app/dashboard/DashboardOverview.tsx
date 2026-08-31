import Link from 'next/link'
import {
  type LucideIcon,
  MessageCircleQuestion,
  Search,
  Landmark,
  Scale,
  UserSearch,
  FileText,
} from 'lucide-react'

export default function DashboardOverview({ fullName }: { fullName: string | null }) {
  const firstName = fullName?.trim().split(' ')[0] || null

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 md:py-14">
      <div className="mb-10 animate-ink-in">
        <p className="font-mono text-xs uppercase tracking-widest text-brass-600 mb-2">
          Dashboard
        </p>
        <h1 className="font-display text-4xl text-ink mb-2">
          {firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
        </h1>
        <p className="text-ink-400">Here&apos;s what you can do on LegalLens.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-14">
        <NavCard href="/dashboard/ask" Icon={MessageCircleQuestion} title="Ask a question" comingSoon>
          Ask about laws, rights, and procedures in Nigeria. Answers will be grounded
          and cited to real sources.
        </NavCard>
        <NavCard href="/dashboard/search" Icon={Search} title="Search the law" comingSoon>
          Search Nigerian legislation and regulations with semantic understanding.
        </NavCard>
        <NavCard href="/dashboard/constitution" Icon={Landmark} title="Constitution">
          Browse the Constitution of the Federal Republic of Nigeria by part and
          section.
        </NavCard>
        <NavCard href="/dashboard/rights" Icon={Scale} title="Rights explorer">
          Structured guidance for common situations — police stops, tenancy, the
          workplace, and more.
        </NavCard>
        <NavCard href="/dashboard/lawyers" Icon={UserSearch} title="Find a lawyer">
          Browse legal practice areas and join the waitlist for verified lawyer
          referrals.
        </NavCard>
        <NavCard href="/dashboard/documents" Icon={FileText} title="My documents" comingSoon>
          Upload your own documents and ask questions about them.
        </NavCard>
      </div>

      <div className="p-5 border border-seal/25 bg-seal/5 rounded-lg text-sm text-seal leading-relaxed">
        <strong>Important:</strong> LegalLens is an AI-powered legal information tool
        for educational purposes. It is not a lawyer and does not provide legal advice.
        Always consult a qualified attorney for matters affecting your rights or
        obligations.
      </div>
    </div>
  )
}

function NavCard({
  href,
  Icon,
  title,
  comingSoon,
  children,
}: {
  href: string
  Icon: LucideIcon
  title: string
  comingSoon?: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="block p-6 bg-white border border-ink-100 rounded-lg hover:border-brass/40 transition-colors"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-lg bg-brass/10 flex items-center justify-center">
          <Icon size={20} strokeWidth={1.75} className="text-brass-600" />
        </div>
        {comingSoon && (
          <span className="text-[10px] uppercase tracking-wide font-mono text-ink-400 border border-ink-100 rounded-full px-2 py-0.5">
            Coming soon
          </span>
        )}
      </div>
      <h3 className="font-display text-lg text-ink mb-2">{title}</h3>
      <p className="text-ink-400 text-sm leading-relaxed">{children}</p>
    </Link>
  )
}
