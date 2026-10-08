import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  ArrowUpRight,
  BookOpenText,
  Landmark,
  MessageSquareText,
  ShieldCheck,
  UserRoundSearch,
} from 'lucide-react'
import { BrandLogo } from '@/components/BrandLogo'

const FEATURES = [
  {
    Icon: MessageSquareText,
    title: 'Start with your question',
    body: 'Describe a legal issue in everyday language and get a clear, source-led explanation.',
  },
  {
    Icon: BookOpenText,
    title: 'Read the law itself',
    body: 'Search published legal text and explore the Constitution by chapter and section.',
  },
  {
    Icon: UserRoundSearch,
    title: 'Find the right next step',
    body: 'Use practical guides and official channels when you need help beyond legal research.',
  },
]

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-paper text-ink">
      <header className="relative z-10 border-b border-ink-100/80 bg-white/85 backdrop-blur">
        <nav
          aria-label="Main navigation"
          className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8"
        >
          <BrandLogo />
          <div className="flex items-center gap-3 sm:gap-6">
            <Link
              href="/auth/login"
              className="rounded-md px-3 py-2 text-sm font-medium text-ink-400 transition-colors hover:text-ink"
            >
              Sign in
            </Link>
            <Link
              href="/auth/register"
              className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-ink-600"
            >
              Create account <ArrowRight size={16} />
            </Link>
          </div>
        </nav>
      </header>

      <section className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 pb-16 pt-16 sm:px-8 sm:pb-20 sm:pt-24 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16 lg:pt-28">
        <div className="motion-enter relative z-10">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-brass/30 bg-white/80 px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-brass-600">
            <Landmark size={14} /> Nigerian legal information
          </p>
          <h1 className="max-w-3xl font-display text-[2.8rem] font-medium leading-[1.04] tracking-[-0.045em] text-ink sm:text-6xl lg:text-[4.35rem]">
            Understand the law.
            <span className="block text-brass-600">See the source.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-ink-400 sm:text-lg sm:leading-8">
            Get clear explanations of Nigerian law, explore primary sources, and
            know when to seek professional legal help.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/auth/register"
              className="inline-flex items-center gap-2 rounded-lg bg-ink px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(20,38,30,0.14)] transition-all hover:-translate-y-0.5 hover:bg-ink-600"
            >
              Get started <ArrowRight size={16} />
            </Link>
            <Link
              href="/auth/login"
              className="rounded-lg border border-ink-100 bg-white px-5 py-3 text-sm font-semibold text-ink transition-colors hover:border-ink-400"
            >
              Sign in
            </Link>
          </div>
          <div className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-ink-400">
            <span className="inline-flex items-center gap-2"><ShieldCheck size={15} className="text-brass-600" /> Sources kept in view</span>
            <span className="inline-flex items-center gap-2"><BookOpenText size={15} className="text-brass-600" /> Built around Nigerian law</span>
          </div>
        </div>

        <div className="motion-enter-delayed relative mx-auto w-full max-w-[34rem] lg:ml-auto">
          <div className="ambient-orbit absolute -right-12 -top-12 h-48 w-48 rounded-full bg-brass/15 blur-3xl" />
          <div className="image-card group relative overflow-hidden rounded-[1.75rem] border border-ink/10 bg-ink p-3 shadow-[0_28px_80px_rgba(20,38,30,0.18)]">
            <div className="relative aspect-[1.26] overflow-hidden rounded-[1.25rem] bg-ink">
              <Image
                src="https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=2400&q=90"
                alt="Courthouse columns in warm afternoon light"
                fill
                priority
                quality={90}
                sizes="(max-width: 1024px) 90vw, 42vw"
                className="motion-image object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/55 via-transparent to-transparent" />
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-4 text-paper">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-brass-400">Research with context</p>
                <p className="mt-1 font-display text-lg">From question to primary text</p>
              </div>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-paper/20 text-brass-400">
                <ArrowUpRight size={19} />
              </span>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="border-y border-ink-100 bg-white">
        <div className="mx-auto grid max-w-7xl gap-2 px-5 py-7 sm:grid-cols-3 sm:gap-8 sm:px-8 sm:py-10">
          {FEATURES.map(({ Icon, title, body }) => (
            <article key={title} className="motion-enter flex gap-4 rounded-xl p-4 sm:p-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-paper text-brass-600">
                <Icon size={20} strokeWidth={1.8} />
              </span>
              <div>
                <h2 className="font-display text-lg font-medium tracking-tight text-ink">{title}</h2>
                <p className="mt-1.5 text-sm leading-6 text-ink-400">{body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="about" className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-brass-600">A considered way to begin</p>
          <h2 className="mt-3 font-display text-3xl font-medium leading-tight tracking-[-0.035em] text-ink sm:text-4xl">
            Clear information. Better-informed next steps.
          </h2>
          <p className="mt-4 max-w-lg leading-7 text-ink-400">
            LegalLens is a starting point for understanding, not a substitute
            for advice from a qualified lawyer. See what a source says, check its
            context, then decide what support you need.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="image-card group relative min-h-56 overflow-hidden rounded-2xl border border-ink-100 bg-ink p-5 text-white shadow-sm sm:p-6">
            <Image
              src="https://images.unsplash.com/photo-1505664194779-8beaceb93744?auto=format&fit=crop&w=2000&q=90"
              alt="Law books in a legal library"
              fill
              quality={90}
              sizes="(max-width: 640px) 90vw, 420px"
              className="motion-image object-cover opacity-50"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/45 to-ink/10" />
            <div className="relative z-10 flex h-full min-h-48 flex-col justify-end">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-ink/40 text-brass-400"><BookOpenText size={20} /></span>
              <h3 className="mt-4 font-display text-xl font-medium text-white">Source-led research</h3>
              <p className="mt-2 text-sm leading-6 text-white/75">Read the cited passage and follow links to the underlying source.</p>
            </div>
          </div>
          <div className="rounded-2xl border border-ink-100 bg-white p-5 sm:p-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brass/10 text-brass-600"><ShieldCheck size={20} /></span>
            <h3 className="mt-4 font-display text-xl font-medium text-ink">Clear limitations</h3>
            <p className="mt-2 text-sm leading-6 text-ink-400">Know when the available material is incomplete or your issue needs a lawyer.</p>
          </div>
        </div>
      </section>

      <section className="mx-5 mb-16 overflow-hidden rounded-2xl bg-ink text-paper sm:mx-8 lg:mx-auto lg:mb-20 lg:max-w-7xl">
        <div className="flex flex-col items-start justify-between gap-7 px-6 py-8 sm:px-10 sm:py-10 md:flex-row md:items-center">
          <div className="max-w-2xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-brass-400">Start with what you need to know</p>
            <h2 className="mt-2 font-display text-2xl font-medium tracking-tight sm:text-3xl">A more approachable way to explore Nigerian law.</h2>
          </div>
          <Link
            href="/auth/register"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-brass px-5 py-3 text-sm font-semibold text-ink transition-colors hover:bg-brass-400"
          >
            Create account <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <footer className="border-t border-ink-100 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <BrandLogo compact />
          <p className="max-w-2xl text-xs leading-5 text-ink-400">
            LegalLens provides legal information, not legal advice. For advice
            about your situation, consult a qualified Nigerian lawyer.
          </p>
        </div>
      </footer>
    </main>
  )
}
