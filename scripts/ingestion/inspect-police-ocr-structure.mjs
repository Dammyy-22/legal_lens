import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const OCR_FILE = path.join(
  ROOT,
  "normalized-corpus",
  "police-ocr",
  "Police-Act-2020-PLAC.ocr.txt"
);

const OUTPUT_DIR = path.join(
  ROOT,
  "normalized-corpus",
  "police-ocr",
  "structure"
);

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

if (!fs.existsSync(OCR_FILE)) {
  throw new Error(`OCR file not found:\n${OCR_FILE}`);
}

const fullText = fs.readFileSync(OCR_FILE, "utf8");

function cleanLine(line) {
  return line
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function normalizeForDetection(line) {
  return cleanLine(line)
    .replace(/[|¦]/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
}

// ------------------------------------------------------------
// 1. LOCATE SUBSTANTIVE ACT
// ------------------------------------------------------------

const enactedMatch = fullText.match(
  /ENACTED by the National Assembly of the Federal Republic of\s+Nigeria\s*:/i
);

if (!enactedMatch) {
  throw new Error(
    "Could not locate the beginning of the substantive Act."
  );
}

const actStart = enactedMatch.index;

console.log("========================================");
console.log("POLICE ACT OCR STRUCTURE AUDIT");
console.log("========================================");

console.log(`Full OCR characters: ${fullText.length}`);
console.log(`Act start offset:    ${actStart}`);

// ------------------------------------------------------------
// 2. LOCATE ACTUAL SCHEDULE
// ------------------------------------------------------------
//
// OCR contains several references to "Schedule":
//
//   Schedule                         <- TOC
//   Second Schedule ...              <- ordinary section text
//   : SCHEDULE Section 3 (3)        <- ACTUAL SCHEDULE
//   Schedule to the Nigeria Police Bill, 2020
//
// We therefore require SCHEDULE to appear at the beginning
// of an OCR line, allowing punctuation before it.
//

const scheduleMatches = [
  ...fullText.matchAll(
    /(?:^|\n)[ \t]*[:;,.]?[ \t]*SCHEDULE\b[^\n]*/gi
  )
];

if (scheduleMatches.length === 0) {
  throw new Error(
    "Could not locate a Schedule heading in the OCR text."
  );
}

console.log();
console.log("Schedule candidates:");
console.log("----------------------------------------");

const validScheduleMatches = [];

for (const match of scheduleMatches) {
  const offset = match.index;

  console.log(
    `offset=${offset} | "${match[0].trim()}"`
  );

  // The actual Schedule is near the end of the Act.
  // This prevents an early TOC/reference from becoming
  // the boundary.
  if (offset > actStart + 100000) {
    validScheduleMatches.push(match);
  }
}

if (validScheduleMatches.length === 0) {
  throw new Error(
    "Could not locate the actual Schedule after the substantive Act."
  );
}

const scheduleMatch = validScheduleMatches[0];

const scheduleStart = scheduleMatch.index;

console.log();
console.log(
  `Selected Schedule boundary at offset ${scheduleStart}`
);

// ------------------------------------------------------------
// 3. EXTRACT SUBSTANTIVE ACT BODY
// ------------------------------------------------------------

const body = fullText.slice(
  actStart,
  scheduleStart
);

console.log(`Act body characters: ${body.length}`);

const lines = body.split("\n");

// ------------------------------------------------------------
// 4. DETECT PAGE NUMBERS
// ------------------------------------------------------------
//
// OCR output contains markers such as:
//
// ===== PAGE 1 =====
// ===== PAGE 54 =====
//
// Keep page provenance for every candidate.
//

let currentPage = null;

const pageMarkerRegex = /^=+\s*PAGE\s+(\d+)\s*=+$/i;

// ------------------------------------------------------------
// 5. SECTION CANDIDATE DETECTOR
// ------------------------------------------------------------
//
// The OCR may produce:
//
//   2. The specific objectives...
//   120 (1) There is established...
//   120. (1) There is established...
//   120
//   120. 
//
// We intentionally DO NOT automatically treat every number as
// a section. We collect candidates first and score them.
//
// A subsection such as:
//
//   (1)
//   (2)
//   (3)
//
// is not considered a section.
//

const candidates = [];

for (let i = 0; i < lines.length; i++) {
  const original = lines[i];

  const raw = cleanLine(original);

  if (!raw) {
    continue;
  }

  const pageMatch = raw.match(pageMarkerRegex);

  if (pageMatch) {
    currentPage = Number(pageMatch[1]);
    continue;
  }

  const line = normalizeForDetection(raw);

  // Ignore obvious subsection-only lines.
  if (/^\(\d+\)/.test(line)) {
    continue;
  }

  // ----------------------------------------------------------
  // Pattern A
  //
  // 120. (1) There is established...
  // 120. There is established...
  // ----------------------------------------------------------

  let match = line.match(
    /^(\d{1,3})\s*\.\s*(.*)$/
  );

  if (match) {
    const section = Number(match[1]);
    const remainder = match[2].trim();

    if (section >= 1 && section <= 142) {
      candidates.push({
        section,
        line: i + 1,
        page: currentPage,
        text: remainder,
        raw,
        pattern: "number-dot",
        score: scoreCandidate(
          section,
          remainder,
          i,
          lines
        ),
      });
    }

    continue;
  }

  // ----------------------------------------------------------
  // Pattern B
  //
  // 120 (1) There is established...
  //
  // Important: require a subsection immediately after the
  // section number. This reduces false positives from ordinary
  // numeric references.
  // ----------------------------------------------------------

  match = line.match(
    /^(\d{1,3})\s+\((\d+)\)\s+(.*)$/
  );

  if (match) {
    const section = Number(match[1]);
    const subsection = Number(match[2]);
    const remainder = match[3].trim();

    if (
      section >= 1 &&
      section <= 142 &&
      subsection >= 1
    ) {
      candidates.push({
        section,
        line: i + 1,
        page: currentPage,
        text: remainder,
        raw,
        pattern: "number-subsection",
        subsection,
        score: scoreCandidate(
          section,
          remainder,
          i,
          lines
        ),
      });
    }

    continue;
  }

  // ----------------------------------------------------------
  // Pattern C
  //
  // A bare section number:
  //
  // 120
  //
  // This is only considered a weak candidate.
  // ----------------------------------------------------------

  match = line.match(
    /^(\d{1,3})$/
  );

  if (match) {
    const section = Number(match[1]);

    if (section >= 1 && section <= 142) {
      candidates.push({
        section,
        line: i + 1,
        page: currentPage,
        text: "",
        raw,
        pattern: "bare-number",
        score: 1,
      });
    }
  }
}

// ------------------------------------------------------------
// Candidate scoring
// ------------------------------------------------------------

function scoreCandidate(
  section,
  remainder,
  lineIndex,
  lines
) {
  let score = 0;

  // Section number is in the expected legal range.
  score += 2;

  // A subsection beginning with "(1)" is a strong signal.
  if (/^\(1\)\s*/.test(remainder)) {
    score += 4;
  }

  // Legal section text usually starts with words, not another
  // unrelated number.
  if (/^[A-Za-z"“‘]/.test(remainder)) {
    score += 2;
  }

  // Common legal drafting language.
  if (
    /\b(there is|there are|shall|may|where|subject to|a police|the police|any person|an officer|for the purposes)\b/i.test(
      remainder
    )
  ) {
    score += 2;
  }

  // A nearby line containing subsection "(1)" is useful.
  for (
    let j = lineIndex + 1;
    j <= Math.min(lineIndex + 3, lines.length - 1);
    j++
  ) {
    if (/^\s*\(1\)/.test(lines[j])) {
      score += 3;
      break;
    }
  }

  return score;
}

// ------------------------------------------------------------
// 6. PRINT ALL CANDIDATES
// ------------------------------------------------------------

console.log();
console.log(`Section-like candidates: ${candidates.length}`);

console.log();
console.log("CANDIDATES");
console.log("----------------------------------------");

for (const candidate of candidates) {
  console.log(
    `${String(candidate.section).padStart(3)} | ` +
    `line ${String(candidate.line).padStart(5)} | ` +
    `page ${String(candidate.page ?? "?").padStart(3)} | ` +
    `score=${candidate.score} | ` +
    `${candidate.pattern.padEnd(18)} | ` +
    candidate.text.slice(0, 160)
  );
}

// ------------------------------------------------------------
// 7. GROUP CANDIDATES BY SECTION
// ------------------------------------------------------------

const bySection = new Map();

for (const candidate of candidates) {
  if (!bySection.has(candidate.section)) {
    bySection.set(candidate.section, []);
  }

  bySection.get(candidate.section).push(candidate);
}

// ------------------------------------------------------------
// 8. SECTION COVERAGE
// ------------------------------------------------------------

const audit = [];

for (let section = 1; section <= 142; section++) {
  const matches = bySection.get(section) || [];

  const sorted = [...matches].sort(
    (a, b) => b.score - a.score
  );

  audit.push({
    section,
    occurrences: matches.length,
    found: matches.length > 0,
    bestCandidate: sorted[0] || null,
    candidates: matches,
  });
}

console.log();
console.log("SECTION COVERAGE");
console.log("========================================");

const missing = [];
const duplicates = [];

for (const item of audit) {
  if (!item.found) {
    missing.push(item.section);
  }

  if (item.occurrences > 1) {
    duplicates.push(item.section);
  }

  const best = item.bestCandidate;

  console.log(
    `${String(item.section).padStart(3)} | ` +
    `${item.found ? "FOUND" : "MISSING"} | ` +
    `occurrences=${item.occurrences}` +
    (
      best
        ? ` | line=${best.line} | page=${best.page ?? "?"} | score=${best.score}`
        : ""
    )
  );
}

// ------------------------------------------------------------
// 9. SEQUENTIAL COVERAGE ANALYSIS
// ------------------------------------------------------------
//
// Instead of assuming every candidate is valid, walk through
// expected section numbers 1 -> 142 and choose the strongest
// candidate that occurs after the previous selected candidate.
//
// This is only an AUDIT.
// It does not yet create production chunks.
//

const sequential = [];

let previousLine = -1;

for (let expected = 1; expected <= 142; expected++) {
  const options = (bySection.get(expected) || [])
    .filter(candidate => candidate.line > previousLine)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return a.line - b.line;
    });

  if (options.length === 0) {
    sequential.push({
      section: expected,
      found: false,
      candidate: null,
    });

    continue;
  }

  const selected = options[0];

  sequential.push({
    section: expected,
    found: true,
    candidate: selected,
  });

  previousLine = selected.line;
}

const sequentialMissing = sequential
  .filter(item => !item.found)
  .map(item => item.section);

console.log();
console.log("SEQUENTIAL COVERAGE");
console.log("========================================");

for (const item of sequential) {
  if (!item.found) {
    console.log(
      `${String(item.section).padStart(3)} | MISSING`
    );
    continue;
  }

  const c = item.candidate;

  console.log(
    `${String(item.section).padStart(3)} | FOUND | ` +
    `line=${String(c.line).padStart(5)} | ` +
    `page=${String(c.page ?? "?").padStart(3)} | ` +
    `score=${c.score} | ` +
    `${c.pattern}`
  );
}

// ------------------------------------------------------------
// 10. ORDERING PROBLEMS IN RAW CANDIDATES
// ------------------------------------------------------------

const orderingProblems = [];

let previousSection = 0;
let previousCandidate = null;

for (const candidate of candidates) {
  if (candidate.section < previousSection) {
    orderingProblems.push({
      previous: previousSection,
      current: candidate.section,
      previousLine: previousCandidate?.line ?? null,
      currentLine: candidate.line,
    });
  }

  previousSection = candidate.section;
  previousCandidate = candidate;
}

console.log();
console.log("RAW CANDIDATE ORDERING");
console.log("----------------------------------------");

if (orderingProblems.length === 0) {
  console.log(
    "No descending section-number transitions detected."
  );
} else {
  console.log(
    JSON.stringify(orderingProblems, null, 2)
  );
}

// ------------------------------------------------------------
// 11. LOW-CONFIDENCE CANDIDATES
// ------------------------------------------------------------

const lowConfidence = candidates.filter(
  candidate => candidate.score < 5
);

console.log();
console.log("LOW-CONFIDENCE CANDIDATES");
console.log("----------------------------------------");

if (lowConfidence.length === 0) {
  console.log("NONE");
} else {
  for (const candidate of lowConfidence) {
    console.log(
      `section=${candidate.section} | ` +
      `line=${candidate.line} | ` +
      `page=${candidate.page ?? "?"} | ` +
      `score=${candidate.score} | ` +
      `"${candidate.raw}"`
    );
  }
}

// ------------------------------------------------------------
// 12. DUPLICATES
// ------------------------------------------------------------

console.log();
console.log("DUPLICATES");
console.log("----------------------------------------");

console.log(
  duplicates.length
    ? duplicates.join(", ")
    : "NONE"
);

// ------------------------------------------------------------
// 13. MISSING
// ------------------------------------------------------------

console.log();
console.log("MISSING");
console.log("----------------------------------------");

console.log(
  missing.length
    ? missing.join(", ")
    : "NONE"
);

// ------------------------------------------------------------
// 14. SEQUENTIAL MISSING
// ------------------------------------------------------------

console.log();
console.log("SEQUENTIAL MISSING");
console.log("----------------------------------------");

console.log(
  sequentialMissing.length
    ? sequentialMissing.join(", ")
    : "NONE"
);

// ------------------------------------------------------------
// 15. SAVE AUDIT REPORT
// ------------------------------------------------------------

const report = {
  source: OCR_FILE,

  fullTextCharacters: fullText.length,

  actStart,
  scheduleStart,

  bodyCharacters: body.length,

  candidateCount: candidates.length,

  missing,
  duplicates,

  sequentialMissing,

  orderingProblems,

  candidates,

  audit,

  sequential,

  scheduleCandidates: validScheduleMatches.map(
    match => ({
      offset: match.index,
      text: match[0].trim(),
    })
  ),
};

const reportPath = path.join(
  OUTPUT_DIR,
  "police-act-ocr-structure-report.json"
);

fs.writeFileSync(
  reportPath,
  JSON.stringify(report, null, 2),
  "utf8"
);

// ------------------------------------------------------------
// 16. SUMMARY
// ------------------------------------------------------------

console.log();
console.log("========================================");
console.log("AUDIT COMPLETE");
console.log("========================================");

console.log(
  `Act start:          ${actStart}`
);

console.log(
  `Schedule boundary:  ${scheduleStart}`
);

console.log(
  `Candidates:         ${candidates.length}`
);

console.log(
  `Sections found:     ${142 - missing.length}/142`
);

console.log(
  `Sequential found:   ${142 - sequentialMissing.length}/142`
);

console.log(
  `Duplicates:         ${duplicates.length}`
);

console.log(
  `Ordering problems:  ${orderingProblems.length}`
);

console.log(
  `Low confidence:     ${lowConfidence.length}`
);

console.log();

console.log(
  `Report: ${reportPath}`
);