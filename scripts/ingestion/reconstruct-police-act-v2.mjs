import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const INPUT = path.join(
  ROOT,
  "normalized-corpus",
  "police-ocr",
  "Police-Act-2020-PLAC.ocr.txt"
);

const OUTPUT_DIR = path.join(
  ROOT,
  "normalized-corpus",
  "police-reconstructed-v2"
);

const SECTIONS_DIR = path.join(OUTPUT_DIR, "sections");

const EXPECTED_FIRST_SECTION = 1;
const EXPECTED_LAST_SECTION = 142;

// Confirmed from the previous OCR audit.
const SCHEDULE_BOUNDARY = 152219;

const MIN_SECTION_TEXT = 80;
const MAX_LOOKAHEAD_LINES = 120;

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.mkdirSync(SECTIONS_DIR, { recursive: true });

if (!fs.existsSync(INPUT)) {
  throw new Error(`OCR input not found:\n${INPUT}`);
}

const fullText = fs.readFileSync(INPUT, "utf8");
const lines = fullText.split(/\r?\n/);

console.log("=".repeat(80));
console.log("NIGERIA POLICE ACT 2020 — OCR RECONSTRUCTION V2");
console.log("=".repeat(80));
console.log(`Input: ${INPUT}`);
console.log(`Characters: ${fullText.length}`);
console.log(`Lines: ${lines.length}`);
console.log(`Schedule boundary: ${SCHEDULE_BOUNDARY}`);
console.log();

function normalizeLine(line) {
  return line
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function isPageMarker(line) {
  return /^={3,}\s*PAGE\s+\d+\s*={0,}$/i.test(line.trim());
}

function getPageNumber(line) {
  const match = line.match(/^={3,}\s*PAGE\s+(\d+)\s*={0,}$/i);
  return match ? Number(match[1]) : null;
}

function isTocHeading(line) {
  const lower = line.toLowerCase();

  return (
    lower.includes("arrangement of sections") ||
    lower === "contents" ||
    lower === "table of contents" ||
    lower.includes("table of contents") ||
    lower.includes("arrangement of parts")
  );
}

function looksLikeTocEntry(line) {
  const normalized = normalizeLine(line);

  // Typical TOC:
  // 1. Short title ............ 1
  // 32. Something ............. 18
  if (/^\d{1,3}\s*[.)]?\s+.{3,120}\.{2,}\s*\d+\s*$/.test(normalized)) {
    return true;
  }

  // TOC entries may have page numbers separated by spaces.
  if (
    /^\d{1,3}\s+[A-Z][^.!?]{3,100}\s+\d{1,3}\s*$/.test(normalized) &&
    normalized.length < 140
  ) {
    return true;
  }

  return false;
}

function isCrossReference(line) {
  const normalized = normalizeLine(line);

  return (
    /\bsection\s+\d{1,3}\b/i.test(normalized) ||
    /\bsections\s+\d{1,3}\s*(?:to|-)\s*\d{1,3}\b/i.test(normalized)
  );
}

function isBillMaterial(line) {
  const lower = line.toLowerCase();

  return (
    lower.startsWith("a bill") ||
    lower.includes("arrangement of clauses") ||
    lower.includes("memorandum of objects and reasons")
  );
}

function looksLikeCorruptedNumber(line) {
  const normalized = normalizeLine(line);

  /*
   * OCR frequently produces things such as:
   * {18.
   * €8.
   * ill.
   * N
   * 3.
   *
   * We deliberately do NOT treat these as section headings.
   */
  return (
    /^[^A-Za-z]{0,5}\d{1,3}\s*[.)-]\s*$/.test(normalized) ||
    /^[{}€£$IlNn]{1,4}\s*\d{0,3}\s*[.)-]\s*$/.test(normalized) ||
    /^[A-Za-zIlN]{1,4}\s*[.)-]\s*$/.test(normalized)
  );
}

