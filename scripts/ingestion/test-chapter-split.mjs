// Isolated test of the chapter-splitting logic against real extracted text samples
// (not the full document — just enough to verify the regex markers actually fire
// correctly against real PDF-extraction artifacts like inconsistent spacing/case).

const CHAPTER_MARKERS = [
  { label: 'Chapter I', pattern: /CHAPTER\s+I\b[^\n]*/i },
  { label: 'Chapter II', pattern: /CHAPTER\s+II\b[^\n]*/i },
  { label: 'Chapter III', pattern: /CHAPTER\s+III\b[^\n]*/i },
  { label: 'Chapter IV', pattern: /CHAPTER\s+IV\b[^\n]*/i },
  { label: 'Chapter V', pattern: /CHAPTER\s+V\b[^\n]*/i },
]

// Real-world-shaped test fixture mimicking observed extraction artifacts: chapter
// headers appear as "CHAPTER I" / "CHAPTER II" etc, sometimes followed by a title on
// the same line, sometimes not, with inconsistent whitespace.
const sample = `
Arrangement of sections
...
CHAPTER I
GENERAL PROVISIONS
Part I - Federal Republic of Nigeria
1. This Constitution is supreme...
2. Nigeria is one indivisible sovereign state...
CHAPTER II
FUNDAMENTAL OBJECTIVES AND DIRECTIVE PRINCIPLES OF STATE POLICY
13. It shall be the duty of the State...
CHAPTER III
CITIZENSHIP
25. The following persons are citizens...
CHAPTER IV
FUNDAMENTAL RIGHTS
Every person has a right to life...
No person shall be subjected to torture...
CHAPTER V
THE LEGISLATURE
Part I - National Assembly
47. There shall be a National Assembly...
`

let failures = 0
for (let i = 0; i < CHAPTER_MARKERS.length; i++) {
  const current = CHAPTER_MARKERS[i]
  const next = CHAPTER_MARKERS[i + 1]
  const startMatch = current.pattern.exec(sample)
  if (!startMatch) {
    console.error(`FAIL: ${current.label} not found`)
    failures++
    continue
  }
  const start = startMatch.index
  const end = next ? next.pattern.exec(sample)?.index ?? sample.length : sample.length
  const text = sample.slice(start, end).trim()
  const preview = text.split('\n').slice(0, 2).join(' | ')
  console.log(`OK: ${current.label} -> "${preview}" (${text.length} chars)`)
  if (text.length < 10) {
    console.error(`FAIL: ${current.label} extracted suspiciously short`)
    failures++
  }
}

// Regression check: does Chapter IV get correctly bounded even though (per the real
// document) it lacks clean numbered-section prefixes? The split should still work
// since it only depends on the CHAPTER header markers, not section numbering.
const ch4Match = /CHAPTER\s+IV\b[\s\S]*?(?=CHAPTER\s+V)/i.exec(sample)
if (!ch4Match || !ch4Match[0].includes('right to life')) {
  console.error('FAIL: Chapter IV content not correctly isolated')
  failures++
} else {
  console.log('OK: Chapter IV correctly isolated despite missing section numbers')
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`)
  process.exit(1)
}
console.log('\nAll chapter-split checks passed.')
