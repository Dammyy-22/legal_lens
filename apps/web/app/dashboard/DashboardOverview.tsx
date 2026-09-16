'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  type LucideIcon,
  MessageCircleQuestion,
  Search,
  Landmark,
  Scale,
  UserSearch,
  FileText,
  ArrowUpRight,
  ArrowRight,
  Clock3,
  Copy,
  FileSearch,
  Sparkles,
  UploadCloud,
} from 'lucide-react'

export default function DashboardOverview({ fullName }: { fullName: string | null }) {
  const firstName = fullName?.trim().split(' ')[0] || null
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null)

  const promptIdeas = [
    'What are my rights if my landlord refuses to return my caution fee?',
    'Explain the right to fair hearing in simple language.',
    'What should I do after receiving a demand letter?',
  ]

  async function copyPrompt(prompt: string) {
    await navigator.clipboard?.writeText(prompt)
    setCopiedPrompt(prompt)
    window.setTimeout(() => setCopiedPrompt(null), 1600)
  }

  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-6 py-8 md:py-12">
      <div className="grid lg:grid-cols-[1fr_19rem] gap-8 items-end mb-8 animate-ink-in">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-brass-600 mb-2">
            LegalLens / workspace
          </p>
          <h1 className="font-display text-5xl leading-[1.02] text-ink mb-3 ink-rule">
            {firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
          </h1>
          <p className="text-ink-400 max-w-xl">Research, understand, and act on Nigerian law with the source trail kept visible at every step.</p>
        </div>
        <div className="bg-ink text-paper rounded-2xl p-5 surface-lift legal-grain">
          <div className="flex items-center justify-between mb-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-brass-400">Corpus status</p>
            <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-emerald-200"><span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" /> Live</span>
          </div>
          <div className="flex items-end justify-between">
            <span className="font-display text-4xl">07</span>
            <span className="text-xs text-paper/65 pb-1">verified source paths</span>
          </div>
          <div className="mt-4 h-1 rounded-full bg-paper/15 shimmer-line"><div className="h-full w-4/5 rounded-full bg-brass" /></div>
        </div>
      </div>

      <section className="relative overflow-hidden rounded-2xl bg-ink text-paper p-6 md:p-8 mb-8 surface-lift legal-grain animate-ink-in [animation-delay:100ms]">
        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-2 text-brass-400 font-mono text-[10px] uppercase tracking-[0.2em] mb-4"><Sparkles size={14} /> Start with a question</div>
          <h2 className="font-display text-3xl md:text-4xl leading-tight mb-3">Turn a confusing legal problem into a clear next step.</h2>
          <p className="text-paper/65 leading-relaxed mb-6">Ask in everyday language. LegalLens will search the verified corpus and show the passages behind the answer.</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard/ask" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brass text-ink font-medium hover:bg-brass-400 transition-colors">Open legal assistant <ArrowRight size={16} /></Link>
            <Link href="/dashboard/search" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-paper/20 text-paper hover:bg-paper/10 transition-colors">Browse sources <Search size={16} /></Link>
          </div>
        </div>
        <div className="absolute -right-16 -bottom-28 w-72 h-72 rounded-full border border-brass/30" />
        <div className="absolute right-12 -bottom-36 w-72 h-72 rounded-full border border-brass/15" />
      </section>

      <section className="grid md:grid-cols-[0.9fr_1.1fr] gap-6 mb-8 animate-ink-in [animation-delay:125ms]">
        <div className="relative min-h-[210px] overflow-hidden rounded-2xl border border-ink-100 bg-white surface-lift">
          <Image src="https://images.unsplash.com/photo-1505664194779-8beaceb93744?auto=format&fit=crop&w=1400&q=85" alt="Rows of law books in a library" fill className="object-cover image-drift" sizes="(max-width: 768px) 100vw, 600px" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/75 via-transparent to-transparent" />
          <div className="absolute bottom-5 left-5 right-5"><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brass-400">Source archive</p><p className="font-display text-2xl text-paper mt-1">Your research starts with evidence.</p></div>
        </div>
        <div className="p-6 rounded-2xl border border-ink-100 bg-white/70 flex flex-col justify-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brass-600 mb-2">A better legal workflow</p>
          <h2 className="font-display text-3xl text-ink mb-3">Research, explain, then decide.</h2>
          <p className="text-ink-400 leading-relaxed mb-5">Use the assistant for orientation, the search desk for verification, and the Constitution reader when you need the primary text in view.</p>
          <div className="flex flex-wrap gap-2"><span className="px-3 py-1.5 rounded-full bg-paper text-xs font-mono text-ink-400">01 Ask</span><span className="px-3 py-1.5 rounded-full bg-paper text-xs font-mono text-ink-400">02 Verify</span><span className="px-3 py-1.5 rounded-full bg-brass/15 text-xs font-mono text-brass-600">03 Act carefully</span></div>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-2xl min-h-[190px] mb-8 border border-ink-100 surface-lift image-reveal">
        <Image
          src="https://images.unsplash.com/photo-1505664194779-8beaceb93744?auto=format&fit=crop&w=1600&q=85"
          alt="Rows of law books in a library"
          fill
          className="object-cover image-drift"
          sizes="(max-width: 768px) 100vw, 1200px"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/55 to-transparent" />
        <div className="relative z-10 max-w-lg px-6 py-8 md:px-8 md:py-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brass-400 mb-2">Research note</p>
          <h2 className="font-display text-3xl text-paper mb-2">Keep the context. Lose the clutter.</h2>
          <p className="text-paper/70 leading-relaxed text-sm">Move between questions, primary sources, and practical guidance without losing the thread of your research.</p>
        </div>
      </section>

      <div className="grid lg:grid-cols-[1.4fr_0.9fr] gap-6 mb-8">
        <section className="bg-white/90 border border-ink-100 rounded-2xl p-6 animate-ink-in [animation-delay:150ms]">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brass-600 mb-2">Prompt library</p>
              <h2 className="font-display text-2xl text-ink">Good questions to start with</h2>
            </div>
            <FileSearch size={22} className="text-brass-600" />
          </div>
          <div className="space-y-2">
            {promptIdeas.map((prompt) => (
              <div key={prompt} className="group flex items-center gap-3 p-3 rounded-xl border border-ink-100 hover:border-brass/50 hover:bg-paper transition-colors">
                <Link href={`/dashboard/ask?prompt=${encodeURIComponent(prompt)}`} className="flex-1 text-sm text-ink-400 group-hover:text-ink leading-relaxed">{prompt}</Link>
                <button type="button" onClick={() => copyPrompt(prompt)} className="shrink-0 p-2 text-ink-100 hover:text-brass-600 transition-colors" title="Copy prompt" aria-label="Copy prompt">
                  {copiedPrompt === prompt ? <span className="text-[10px] font-mono text-brass-600">Copied</span> : <Copy size={15} />}
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-paper-200/60 border border-ink-100 rounded-2xl p-6 animate-ink-in [animation-delay:200ms]">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brass-600 mb-2">Recent work</p>
              <h2 className="font-display text-2xl text-ink">Pick up where you left off</h2>
            </div>
            <Clock3 size={22} className="text-brass-600" />
          </div>
          <div className="space-y-4">
            <Link href="/dashboard/ask" className="flex items-center gap-3 group">
              <span className="w-9 h-9 rounded-lg bg-white flex items-center justify-center text-brass-600"><MessageCircleQuestion size={17} /></span>
              <span className="flex-1"><span className="block text-sm font-medium text-ink group-hover:text-brass-600 transition-colors">Ask your first question</span><span className="block text-xs text-ink-400 mt-0.5">Legal assistant</span></span>
              <ArrowUpRight size={15} className="text-ink-100 group-hover:text-brass-600" />
            </Link>
            <Link href="/dashboard/constitution" className="flex items-center gap-3 group">
              <span className="w-9 h-9 rounded-lg bg-white flex items-center justify-center text-brass-600"><Landmark size={17} /></span>
              <span className="flex-1"><span className="block text-sm font-medium text-ink group-hover:text-brass-600 transition-colors">Read the Constitution</span><span className="block text-xs text-ink-400 mt-0.5">Primary source</span></span>
              <ArrowUpRight size={15} className="text-ink-100 group-hover:text-brass-600" />
            </Link>
          </div>
        </section>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
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
          Prepare a document workspace for clause review, summaries, and page-level citations.
        </NavCard>
      </div>

      <section className="grid md:grid-cols-[1fr_auto] items-center gap-5 p-5 md:p-6 border border-dashed border-brass/50 bg-white/55 rounded-2xl mb-8">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-brass/10 flex items-center justify-center text-brass-600 shrink-0"><UploadCloud size={21} /></div>
          <div><p className="font-display text-xl text-ink mb-1">Have a document to understand?</p><p className="text-sm text-ink-400 leading-relaxed">The private document vault is being prepared for secure uploads and exact clause references.</p></div>
        </div>
        <Link href="/dashboard/documents" className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-ink-100 text-ink text-sm font-medium hover:bg-paper transition-colors">View document vault <ArrowRight size={15} /></Link>
      </section>

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
