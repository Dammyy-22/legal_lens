// Hero artwork: an illustrated statute-page document, angled like it's resting on a
// desk, with a highlighted clause, a marginal citation, and a stamp — this stands in
// for a hero photograph. Crafted as SVG rather than a hotlinked stock photo so it
// never breaks, always matches the palette exactly, and is legible as the product's
// actual subject (a cited legal document) rather than generic stock imagery.
export function StatuteIllustration() {
  return (
    <svg
      viewBox="0 0 420 480"
      className="w-full h-auto max-w-md mx-auto animate-ink-in"
      role="img"
      aria-label="Illustration of an annotated statute page with a highlighted clause and citation stamp"
    >
      {/* drop shadow */}
      <ellipse cx="210" cy="450" rx="150" ry="16" fill="#14261E" opacity="0.08" />

      {/* the page, slightly rotated */}
      <g transform="rotate(-4 210 240)">
        <rect x="70" y="40" width="280" height="380" rx="6" fill="#FFFFFF" stroke="#14261E" strokeOpacity="0.15" />
        {/* page edge shading */}
        <rect x="70" y="40" width="280" height="380" rx="6" fill="url(#pageGrad)" />

        {/* header rule */}
        <rect x="100" y="72" width="140" height="10" rx="2" fill="#14261E" />
        <rect x="100" y="90" width="90" height="6" rx="2" fill="#14261E" opacity="0.35" />

        {/* body text lines */}
        {[120, 136, 152, 168].map((y) => (
          <rect key={y} x="100" y={y} width={220 - (y % 3) * 12} height="5" rx="2" fill="#1C1C1A" opacity="0.18" />
        ))}

        {/* highlighted clause — the "cited" line, in brass */}
        <rect x="100" y="192" width="220" height="18" rx="3" fill="#B08D3E" opacity="0.22" />
        <rect x="100" y="197" width="200" height="6" rx="2" fill="#8F701F" opacity="0.8" />

        {/* more body lines */}
        {[228, 244, 260, 276].map((y) => (
          <rect key={y} x="100" y={y} width={200 - (y % 4) * 10} height="5" rx="2" fill="#1C1C1A" opacity="0.18" />
        ))}

        {/* margin citation mark */}
        <text x="316" y="203" fontFamily="ui-monospace, monospace" fontSize="11" fill="#8C3B2E">
          § 35
        </text>

        {/* stamp */}
        <g transform="translate(255 320) rotate(-10)" className="animate-stamp" style={{ transformOrigin: '40px 40px' }}>
          <circle cx="40" cy="40" r="38" fill="none" stroke="#8C3B2E" strokeWidth="3" opacity="0.75" />
          <circle cx="40" cy="40" r="30" fill="none" stroke="#8C3B2E" strokeWidth="1.5" opacity="0.55" />
          <text
            x="40"
            y="36"
            textAnchor="middle"
            fontFamily="'Plus Jakarta Sans', sans-serif"
            fontWeight={700}
            fontSize="9"
            fill="#8C3B2E"
            opacity="0.85"
          >
            SOURCE
          </text>
          <text
            x="40"
            y="48"
            textAnchor="middle"
            fontFamily="'Plus Jakarta Sans', sans-serif"
            fontWeight={700}
            fontSize="9"
            fill="#8C3B2E"
            opacity="0.85"
          >
            VERIFIED
          </text>
        </g>

        {/* footer lines */}
        {[350, 366].map((y) => (
          <rect key={y} x="100" y={y} width={180 - (y % 3) * 8} height="5" rx="2" fill="#1C1C1A" opacity="0.14" />
        ))}
      </g>

      <defs>
        <linearGradient id="pageGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="100%" stopColor="#14261E" stopOpacity="0.03" />
        </linearGradient>
      </defs>
    </svg>
  )
}
