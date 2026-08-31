import Link from 'next/link'
import { MessageSquareQuote, ShieldCheck, Gavel, type LucideIcon } from 'lucide-react'
import { MarginaliaRail } from '@/components/MarginaliaRail'
import { StatuteIllustration } from '@/components/StatuteIllustration'

export default function Home() {
  return (
    <main className="relative min-h-screen bg-paper text-charcoal overflow-x-hidden">
      <MarginaliaRail side="left" />
      <MarginaliaRail side="right" />

      <nav className="relative z-10 border-b border-ink-100">
        <div className="max-w-6xl mx-auto px-6 py-5 flex justify-between items-center">
          <span className="font-display font-semibold text-2xl text-ink">
            LegalLens<span className="text-brass not-italic">.</span>
          </span>
          <div className="flex items-center gap-6 text-sm font-medium">
            <Link href="/auth/login" className="text-ink-400 hover:text-ink transition-colors">
              Sign in
            </Link>
            <Link
              href="/auth/register"
              className="px-4 py-2 rounded bg-ink text-paper hover:bg-ink-600 transition-colors"
            >
              Create account
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pt-20 pb-24 grid md:grid-cols-2 gap-12 items-center">
        <div className="animate-ink-in">
          <p className="font-mono text-xs uppercase tracking-widest text-brass-600 mb-4">
            Nigeria · Legal Information
          </p>
          <h1 className="font-display text-5xl md:text-6xl leading-[1.05] text-ink mb-6">
            Know your rights,{' '}
            <span className="text-brass-600">traced to the source.</span>
          </h1>
          <p className="text-lg text-ink-400 leading-relaxed mb-8 max-w-md">
            LegalLens answers questions about Nigerian law in plain language — and shows
            you exactly which statute, section, or regulation each answer comes from.
            No source, no answer.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/auth/register"
              className="px-6 py-3 rounded bg-ink text-paper font-medium hover:bg-ink-600 transition-colors"
            >
              Get started free
            </Link>
            <Link
              href="/auth/login"
              className="px-6 py-3 rounded border border-ink-100 text-ink font-medium hover:bg-white transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>

        <div className="animate-ink-in [animation-delay:150ms]">
          <StatuteIllustration />
        </div>
      </section>

      {/* What it does — not a numbered sequence, since these run in parallel, not order */}
      <section className="relative z-10 bg-white border-y border-ink-100">
        <div className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-3 gap-10">
          <FeatureCard
            Icon={MessageSquareQuote}
            title="Ask in plain language"
            body="Ask about a workplace dispute, a landlord issue, or a traffic stop the way you'd ask a knowledgeable friend — not the way you'd search a statute index."
          />
          <FeatureCard
            Icon={ShieldCheck}
            title="See the source, always"
            body="Every answer links back to the actual Act, section, or regulation it came from. If we can't find a verified source, we say so — we don't guess."
          />
          <FeatureCard
            Icon={Gavel}
            title="Know when to escalate"
            body="LegalLens tells you plainly when a situation needs a real lawyer, rather than pretending an AI can replace one."
          />
        </div>
      </section>

      {/* Disclaimer, styled as a stamp — honest tone, not fear-based */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 py-20 text-center">
        <div className="inline-flex items-center gap-3 px-5 py-3 rounded-full border-2 border-seal/40 text-seal font-mono text-xs uppercase tracking-wider mb-6">
          Not a substitute for a lawyer
        </div>
        <p className="text-ink-400 leading-relaxed">
          LegalLens is a legal information and education tool. It helps you understand
          Nigerian laws and procedures, but it does not provide legal advice and is not
          a licensed attorney. For decisions that affect your rights, consult a
          qualified lawyer.
        </p>
      </section>

      <footer className="relative z-10 border-t border-ink-100 py-10">
        <div className="max-w-6xl mx-auto px-6 text-sm text-ink-400 flex justify-between items-center">
          <span className="font-display font-semibold">LegalLens</span>
          <span>Built for Nigeria. Grounded in real sources.</span>
        </div>
      </footer>
    </main>
  )
}

function FeatureCard({
  Icon,
  title,
  body,
}: {
  Icon: LucideIcon
  title: string
  body: string
}) {
  return (
    <div>
      <div className="w-11 h-11 rounded-lg bg-brass/10 flex items-center justify-center mb-4">
        <Icon size={22} strokeWidth={1.75} className="text-brass-600" />
      </div>
      <h3 className="font-display text-xl text-ink mb-2">{title}</h3>
      <p className="text-ink-400 leading-relaxed">{body}</p>
    </div>
  )
}
