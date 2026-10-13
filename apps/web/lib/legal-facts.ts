export type LegalFact = {
  title: string
  detail: string
  source: string
  section: string
  illustration: 'life' | 'arrest' | 'silence' | 'fairness' | 'marriage' | 'welfare' | 'protection' | 'unity'
}

const LEGAL_FACTS: LegalFact[] = [
  {
    title: 'The Constitution protects the right to life.',
    detail: 'Section 33 says every person has a right to life and sets out limited circumstances in which a death is not treated as a contravention of that section.',
    source: 'Constitution of the Federal Republic of Nigeria 1999',
    section: 'Section 33',
    illustration: 'life',
  },
  {
    title: 'An arrested person has a right to know the grounds.',
    detail: 'Section 35(3) requires the facts and grounds of an arrest or detention to be given in writing within 24 hours, in a language the person understands.',
    source: 'Constitution of the Federal Republic of Nigeria 1999',
    section: 'Section 35(3)',
    illustration: 'arrest',
  },
  {
    title: 'The Constitution recognizes a right to silence after arrest.',
    detail: 'Section 35(2) says an arrested or detained person may remain silent or avoid answering questions until after consulting a legal practitioner or another person of their choice.',
    source: 'Constitution of the Federal Republic of Nigeria 1999',
    section: 'Section 35(2)',
    illustration: 'silence',
  },
  {
    title: 'The Constitution addresses repeated criminal trials.',
    detail: 'Section 36(9) generally protects someone already convicted or acquitted by a competent court from another trial for the same offence or one with the same ingredients, subject to the stated exception.',
    source: 'Constitution of the Federal Republic of Nigeria 1999',
    section: 'Section 36(9)',
    illustration: 'fairness',
  },
  {
    title: 'The Constitution directs the State to encourage inter-marriage.',
    detail: 'Section 15(3)(c) includes encouraging inter-marriage among people of different places of origin or different religious, ethnic, or linguistic associations among the State’s objectives.',
    source: 'Constitution of the Federal Republic of Nigeria 1999',
    section: 'Section 15(3)(c)',
    illustration: 'marriage',
  },
  {
    title: 'Security and welfare are described as government’s primary purpose.',
    detail: 'Section 14(2)(b) states that the security and welfare of the people shall be the primary purpose of government.',
    source: 'Constitution of the Federal Republic of Nigeria 1999',
    section: 'Section 14(2)(b)',
    illustration: 'welfare',
  },
  {
    title: 'The Constitution expressly prohibits torture and degrading treatment.',
    detail: 'Section 34(1)(a) says no person shall be subject to torture or to inhuman or degrading treatment.',
    source: 'Constitution of the Federal Republic of Nigeria 1999',
    section: 'Section 34(1)(a)',
    illustration: 'protection',
  },
  {
    title: 'The Constitution includes a federal-character principle.',
    detail: 'Section 14(3) says the composition of the Federal Government and its agencies should reflect Nigeria’s federal character and avoid predominance by people from a few States or groups.',
    source: 'Constitution of the Federal Republic of Nigeria 1999',
    section: 'Section 14(3)',
    illustration: 'unity',
  },
]

export function getLegalFactsForToday(date = new Date()): LegalFact[] {
  const dayKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
  const dayNumber = Number(dayKey.replace(/-/g, ''))
  const firstFactIndex = dayNumber % LEGAL_FACTS.length

  return Array.from({ length: 3 }, (_, offset) =>
    LEGAL_FACTS[(firstFactIndex + offset) % LEGAL_FACTS.length],
  )
}

export function getLegalFactForToday(date = new Date()): LegalFact {
  return getLegalFactsForToday(date)[0]
}
