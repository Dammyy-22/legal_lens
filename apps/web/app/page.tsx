import Link from 'next/link'
import Image from 'next/image'
import { MessageSquareQuote, ShieldCheck, Gavel, type LucideIcon } from 'lucide-react'
import { MarginaliaRail } from '@/components/MarginaliaRail'
import { BrandLogo } from '@/components/BrandLogo'

export default function Home() {
  return (
    <main className="relative min-h-screen bg-paper legal-grid text-charcoal overflow-x-hidden">
      <MarginaliaRail side="left" />
      <MarginaliaRail side="right" />

      <nav className="relative z-10 border-b border-ink-100 bg-paper/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-5 flex justify-between items-center">
          <BrandLogo />
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
      <section className="relative z-10 max-w-6xl mx-auto px-6 pt-20 pb-24 grid md:grid-cols-[1.05fr_0.95fr] gap-12 items-center">
        <div className="animate-ink-in">
          <p className="font-mono text-xs uppercase tracking-widest text-brass-600 mb-4">
            Nigeria · Legal Information
          </p>
          <h1 className="font-display text-5xl md:text-7xl leading-[0.98] text-ink mb-6">
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
              className="px-6 py-3 rounded bg-ink text-paper font-medium shadow-[0_12px_24px_rgba(20,38,30,0.16)] hover:bg-ink-600 hover:-translate-y-0.5 transition-all"
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

        <div className="relative animate-ink-in [animation-delay:150ms] float-slow">
          <div className="relative min-h-[420px] overflow-hidden rounded-[2rem] border border-ink-100/60 shadow-[0_22px_60px_rgba(20,38,30,0.18)] image-reveal">
            <Image
              src="https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1200&q=85"
              alt="Courthouse columns in warm afternoon light"
              fill
              priority
              className="object-cover image-drift"
              sizes="(max-width: 768px) 80vw, 38vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-7">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brass-400">Nigeria / legal clarity</p>
              <p className="font-display text-3xl text-paper mt-2">Start with what matters.</p>
            </div>
          </div>
          <div className="absolute -right-1 top-12 z-20 px-3 py-2 rounded-lg bg-paper/90 border border-brass/40 shadow-lg font-mono text-[10px] uppercase tracking-widest text-brass-600 animate-float-note">Source verified</div>
        </div>
      </section>

      {/* What it does — not a numbered sequence, since these run in parallel, not order */}
      <section className="relative z-10 bg-white/85 backdrop-blur border-y border-ink-100">
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

      <section id="about" className="relative z-10 max-w-6xl mx-auto px-6 py-20 grid lg:grid-cols-[0.85fr_1.15fr] gap-10 items-center">
        <div className="relative min-h-[280px] overflow-hidden rounded-2xl border border-ink-100 bg-ink surface-lift">
          <Image
            src="https://images.unsplash.com/photo-1505664194779-8beaceb93744?auto=format&fit=crop&w=1400&q=85"
            alt="Rows of law books in a library"
            fill
            className="object-cover image-drift"
            sizes="(max-width: 768px) 100vw, 600px"
          />
          <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-ink via-ink/75 to-transparent">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brass-400">The source desk</p>
            <p className="font-display text-2xl text-paper mt-1">Read the law with the paper trail intact.</p>
          </div>
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-brass-600 mb-3">Built for confidence</p>
          <h2 className="font-display text-4xl md:text-5xl leading-tight text-ink mb-5">From first question to next action.</h2>
          <p className="text-ink-400 leading-relaxed max-w-xl mb-7">LegalLens brings research, plain-language explanation, and practical orientation into one calm workspace. Explore a source, ask a follow-up, and keep the citation close.</p>
          <div className="grid sm:grid-cols-2 gap-3 text-sm text-ink">
            <div className="p-4 rounded-xl bg-paper border border-ink-100"><span className="block font-display text-lg mb-1">Plain language</span><span className="text-ink-400">No statute-index vocabulary required.</span></div>
            <div className="p-4 rounded-xl bg-paper border border-ink-100"><span className="block font-display text-lg mb-1">Source first</span><span className="text-ink-400">Verified passages stay visible.</span></div>
          </div>
        </div>
      </section>

      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-20">
        <div className="relative overflow-hidden rounded-2xl min-h-[240px] border border-ink-100 surface-lift image-reveal">
          <Image
            src="https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1800&q=85"
            alt="Columns of a courthouse in warm afternoon light"
            fill
            className="object-cover image-drift"
            sizes="(max-width: 768px) 100vw, 1200px"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/55 to-ink/10" />
          <div className="relative z-10 max-w-xl px-6 py-10 md:px-10 md:py-14">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brass-400 mb-3">A calmer way to begin</p>
            <h2 className="font-display text-3xl md:text-4xl text-paper leading-tight mb-3">Legal clarity should feel close, not intimidating.</h2>
            <p className="text-paper/70 leading-relaxed">Start with the question you actually have. LegalLens helps you understand the terrain before you decide what to do next.</p>
          </div>
        </div>
      </section>

      {/* Disclaimer, styled as a stamp — honest tone, not fear-based */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 py-20 text-center animate-ink-in">
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
          <BrandLogo compact />
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
    <div className="group hover-lift p-5 rounded-2xl border border-transparent hover:border-ink-100 hover:bg-paper/50">
      <div className="w-11 h-11 rounded-lg bg-brass/10 flex items-center justify-center mb-4 group-hover:bg-ink transition-colors">
        <Icon size={22} strokeWidth={1.75} className="text-brass-600 group-hover:text-brass-400 transition-colors" />
      </div>
      <h3 className="font-display text-xl text-ink mb-2">{title}</h3>
      <p className="text-ink-400 leading-relaxed">{body}</p>
    </div>
  )
}