function isLikelyPartHeading(line) {
  const normalized = normalizeLine(line);

  return (
    /^PART\s+[IVXLCDM0-9A-Z]+/i.test(normalized) ||
    /^PART\s+[A-Z0-9-]+/i.test(normalized)
  );
}

function isScheduleLine(line) {
  return /\bSCHEDULE\b/i.test(normalizeLine(line));
}

function sectionHeadingCandidates(line, lineIndex) {
  const normalized = normalizeLine(line);

  if (!normalized) return [];

  // Never accept page markers as section headings.
  if (isPageMarker(normalized)) return [];

  // Never accept obvious TOC entries.
  if (looksLikeTocEntry(normalized)) return [];

  // Never accept cross-references.
  if (isCrossReference(normalized)) return [];

  // Never accept corrupted bare numbers.
  if (looksLikeCorruptedNumber(normalized)) return [];

  const candidates = [];

  /*
   * Strong form:
   *
   * 120. (1) There is established...
   * 120 (1) There is established...
   * 120. There is...
   */
  let match = normalized.match(
    /^(\d{1,3})\s*[.)]?\s+(?=\(?\d|\(?[A-Z])/i
  );

  if (match) {
    const number = Number(match[1]);

    if (number >= 1 && number <= 142) {
      candidates.push({
        number,
        lineIndex,
        text: normalized,
        strength: "strong"
      });
    }
  }

  /*
   * Heading where OCR separates the number:
   *
   * 120.
   * (1) There is established...
   *
   * We only accept this if:
   * - the line is a clean numeric heading
   * - next lines look substantive
   * - it is not obviously a TOC/page artifact
   */
  const bare = normalized.match(/^(\d{1,3})\s*[.)]?\s*$/);

  if (bare) {
    const number = Number(bare[1]);

    if (number >= 1 && number <= 142) {
      candidates.push({
        number,
        lineIndex,
        text: normalized,
        strength: "weak"
      });
    }
  }

  /*
   * OCR can turn "120." into forms such as:
   * 120.
   * 120)
   * 120 -
   */
  const headingOnly = normalized.match(/^(\d{1,3})\s*[.)-]\s*$/);

  if (headingOnly) {
    const number = Number(headingOnly[1]);

    if (number >= 1 && number <= 142) {
      candidates.push({
        number,
        lineIndex,
        text: normalized,
        strength: "weak"
      });
    }
  }

  return candidates;
}

function lineLooksSubstantive(line) {
  const normalized = normalizeLine(line);

  if (!normalized) return false;
  if (isPageMarker(normalized)) return false;
  if (looksLikeTocEntry(normalized)) return false;

  return (
    normalized.length >= 30 ||
    /\(\d+\)/.test(normalized) ||
    /[A-Za-z]{5,}/.test(normalized)
  );
}

function inspectFollowingLines(index) {
  const following = [];

  for (
    let i = index + 1;
    i < Math.min(lines.length, index + 1 + 12);
    i++
  ) {
    const line = normalizeLine(lines[i]);

    if (!line) continue;

    if (isPageMarker(line)) {
      continue;
    }

    following.push({
      lineIndex: i,
      text: line
    });

    if (following.length >= 8) break;
  }

  return following;
}

function scoreCandidate(candidate) {
  let score = candidate.strength === "strong" ? 70 : 35;

  const following = inspectFollowingLines(candidate.lineIndex);

  if (following.some((x) => lineLooksSubstantive(x.text))) {
    score += 15;
  }

  if (
    following.some((x) =>
      /\(\s*1\s*\)|^\(1\)/.test(x.text)
    )
  ) {
    score += 10;
  }

  if (
    candidate.number === EXPECTED_FIRST_SECTION &&
    candidate.lineIndex < 400
  ) {
    score += 5;
  }

  if (candidate.number >= 1 && candidate.number <= 142) {
    score += 5;
  }

  return Math.min(score, 100);
}

