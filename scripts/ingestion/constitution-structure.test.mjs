import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { extractConstitutionMainText, splitConstitutionSections } from './constitution-structure.mjs'

const fixture = `
ARRANGEMENT OF SECTIONS
CHAPTER I
General Provisions
1. Supremacy of the Constitution
CHAPTER II
Fundamental Objectives and Directive Principles of State Policy
13. Fundamental obligations
CHAPTER VIII
Federal Capital Territory, Abuja and General Supplementary Provisions
FIRST SCHEDULE
WE the people of the Federal Republic of Nigeria:
DO HEREBY MAKE, ENACT AND GIVE TO OURSELVES the following Constitution:
CHAPTER I
General Provisions
1. Supremacy of the Constitution
(1) This Constitution is supreme.
CHAPTER II
Fundamental Objectives and Directive Principles of State Policy
13. Fundamental obligations of the Government
CHAPTER III
Citizenship
25. Citizenship by birth
CHAPTER IV
Fundamental Rights
33. Right to life
CHAPTER V
The Legislature
47. There shall be a National Assembly
CHAPTER VI
The Executive
130. There shall be a President
CHAPTER VII
The Judicature
230. There shall be a Supreme Court
CHAPTER VIII
Federal Capital Territory, Abuja and General Supplementary Provisions
297. There shall be a Federal Capital Territory
Back to Page One
Schedules
FIRST SCHEDULE
State boundaries
`

test('chapter sections begin at the substantive text, not the contents list', () => {
  const sections = splitConstitutionSections(fixture)
  assert.deepEqual(sections.map(({ label }) => label), [
    'Chapter I',
    'Chapter II',
    'Chapter III',
    'Chapter IV',
    'Chapter V',
    'Chapter VI',
    'Chapter VII',
    'Chapter VIII',
    'Schedules',
  ])
  assert.match(sections[0].text, /1\. Supremacy.*\(1\) This Constitution is supreme/s)
  assert.doesNotMatch(sections[0].text, /ARRANGEMENT OF SECTIONS/)
  assert.doesNotMatch(sections[0].text, /13\. Fundamental obligations/)
  assert.match(sections[1].text, /13\. Fundamental obligations of the Government/)
  assert.doesNotMatch(sections[7].text, /FIRST SCHEDULE/)
  assert.doesNotMatch(sections[7].text, /Schedules\s*$/)
  assert.equal(sections[8].text, 'Schedules\nFIRST SCHEDULE\nState boundaries')
})

test('missing preamble or actual chapter content fails rather than returning TOC matches', () => {
  assert.throws(() => extractConstitutionMainText('ARRANGEMENT OF SECTIONS\nCHAPTER I'), /preamble/)
  assert.throws(() => splitConstitutionSections(fixture.replace('CHAPTER IV\nFundamental Rights', '')), /Chapter IV/)
})

test('all chapter labels in the extracted Constitution PDF have substantive content', async () => {
  const rawText = await readFile(
    new URL('./normalized-corpus/raw/Constitution-of-the-Federal-Republic-of-Nigeria-1999-Updated.raw.txt', import.meta.url),
    'utf8',
  )
  const sections = splitConstitutionSections(rawText)
  assert.equal(sections.length, 9)
  assert.ok(sections.slice(0, 8).every((section) => section.text.length > 1000))
  assert.match(sections[0].text, /1\.\s*Supremacy of the Constitution/i)
  assert.doesNotMatch(sections[0].text, /13\.\s*Fundamental obligations of the Government/i)
  assert.match(sections[1].text, /13\.\s*Fundamental obligations of the Government/i)
  assert.match(sections[7].text, /Federal Capital Territory/i)
  assert.doesNotMatch(sections[7].text, /^FIRST SCHEDULE/m)
  assert.doesNotMatch(sections[7].text, /Schedules\s*$/)
  assert.match(sections[8].text, /^Schedules\nFIRST SCHEDULE/im)
})

test('checked-in Constitution chunks do not mix the table of contents or schedules into chapters', async () => {
  const artifact = JSON.parse(await readFile(
    new URL('./normalized-corpus/chunks/Constitution-of-the-Federal-Republic-of-Nigeria-1999-Updated.chunks.json', import.meta.url),
    'utf8',
  ))
  const chunks = artifact.chunks
  const chapterOne = chunks.filter((chunk) => chunk.chapter === 'I')
  const chapterTwo = chunks.filter((chunk) => chunk.chapter === 'II')
  const chapterEight = chunks.filter((chunk) => chunk.chapter === 'VIII')
  const schedules = chunks.filter((chunk) => chunk.chapter === null)

  assert.ok(chapterOne.some((chunk) => chunk.section === '1' && chunk.text.includes('This Constitution is supreme')))
  assert.ok(chapterTwo.some((chunk) => chunk.section === '13' && chunk.heading.includes('Fundamental obligations')))
  assert.ok(chapterEight.length > 0)
  assert.ok(schedules.length > 0)
  assert.equal(chunks.filter((chunk) => !chunk.text.trim()).length, 0)
  assert.ok(chunks.every((chunk) => !/ARRANGEMENT OF SECTIONS/.test(chunk.text)))
})
