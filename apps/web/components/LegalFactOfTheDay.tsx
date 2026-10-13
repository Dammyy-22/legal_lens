'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Pause, Play, Sparkles } from 'lucide-react'
import { LegalFactIllustration } from '@/components/LegalFactIllustration'
import { getLegalFactsForToday } from '@/lib/legal-facts'

const SLIDE_INTERVAL_MS = 7000

export function LegalFactOfTheDay() {
  const facts = getLegalFactsForToday()
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const fact = facts[activeIndex]

  useEffect(() => {
    if (isPaused) return

    const intervalId = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % facts.length)
    }, SLIDE_INTERVAL_MS)

    return () => window.clearInterval(intervalId)
  }, [facts.length, isPaused])

  useEffect(() => {
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (motionPreference.matches) setIsPaused(true)

    const updateMotionPreference = (event: MediaQueryListEvent) => {
      if (event.matches) setIsPaused(true)
    }
    motionPreference.addEventListener('change', updateMotionPreference)

    return () => motionPreference.removeEventListener('change', updateMotionPreference)
  }, [])

  const showPrevious = () => {
    setActiveIndex((index) => (index - 1 + facts.length) % facts.length)
  }

  const showNext = () => {
    setActiveIndex((index) => (index + 1) % facts.length)
  }

  return (
    <section
      aria-roledescription="carousel"
      aria-labelledby="legal-fact-heading"
      className="legal-facts-panel relative isolate overflow-hidden rounded-2xl border border-brass/25 bg-white p-6 shadow-sm sm:p-8"
    >
      <div className="legal-facts-orbit legal-facts-orbit-one" aria-hidden="true" />
      <div className="legal-facts-orbit legal-facts-orbit-two" aria-hidden="true" />

      <div className="relative">
        <header className="legal-facts-heading mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="legal-facts-sparkle flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-paper text-brass-600">
              <Sparkles size={21} strokeWidth={1.8} />
            </span>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.17em] text-brass-600">
                A fresh fact every day
              </p>
              <h2 id="legal-fact-heading" className="mt-1 font-display text-2xl font-medium leading-tight tracking-tight text-ink sm:text-3xl">
                Fun fact of the day
              </h2>
            </div>
          </div>
          <span className="legal-facts-daily-badge inline-flex w-fit items-center gap-2 rounded-full border border-brass/20 bg-paper/70 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.13em] text-brass-600">
            <span className="h-1.5 w-1.5 rounded-full bg-brass" />
            Nigerian law
          </span>
        </header>

        <div
          aria-live={isPaused ? 'polite' : 'off'}
          className="legal-fact-slide"
          key={activeIndex}
          role="group"
          aria-label={`Fact ${activeIndex + 1} of ${facts.length}`}
          aria-roledescription="slide"
        >
          <article className="legal-fact-card group relative grid min-h-64 overflow-hidden rounded-xl border border-ink-100 bg-paper/45 sm:min-h-72 sm:grid-cols-[minmax(0,1fr)_13rem]">
            <div className="legal-fact-card-glow" aria-hidden="true" />
            <div className="relative flex flex-col p-5 sm:p-7">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-brass-600">
                Fact {String(activeIndex + 1).padStart(2, '0')} <span className="text-ink-400">/ {String(facts.length).padStart(2, '0')}</span>
              </span>
              <h3 className="legal-fact-title relative mt-4 font-display text-xl font-medium leading-snug tracking-tight text-ink sm:text-2xl">
                {fact.title}
              </h3>
              <p className="relative mt-3 max-w-2xl flex-1 text-sm leading-6 text-ink-400 sm:text-base sm:leading-7">
                {fact.detail}
              </p>
              <div className="relative mt-5 border-t border-ink-100 pt-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-brass-600">
                  {fact.section}
                </p>
                <p className="mt-1 text-xs leading-5 text-ink-400">{fact.source}</p>
              </div>
            </div>
            <div className="legal-fact-artwork-wrap relative flex min-h-40 items-center justify-center overflow-hidden border-t border-ink-100 bg-gradient-to-br from-paper/30 via-paper/70 to-brass/10 sm:min-h-full sm:border-l sm:border-t-0">
              <div className="legal-fact-artwork-halo" aria-hidden="true" />
              <LegalFactIllustration fact={fact} />
            </div>
          </article>
        </div>

        <nav className="mt-4 flex items-center justify-between" aria-label="Fun fact slideshow controls">
          <div className="flex items-center gap-2">
            {facts.map((item, index) => (
              <button
                aria-current={index === activeIndex ? 'true' : undefined}
                aria-label={`Show fact ${index + 1}: ${item.title}`}
                className={`legal-fact-dot ${index === activeIndex ? 'is-active' : ''}`}
                key={item.section}
                onClick={() => setActiveIndex(index)}
                type="button"
              />
            ))}
            <span className="ml-1 font-mono text-[10px] tabular-nums text-ink-400">
              {String(activeIndex + 1).padStart(2, '0')} / {String(facts.length).padStart(2, '0')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              aria-label="Show previous fact"
              className="legal-fact-control"
              onClick={showPrevious}
              type="button"
            >
              <ChevronLeft size={17} />
            </button>
            <button
              aria-label={isPaused ? 'Play slideshow' : 'Pause slideshow'}
              className="legal-fact-control legal-fact-play"
              onClick={() => setIsPaused((paused) => !paused)}
              type="button"
            >
              {isPaused ? <Play size={15} fill="currentColor" /> : <Pause size={15} fill="currentColor" />}
            </button>
            <button
              aria-label="Show next fact"
              className="legal-fact-control"
              onClick={showNext}
              type="button"
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </nav>
      </div>
    </section>
  )
}
