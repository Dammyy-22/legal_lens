const CHAPTERS = [
  { roman: 'I', label: 'Chapter I', heading: 'General Provisions' },
  {
    roman: 'II',
    label: 'Chapter II',
    heading: 'Fundamental Objectives and Directive Principles of State Policy',
  },
  { roman: 'III', label: 'Chapter III', heading: 'Citizenship' },
  { roman: 'IV', label: 'Chapter IV', heading: 'Fundamental Rights' },
  { roman: 'V', label: 'Chapter V', heading: 'The Legislature' },
  { roman: 'VI', label: 'Chapter VI', heading: 'The Executive' },
  { roman: 'VII', label: 'Chapter VII', heading: 'The Judicature' },
  {
    roman: 'VIII',
    label: 'Chapter VIII',
    heading: 'Federal Capital Territory, Abuja and General Supplementary Provisions',
  },
]

const BODY_MARKER = /WE\s+the\s+people\s+of\s+the\s+Federal\s+Republic\s+of\s+Nigeria/i
const CHAPTER_LINE = /(?:^|\n)\s*CHAPTER\s+(VIII|VII|VI|V|IV|III|II|I)\b[^\n]*/gim
const FIRST_SCHEDULE_LINE = /(?:^|\n)\s*FIRST\s+SCHEDULE\b[^\n]*/im
const SCHEDULES_HEADING = /(?:^|\n)\s*Schedules\s*\n\s*FIRST\s+SCHEDULE\b[^\n]*/im

function comparable(text) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function extractConstitutionMainText(text) {
  const bodyStart = BODY_MARKER.exec(text)?.index
  if (bodyStart === undefined) {
    throw new Error('Could not locate the Constitution preamble after its contents pages.')
  }
  return text.slice(bodyStart).trim()
}

export function splitConstitutionSections(text) {
  const mainText = extractConstitutionMainText(text)
  const chapterMatches = [...mainText.matchAll(CHAPTER_LINE)].map((match) => ({
    roman: match[1].toUpperCase(),
    start: match.index + match[0].search(/CHAPTER/i),
  }))
  const starts = []
  let cursor = 0

  for (const chapter of CHAPTERS) {
    const found = chapterMatches.find((match) => {
      if (match.roman !== chapter.roman || match.start < cursor) return false
      const context = comparable(mainText.slice(match.start, match.start + 700))
      return context.includes(comparable(chapter.heading))
    })
    if (!found) {
      throw new Error(`Could not locate the body heading for ${chapter.label} after the Constitution preamble.`)
    }
    starts.push({ ...chapter, start: found.start })
    cursor = found.start + 1
  }

  let schedulesStart = mainText.length
  const sections = starts.map((chapter, index) => {
    let end = starts[index + 1]?.start ?? mainText.length
    if (chapter.roman === 'VIII') {
      const remainder = mainText.slice(chapter.start)
      const schedulesHeadingMatch = SCHEDULES_HEADING.exec(remainder)
      const scheduleMatch = schedulesHeadingMatch ?? FIRST_SCHEDULE_LINE.exec(remainder)
      if (scheduleMatch) {
        const headingOffset = schedulesHeadingMatch
          ? scheduleMatch[0].search(/Schedules/i)
          : scheduleMatch[0].search(/FIRST\s+SCHEDULE/i)
        schedulesStart = chapter.start + scheduleMatch.index + headingOffset
        end = schedulesStart
      }
    }
    return {
      label: chapter.label,
      heading: chapter.heading,
      hierarchyLevel: 'chapter',
      text: mainText.slice(chapter.start, end).trim(),
    }
  })

  const scheduleText = mainText.slice(schedulesStart).trim()
  if (scheduleText) {
    sections.push({
      label: 'Schedules',
      heading: 'Schedules',
      hierarchyLevel: 'schedule',
      text: scheduleText,
    })
  }

  return sections
}