function findActStart() {
  const patterns = [
    /ENACTED\s+by\s+the\s+National\s+Assembly/i,
    /ENACTED\s+by\s+the\s+National\s+Assembly\s+of\s+the\s+Federal\s+Republic/i
  ];

  for (let i = 0; i < lines.length; i++) {
    const normalized = normalizeLine(lines[i]);

    for (const pattern of patterns) {
      if (pattern.test(normalized)) {
        return i;
      }
    }
  }

  return -1;
}

function lineOffsets() {
  const offsets = new Array(lines.length);

  let offset = 0;

  for (let i = 0; i < lines.length; i++) {
    offsets[i] = offset;
    offset += lines[i].length + 1;
  }

  return offsets;
}

const offsets = lineOffsets();

const actStartLine = findActStart();

if (actStartLine === -1) {
  throw new Error(
    "Could not locate ENACTED by the National Assembly in OCR."
  );
}

console.log(`Act start line: ${actStartLine + 1}`);
console.log(`Act start offset: ${offsets[actStartLine]}`);

const scheduleLine = lines.findIndex(
  (line) => offsets[lines.indexOf(line)] >= SCHEDULE_BOUNDARY
);

const scheduleStartLine =
  scheduleLine === -1
    ? lines.length
    : scheduleLine;

console.log(`Schedule starts approximately at line: ${scheduleStartLine + 1}`);
console.log();

//
// ---------------------------------------------------------------------------
// STEP 1 — Candidate extraction
// ---------------------------------------------------------------------------
//

const candidates = [];

for (let i = actStartLine; i < scheduleStartLine; i++) {
  const line = normalizeLine(lines[i]);

  if (!line) continue;

  const found = sectionHeadingCandidates(line, i);

  for (const candidate of found) {
    const score = scoreCandidate(candidate);

    candidates.push({
      ...candidate,
      score,
      offset: offsets[i],
      page: findCurrentPage(i)
    });
  }
}

function findCurrentPage(lineIndex) {
  for (let i = lineIndex; i >= 0; i--) {
    const page = getPageNumber(lines[i]);

    if (page !== null) {
      return page;
    }
  }

  return null;
}

console.log(`Raw section candidates: ${candidates.length}`);

//
// ---------------------------------------------------------------------------
// STEP 2 — Remove obvious garbage
// ---------------------------------------------------------------------------
//

const filteredCandidates = candidates.filter((candidate) => {
  if (candidate.score < 45) return false;

  // Avoid section-looking numbers appearing in the explanatory/front matter.
  if (candidate.lineIndex < actStartLine) return false;

  return true;
});

console.log(`Filtered candidates: ${filteredCandidates.length}`);

//
// ---------------------------------------------------------------------------
// STEP 3 — Sequential reconstruction
// ---------------------------------------------------------------------------
//

const reconstructed = [];

let expected = EXPECTED_FIRST_SECTION;
let cursor = actStartLine;

function findNextCandidate(sectionNumber, fromLine) {
  const options = filteredCandidates.filter(
    (candidate) =>
      candidate.number === sectionNumber &&
      candidate.lineIndex >= fromLine &&
      candidate.lineIndex < scheduleStartLine
  );

  if (!options.length) {
    return null;
  }

  /*
   * Prefer:
   * 1. highest confidence
   * 2. earliest occurrence after cursor
   */
  options.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    return a.lineIndex - b.lineIndex;
  });

  return options[0];
}

while (expected <= EXPECTED_LAST_SECTION) {
  const candidate = findNextCandidate(expected, cursor);

  if (!candidate) {
    reconstructed.push({
      section: expected,
      status: "MISSING",
      confidence: 0,
      startLine: null,
      endLine: null,
      pageStart: null,
      pageEnd: null,
      text: "",
      reason:
        "No acceptable section heading found after current reconstruction cursor."
    });

    expected++;
    continue;
  }

  reconstructed.push({
    section: expected,
    status: "FOUND",
    confidence: candidate.score,
    startLine: candidate.lineIndex,
    endLine: null,
    pageStart: candidate.page,
    pageEnd: null,
    heading: candidate.text,
    candidateStrength: candidate.strength,
    offset: candidate.offset,
    text: ""
  });

  cursor = candidate.lineIndex + 1;
  expected++;
}

