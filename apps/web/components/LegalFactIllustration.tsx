import type { LegalFact } from '@/lib/legal-facts'

const ARTWORK: Record<LegalFact['illustration'], React.ReactNode> = {
  life: (
    <>
      <path d="M60 30c-9-9-23 5 0 22 23-17 9-31 0-22Z" fill="#D88468" stroke="#8C3B2E" strokeWidth="2.5" />
      <path d="M60 52v15m-9-7h18" stroke="#1F4D3D" strokeWidth="3" strokeLinecap="round" />
      <path d="M43 77c2-10 8-15 17-15s15 5 17 15" fill="#C7A968" stroke="#8F701F" strokeWidth="2.5" />
      <circle cx="55" cy="39" r="1.4" fill="#14261E" />
      <circle cx="65" cy="39" r="1.4" fill="#14261E" />
    </>
  ),
  arrest: (
    <>
      <path d="M42 40a10 10 0 1 1 20 0v8H42v-8Zm16 8v-8a10 10 0 1 1 20 0v8" fill="none" stroke="#1F4D3D" strokeWidth="3" />
      <rect x="35" y="46" width="31" height="25" rx="8" fill="#C7A968" stroke="#8F701F" strokeWidth="2.5" />
      <rect x="55" y="46" width="31" height="25" rx="8" fill="#D88468" stroke="#8C3B2E" strokeWidth="2.5" />
      <path d="M63 57h5m-2.5-2.5v5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  silence: (
    <>
      <path d="M32 38a8 8 0 0 1 8-8h40a8 8 0 0 1 8 8v23a8 8 0 0 1-8 8H57L44 80v-11h-4a8 8 0 0 1-8-8V38Z" fill="#fff" stroke="#1F4D3D" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M46 50h28" stroke="#C7A968" strokeWidth="4" strokeLinecap="round" />
      <path d="m51 43 18 18m0-18L51 61" stroke="#8C3B2E" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  fairness: (
    <>
      <path d="M60 28 82 36v18c0 14-9 24-22 30-13-6-22-16-22-30V36l22-8Z" fill="#EAE3D1" stroke="#1F4D3D" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="m49 54 8 8 15-17" fill="none" stroke="#8F701F" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M28 77h15m34 0h15M60 70v7" stroke="#D88468" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  marriage: (
    <>
      <circle cx="52" cy="53" r="16" fill="none" stroke="#C7A968" strokeWidth="6" />
      <circle cx="68" cy="53" r="16" fill="none" stroke="#D88468" strokeWidth="6" />
      <path d="m60 34 2-5 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="#8F701F" />
      <circle cx="36" cy="34" r="2" fill="#1F4D3D" />
      <circle cx="82" cy="72" r="2" fill="#1F4D3D" />
    </>
  ),
  welfare: (
    <>
      <path d="m31 51 29-23 29 23v31H31V51Z" fill="#EAE3D1" stroke="#1F4D3D" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M53 82V62h14v20" fill="#C7A968" stroke="#8F701F" strokeWidth="2.5" />
      <path d="M44 51h8m16 0h8" stroke="#D88468" strokeWidth="4" strokeLinecap="round" />
      <path d="M60 41c-7-7-16 3 0 14 16-11 7-21 0-14Z" fill="#D88468" />
    </>
  ),
  protection: (
    <>
      <path d="M60 26 84 36v20c0 15-10 25-24 31-14-6-24-16-24-31V36l24-10Z" fill="#EAE3D1" stroke="#1F4D3D" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="m48 54 8 8 16-18" fill="none" stroke="#8F701F" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M25 41h8m54 0h8M30 72h7m46 0h7" stroke="#D88468" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  unity: (
    <>
      <circle cx="60" cy="37" r="8" fill="#C7A968" stroke="#8F701F" strokeWidth="2" />
      <circle cx="39" cy="45" r="7" fill="#D88468" stroke="#8C3B2E" strokeWidth="2" />
      <circle cx="81" cy="45" r="7" fill="#9DB5A8" stroke="#1F4D3D" strokeWidth="2" />
      <path d="M44 78c1-13 7-21 16-21s15 8 16 21" fill="#C7A968" stroke="#8F701F" strokeWidth="2.5" />
      <path d="M25 78c1-11 5-17 14-17 5 0 9 3 11 8m35-8c9 0 13 6 14 17M34 49l5 4 5-4m32 0 5 4 5-4" fill="none" stroke="#1F4D3D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
}

export function LegalFactIllustration({ fact }: { fact: LegalFact }) {
  return (
    <svg
      aria-hidden="true"
      className="legal-fact-artwork h-40 w-40 overflow-visible sm:h-48 sm:w-48"
      viewBox="0 0 120 110"
      fill="none"
    >
      <circle cx="60" cy="57" r="43" fill="#F5F1E7" />
      <circle className="legal-fact-artwork-orbit" cx="60" cy="57" r="49" stroke="#C7A968" strokeDasharray="2 7" strokeLinecap="round" />
      <path d="M16 92h88" stroke="#D5DFDA" strokeWidth="2" strokeLinecap="round" />
      <path d="m23 26 2-5 2 5 5 2-5 2-2 5-2-5-5-2 5-2Zm69 45 1.5-3.5L95 71l3.5 1.5L95 74l-1.5 3.5L92 74l-3.5-1.5 3.5-1.5Z" fill="#B08D3E" />
      <g className="legal-fact-artwork-character">{ARTWORK[fact.illustration]}</g>
    </svg>
  )
}
