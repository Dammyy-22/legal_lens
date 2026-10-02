import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const INPUT = path.join(
  ROOT,
  "normalized-corpus",
  "normalized",
  "Police-Act-2020.json"
);

const OUT_DIR = path.join(ROOT, "normalized-corpus", "audit");
const OUT_FILE = path.join(OUT_DIR, "Police-Act-2020.audit-v3.json");

if (!fs.existsSync(INPUT)) {
  throw new Error(`Input not found: ${INPUT}`);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const document = JSON.parse(fs.readFileSync(INPUT, "utf8"));
const fullText = document.content?.normalizedText;

if (!fullText) {
  throw new Error("normalizedText not found in Police-Act-2020.json");
}

const ACT_START = fullText.indexOf("ENACTED by the National Assembly");

if (ACT_START === -1) {
  throw new Error("Could not find actual Act start.");
}

/*
 * IMPORTANT:
 * Search for SCHEDULE only AFTER the actual Act starts.
 * The earlier TOC also contains schedule-related references.
 */
const scheduleMatch = fullText.match(/\nSCHEDULE\b/i);

if (!scheduleMatch) {
  throw new Error("Could not find Schedule.");
}

const SCHEDULE_START = ACT_START + scheduleMatch.index;

const body = fullText.slice(ACT_START, SCHEDULE_START);

console.log(`Actual Act marker: ${ACT_START}`);
console.log(`Schedule marker: ${SCHEDULE_START}`);
console.log(`Body characters: ${body.length}`);

//
// ------------------------------------------------------------
// PART DETECTION
// ------------------------------------------------------------
//

const partRegex =
  /(?:^|\n)\s*PART\s+([IVXLCDM]+)\s*[-–—:]?\s*([^\n]*)/gi;

const parts = [];

let match;

while ((match = partRegex.exec(body)) !== null) {
  const roman = match[1].toUpperCase();
  const title = match[2].trim();

  parts.push({
    roman,
    title,
    bodyOffset: match.index
  });
}

//
// ------------------------------------------------------------
// SECTION DETECTION
// ------------------------------------------------------------
//
// We intentionally DO NOT trust every number followed by a period.
// Instead we look for section-like lines:
//
// 31. Investigation...
// 32. Arrest generally.
//
// A section heading should occur near the beginning of a line,
// followed by a plausible heading.
//
// Subsections such as "(1)" are excluded.
//

const sectionRegex =
  /(?:^|\n)\s*(\d{1,3})\s*[.,]\s+([^\n]{3,180})/g;

const candidates = [];

while ((match = sectionRegex.exec(body)) !== null) {
  const number = Number(match[1]);
  const heading = match[2].trim();

  if (number < 1 || number > 142) continue;

  // Reject obvious subsection / sentence fragments.
  if (/^\(?\d+\)?$/.test(heading)) continue;

  // Reject obvious dates / page-like material.
  if (/^\d{4}\b/.test(heading)) continue;

  candidates.push({
    number,
    heading,
    offset: match.index
  });
}

//
// ------------------------------------------------------------
// NORMALIZE / SCORE SECTION CANDIDATES
// ------------------------------------------------------------
//

function cleanHeading(text) {
  return text
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function scoreCandidate(candidate) {
  let score = 0;

  const h = candidate.heading;

  if (h.length >= 8) score += 2;
  if (h.length <= 140) score += 1;

  // Strong heading indicators.
  if (
    /^(general|specific|establishment|appointment|functions|powers|duty|primary|arrest|search|release|police|information|prevention|found|documentation|missing|recognition|offences|community|traffic|prohibition|application)/i.test(
      h
    )
  ) {
    score += 2;
  }

  // Bad indicators.
  if (/^(and|or|the|of|to|that|which|where|for|in|on)\b/i.test(h)) {
    score -= 3;
  }

  if (/^\(?[a-z]\)?$/i.test(h)) score -= 5;

  if (/^(years|days|months|hours|fine|police)$/i.test(h)) {
    score -= 5;
  }

  if (h.length < 5) score -= 4;

  return score;
}

for (const candidate of candidates) {
  candidate.score = scoreCandidate(candidate);
  candidate.normalizedHeading = cleanHeading(candidate.heading);
}

//
// ------------------------------------------------------------
// BUILD BEST CANDIDATE PER SECTION
// ------------------------------------------------------------
//

const byNumber = new Map();

for (const candidate of candidates) {
  if (!byNumber.has(candidate.number)) {
    byNumber.set(candidate.number, []);
  }

  byNumber.get(candidate.number).push(candidate);
}

const sections = [];

for (let number = 1; number <= 142; number++) {
  const candidatesForNumber = byNumber.get(number) || [];

  candidatesForNumber.sort((a, b) => b.score - a.score);

  const best = candidatesForNumber[0] || null;

  let status = "MISSING";

  if (best) {
    if (best.score >= 3) {
      status = candidatesForNumber.length > 1
        ? "DUPLICATE_REVIEW"
        : "FOUND";
    } else {
      status = "OCR_REVIEW";
    }
  }

  sections.push({
    number,
    status,
    selected: best
      ? {
          heading: best.heading,
          offset: best.offset,
          score: best.score
        }
      : null,
    alternatives: candidatesForNumber.slice(1, 5).map((x) => ({
      heading: x.heading,
      offset: x.offset,
      score: x.score
    }))
  });
}

//
// ------------------------------------------------------------
// DETERMINE PART FOR EACH SECTION
// ------------------------------------------------------------
//

const romanToInt = {
  I: 1,
  V: 5,
  X: 10,
  L: 50,
  C: 100,
  D: 500,
  M: 1000
};

function romanValue(value) {
  let total = 0;

  for (let i = 0; i < value.length; i++) {
    const current = romanToInt[value[i]];
    const next = romanToInt[value[i + 1]] || 0;

    total += current < next ? -current : current;
  }

  return total;
}

for (const section of sections) {
  if (!section.selected) continue;

  let currentPart = null;

  for (const part of parts) {
    if (part.bodyOffset <= section.selected.offset) {
      currentPart = part;
    } else {
      break;
    }
  }

  section.part = currentPart
    ? {
        roman: currentPart.roman,
        number: romanValue(currentPart.roman),
        title: currentPart.title
      }
    : null;
}

//
// ------------------------------------------------------------
// EXTRACT SECTION WINDOWS
// ------------------------------------------------------------
//

for (let i = 0; i < sections.length; i++) {
  const section = sections[i];

  if (!section.selected) continue;

  const start = section.selected.offset;

  let end = body.length;

  for (let j = i + 1; j < sections.length; j++) {
    if (sections[j].selected) {
      end = sections[j].selected.offset;
      break;
    }
  }

  section.preview = body
    .slice(start, Math.min(end, start + 500))
    .replace(/\s+/g, " ")
    .trim();
}

//
// ------------------------------------------------------------
// VALIDATION
// ------------------------------------------------------------
//

const found = sections.filter((x) => x.status === "FOUND");
const missing = sections.filter((x) => x.status === "MISSING");
const ocrReview = sections.filter((x) => x.status === "OCR_REVIEW");
const duplicateReview = sections.filter(
  (x) => x.status === "DUPLICATE_REVIEW"
);

//
// Check monotonic ordering.
//
const orderingProblems = [];

let previousOffset = -1;

for (const section of sections) {
  if (!section.selected) continue;

  if (section.selected.offset <= previousOffset) {
    orderingProblems.push(section.number);
  }

  previousOffset = section.selected.offset;
}

//
// ------------------------------------------------------------
// OUTPUT
// ------------------------------------------------------------
//

const audit = {
  document: {
    sourceFile: "Police-Act-2020.pdf",
    normalizedFile: "Police-Act-2020.json",
    actualActStart: ACT_START,
    scheduleStart: SCHEDULE_START,
    bodyCharacters: body.length
  },

  parts,

  summary: {
    expectedSections: 142,
    detectedCandidates: candidates.length,
    found: found.length,
    missing: missing.length,
    ocrReview: ocrReview.length,
    duplicateReview: duplicateReview.length,
    orderingProblems: orderingProblems.length
  },

  sections,

  orderingProblems,

  generatedAt: new Date().toISOString()
};

fs.writeFileSync(
  OUT_FILE,
  JSON.stringify(audit, null, 2),
  "utf8"
);

//
// ------------------------------------------------------------
// CONSOLE REPORT
// ------------------------------------------------------------
//

console.log("\n========================================");
console.log("POLICE ACT V3 STRUCTURAL AUDIT");
console.log("========================================\n");

console.log(`Expected sections: ${audit.summary.expectedSections}`);
console.log(`Candidates detected: ${audit.summary.detectedCandidates}`);
console.log(`FOUND: ${audit.summary.found}`);
console.log(`MISSING: ${audit.summary.missing}`);
console.log(`OCR REVIEW: ${audit.summary.ocrReview}`);
console.log(`DUPLICATE REVIEW: ${audit.summary.duplicateReview}`);
console.log(`Ordering problems: ${audit.summary.orderingProblems}`);

console.log("\n----------------------------------------");
console.log("SECTION STATUS");
console.log("----------------------------------------");

for (const section of sections) {
  const heading = section.selected?.heading || "";

  console.log(
    `${String(section.number).padStart(3)} | ` +
      `${section.status.padEnd(17)} | ` +
      `${heading}`
  );
}

if (missing.length) {
  console.log("\n----------------------------------------");
  console.log("MISSING SECTIONS");
  console.log("----------------------------------------");

  console.log(
    missing.map((x) => x.number).join(", ")
  );
}

if (ocrReview.length) {
  console.log("\n----------------------------------------");
  console.log("OCR REVIEW");
  console.log("----------------------------------------");

  for (const section of ocrReview) {
    console.log(
      `${section.number}: ${section.selected?.heading || ""}`
    );
  }
}

if (duplicateReview.length) {
  console.log("\n----------------------------------------");
  console.log("DUPLICATE REVIEW");
  console.log("----------------------------------------");

  for (const section of duplicateReview) {
    console.log(
      `${section.number}:`,
      section.alternatives
    );
  }
}

if (orderingProblems.length) {
  console.log("\n----------------------------------------");
  console.log("ORDERING PROBLEMS");
  console.log("----------------------------------------");

  console.log(orderingProblems.join(", "));
}

console.log("\n========================================");
console.log("AUDIT COMPLETE");
console.log("========================================");

console.log(`\nOutput: ${OUT_FILE}`);