//
// ---------------------------------------------------------------------------
// STEP 4 — Establish boundaries
// ---------------------------------------------------------------------------
//

for (let i = 0; i < reconstructed.length; i++) {
  const current = reconstructed[i];

  if (current.status !== "FOUND") {
    continue;
  }

  const nextFound = reconstructed
    .slice(i + 1)
    .find((section) => section.status === "FOUND");

  let endLine;

  if (nextFound) {
    endLine = nextFound.startLine - 1;
  } else {
    endLine = scheduleStartLine - 1;
  }

  current.endLine = endLine;

  const rawLines = lines.slice(
    current.startLine,
    endLine + 1
  );

  const cleaned = rawLines
    .map(normalizeLine)
    .filter(Boolean);

  current.text = cleaned.join("\n");

  current.pageEnd = findCurrentPage(endLine);

  if (current.text.length < MIN_SECTION_TEXT) {
    current.status = "REVIEW";
    current.reason =
      "Section boundary found, but reconstructed text is unusually short.";
  }

  if (current.heading && looksLikeCorruptedNumber(current.heading)) {
    current.status = "REVIEW";
    current.reason =
      "Heading contains a possible OCR-corrupted section number.";
  }

  /*
   * Section text should normally contain substantive alphabetic content.
   */
  const alphabeticCharacters =
    (current.text.match(/[A-Za-z]/g) || []).length;

  if (alphabeticCharacters < 40) {
    current.status = "REVIEW";
    current.reason =
      "Very little alphabetic content was reconstructed.";
  }
}

//
// ---------------------------------------------------------------------------
// STEP 5 — Detect suspicious overlaps / ordering
// ---------------------------------------------------------------------------
//

for (let i = 1; i < reconstructed.length; i++) {
  const previous = reconstructed[i - 1];
  const current = reconstructed[i];

  if (
    previous.status !== "MISSING" &&
    current.status !== "MISSING" &&
    previous.endLine !== null &&
    current.startLine !== null &&
    current.startLine <= previous.startLine
  ) {
    current.status = "REVIEW";
    current.reason =
      "Section boundary ordering is suspicious.";
  }
}

//
// ---------------------------------------------------------------------------
// STEP 6 — Write individual section files
// ---------------------------------------------------------------------------
//

for (const section of reconstructed) {
  const filename = `section-${String(section.section).padStart(3, "0")}.txt`;
  const outputPath = path.join(SECTIONS_DIR, filename);

  const header = [
    `Nigeria Police Act 2020`,
    `Section: ${section.section}`,
    `Status: ${section.status}`,
    `Confidence: ${section.confidence}`,
    `Page start: ${section.pageStart ?? "unknown"}`,
    `Page end: ${section.pageEnd ?? "unknown"}`,
    `OCR line start: ${
      section.startLine !== null
        ? section.startLine + 1
        : "unknown"
    }`,
    `OCR line end: ${
      section.endLine !== null
        ? section.endLine + 1
        : "unknown"
    }`,
    `Reason: ${section.reason ?? ""}`,
    "",
    "----- RECONSTRUCTED TEXT -----",
    ""
  ].join("\n");

  fs.writeFileSync(
    outputPath,
    `${header}${section.text || "[NO RECONSTRUCTED TEXT]"}\n`,
    "utf8"
  );
}

//
// ---------------------------------------------------------------------------
// STEP 7 — Summary
// ---------------------------------------------------------------------------
//

