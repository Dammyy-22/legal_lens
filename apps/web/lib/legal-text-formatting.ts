export type LegalTextBlock = {
  kind: 'chapter' | 'part' | 'provision' | 'paragraph'
  text: string
}

const STRUCTURAL_BREAK = /(?<!^)\s+(?=(?:Chapter\s+[IVXLCDM]+\b|Part\s+[IVXLCDM]+\b|\d{1,3}[.)]?\s+[A-Z]|\(\d+\)\s+[A-Z]))/gi

export function formatLegalText(text: string): LegalTextBlock[] {
  const normalized = text
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{2,}/g, '\u0000')
    .replace(/\n/g, ' ')
    .replace(/\u0000/g, '\n')
    .trim()

  return normalized
    .split(STRUCTURAL_BREAK)
    .flatMap((line) => line.split('\n'))
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (/^Chapter\s+[IVXLCDM]+\b/i.test(line)) return { kind: 'chapter', text: line }
      if (/^Part\s+[IVXLCDM]+\b/i.test(line)) return { kind: 'part', text: line }
      if (/^(?:\d{1,3}[.)]?|\(\d+\))\s+[A-Z]/.test(line)) {
        return { kind: 'provision', text: line }
      }
      return { kind: 'paragraph', text: line }
    })
}
