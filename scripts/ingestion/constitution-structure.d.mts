export interface ConstitutionSection {
  label: string
  heading: string
  hierarchyLevel: 'chapter' | 'schedule'
  text: string
}

export function extractConstitutionMainText(text: string): string
export function splitConstitutionSections(text: string): ConstitutionSection[]