const summary = {
  generatedAt: new Date().toISOString(),
  input: INPUT,
  inputCharacters: fullText.length,
  inputLines: lines.length,
  actStartLine: actStartLine + 1,
  actStartOffset: offsets[actStartLine],
  scheduleBoundaryOffset: SCHEDULE_BOUNDARY,
  scheduleStartLine:
    scheduleStartLine === lines.length
      ? null
      : scheduleStartLine + 1,
  expectedSections: {
    first: EXPECTED_FIRST_SECTION,
    last: EXPECTED_LAST_SECTION,
    count:
      EXPECTED_LAST_SECTION -
      EXPECTED_FIRST_SECTION +
      1
  },
  candidateCount: candidates.length,
  filteredCandidateCount: filteredCandidates.length,
  results: reconstructed.map((section) => ({
    section: section.section,
    status: section.status,
    confidence: section.confidence,
    pageStart: section.pageStart,
    pageEnd: section.pageEnd,
    startLine:
      section.startLine === null
        ? null
        : section.startLine + 1,
    endLine:
      section.endLine === null
        ? null
        : section.endLine + 1,
    textCharacters: section.text.length,
    heading: section.heading ?? null,
    reason: section.reason ?? null
  }))
};

const summaryPath = path.join(
  OUTPUT_DIR,
  "reconstruction-report.json"
);

fs.writeFileSync(
  summaryPath,
  JSON.stringify(summary, null, 2),
  "utf8"
);

//
// ---------------------------------------------------------------------------
// STEP 8 — Human review report
// ---------------------------------------------------------------------------
//

const reviewSections = reconstructed.filter(
  (section) => section.status !== "FOUND"
);

const reviewText = [
  "NIGERIA POLICE ACT 2020 — HUMAN REVIEW REPORT",
  "=".repeat(70),
  "",
  `Generated: ${new Date().toISOString()}`,
  `Expected sections: 1–142`,
  `Found/usable: ${
    reconstructed.filter(
      (s) => s.status === "FOUND"
    ).length
  }`,
  `Review/Missing: ${reviewSections.length}`,
  "",
  "SECTIONS REQUIRING REVIEW",
  "-".repeat(70),
  ""
];

for (const section of reviewSections) {
  reviewText.push(
    `Section ${section.section}`,
    `Status: ${section.status}`,
    `Confidence: ${section.confidence}`,
    `Page: ${section.pageStart ?? "unknown"}–${
      section.pageEnd ?? "unknown"
    }`,
    `Reason: ${section.reason ?? "No reason supplied."}`,
    ""
  );

  if (section.startLine !== null) {
    const from = Math.max(0, section.startLine - 5);
    const to = Math.min(
      lines.length,
      section.startLine + 12
    );

    reviewText.push("OCR CONTEXT:");

    for (let i = from; i < to; i++) {
      reviewText.push(
        `${String(i + 1).padStart(6)} | ${lines[i]}`
      );
    }

    reviewText.push("");
  }

  reviewText.push("-".repeat(70), "");
}

const reviewPath = path.join(
  OUTPUT_DIR,
  "human-review.txt"
);

fs.writeFileSync(
  reviewPath,
  reviewText.join("\n"),
  "utf8"
);

//
// ---------------------------------------------------------------------------
// FINAL CONSOLE REPORT
// ---------------------------------------------------------------------------
//

const foundCount = reconstructed.filter(
  (s) => s.status === "FOUND"
).length;

const reviewCount = reconstructed.filter(
  (s) => s.status === "REVIEW"
).length;

const missingCount = reconstructed.filter(
  (s) => s.status === "MISSING"
).length;

console.log();
console.log("=".repeat(80));
console.log("RECONSTRUCTION RESULT");
console.log("=".repeat(80));
console.log(`Expected sections : 142`);
console.log(`Found             : ${foundCount}`);
console.log(`Needs review      : ${reviewCount}`);
console.log(`Missing           : ${missingCount}`);
console.log();

console.log(
  `Report: ${summaryPath}`
);

console.log(
  `Review: ${reviewPath}`
);

console.log(
  `Sections: ${SECTIONS_DIR}`
);

console.log();

console.log("STATUS:");

if (missingCount === 0 && reviewCount === 0) {
  console.log(
    "✓ All sections reconstructed without automatic review flags."
  );
  console.log(
    "  Still perform legal-content verification before ingestion."
  );
} else {
  console.log(
    "⚠ Reconstruction is NOT production-ready."
  );
  console.log(
    "  Review human-review.txt before proceeding."
  );
}