import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const INPUT = path.join(
  ROOT,
  "normalized-corpus",
  "normalized",
  "Police-Act-2020.json"
);

const OUTPUT_DIR = path.join(
  ROOT,
  "normalized-corpus",
  "chunks-v4"
);

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const data = JSON.parse(fs.readFileSync(INPUT, "utf8"));
const fullText = data.content.normalizedText;

const ACT_START = fullText.indexOf(
  "ENACTED by the National Assembly"
);

if (ACT_START === -1) {
  throw new Error("Could not locate Act start.");
}

/*
 * Find SCHEDULE only after the substantive body.
 * The TOC also contains the word SCHEDULE.
 */
const scheduleMatches = [...fullText.matchAll(/\nSCHEDULE\b/gi)]
  .map(m => m.index)
  .filter(i => i > ACT_START + 10000);

if (!scheduleMatches.length) {
  throw new Error("Could not locate Schedule.");
}

const SCHEDULE_START = scheduleMatches[0];

const body = fullText.slice(ACT_START, SCHEDULE_START);

console.log("========================================");
console.log("POLICE ACT V4 STRUCTURAL CHUNKER");
console.log("========================================");
console.log(`Act start: ${ACT_START}`);
console.log(`Schedule start: ${SCHEDULE_START}`);
console.log(`Body characters: ${body.length}`);
console.log();

/*
 * The PDF extraction has two major patterns:
 *
 *   41. A judge...
 *
 * and:
 *
 *   50.
 *   (1)
 *   Where
 *   a
 *   police
 *   officer...
 *
 * We therefore detect section numbers broadly and
 * then score each candidate.
 */

function normalizeForDetection(text) {
  return text
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ");
}

/*
 * Candidate section numbers.
 *
 * We deliberately allow:
 *
 *   41.
 *   42,
 *   120
 *
 * because the PDF extraction is inconsistent.
 */
const candidateRegex =
  /(?:^|\n)\s*(\d{1,3})\s*[.,]?\s*(?=\n|[A-Za-z([])/g;

const candidates = [];

for (const match of body.matchAll(candidateRegex)) {
  const number = Number(match[1]);

  if (number < 1 || number > 142) continue;

  const index = match.index;

  candidates.push({
    number,
    index,
    raw: match[0]
  });
}

console.log(`Raw numeric candidates: ${candidates.length}`);

/*
 * Remove obvious TOC/header runs.
 *
 * Example:
 *
 * 97.
 * 98.
 * 99.
 * 100.
 * State;
 *
 * These are not four consecutive substantive section
 * starts.
 */
function looksLikeNumericRun(candidateIndex) {
  const window = body.slice(candidateIndex, candidateIndex + 300);

  const nums = [...window.matchAll(
    /(?:^|\n)\s*(\d{1,3})\s*[.,]?\s*(?=\n|[A-Za-z([])/g
  )];

  if (nums.length < 4) return false;

  const values = nums
    .slice(0, 5)
    .map(x => Number(x[1]));

  let consecutive = 0;

  for (let i = 1; i < values.length; i++) {
    if (values[i] === values[i - 1] + 1) {
      consecutive++;
    }
  }

  return consecutive >= 3;
}

/*
 * Reject candidates that are clearly inside a
 * subsection/reference rather than a section boundary.
 */
function scoreCandidate(candidate) {
  const { number, index } = candidate;

  let score = 0;

  const before = body.slice(Math.max(0, index - 500), index);
  const after = body.slice(index, index + 500);

  /*
   * Strong signal:
   *
   * "41. A judge..."
   */
  if (/^\s*[.,]?\s*[A-Za-z([]/.test(
    after.replace(/^\s*/, "")
  )) {
    score += 2;
  }

  /*
   * Strong signal:
   *
   * "50.\n(1)\nWhere..."
   */
  if (/^\s*[.,]?\s*\n\s*\(\s*1\s*\)/.test(after)) {
    score += 4;
  }

  /*
   * Another strong signal:
   * section starts are usually preceded by a completed
   * paragraph/subsection.
   */
  if (/\)\s*$/.test(before.trim())) {
    score += 2;
  }

  /*
   * Penalize obvious numeric TOC runs.
   */
  if (looksLikeNumericRun(index)) {
    score -= 10;
  }

  /*
   * Penalize numbers that look like subsection references.
   */
  if (/\bsection\s*$/i.test(before.slice(-20))) {
    score -= 4;
  }

  return score;
}

const scored = candidates.map(c => ({
  ...c,
  score: scoreCandidate(c)
}));

/*
 * Group candidates by section number.
 */
const byNumber = new Map();

for (const candidate of scored) {
  if (!byNumber.has(candidate.number)) {
    byNumber.set(candidate.number, []);
  }

  byNumber.get(candidate.number).push(candidate);
}

/*
 * Select candidates sequentially.
 *
 * We expect:
 *
 * 1,2,3,4,...142
 *
 * rather than simply selecting the highest-scoring
 * occurrence of every number.
 */
const selected = [];

let previousIndex = -1;

for (let section = 1; section <= 142; section++) {
  const options = (byNumber.get(section) || [])
    .filter(c => c.index > previousIndex);

  if (!options.length) {
    selected.push({
      number: section,
      status: "MISSING"
    });
    continue;
  }

  /*
   * Prefer candidates that:
   * - occur after previous section
   * - have stronger structural scores
   * - are not extremely close to previous candidate
   */
  const ranked = [...options].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    return a.index - b.index;
  });

  const chosen = ranked[0];

  selected.push({
    ...chosen,
    status: "FOUND"
  });

  previousIndex = chosen.index;
}

console.log();
console.log("SECTION DETECTION");
console.log("----------------------------------------");

for (const item of selected) {
  if (item.status === "FOUND") {
    console.log(
      `${String(item.number).padStart(3)} | FOUND | offset=${item.index} | score=${item.score}`
    );
  } else {
    console.log(
      `${String(item.number).padStart(3)} | MISSING`
    );
  }
}

/*
 * Build chunks only from reliable sequential boundaries.
 *
 * We do NOT try to OCR-correct the text.
 */
const found = selected.filter(
  x => x.status === "FOUND"
);

const chunks = [];

for (let i = 0; i < found.length; i++) {
  const current = found[i];
  const next = found[i + 1];

  const start = current.index;
  const end = next ? next.index : body.length;

  let text = body.slice(start, end).trim();

  /*
   * Remove obvious trailing TOC/header noise immediately
   * before the next section where possible.
   *
   * Do not perform word-level corrections.
   */
  text = text.replace(/\n{3,}/g, "\n\n");

  chunks.push({
    chunkType: "section",
    sectionNumber: current.number,
    sourceTitle: "Nigeria Police Act, 2020",
    authorityLevel: "primary",
    verificationStatus: "unverified",
    extractionMethod: "pdf-text",
    startOffset: start,
    endOffset: end,
    detectionScore: current.score,
    text
  });
}

/*
 * Validation.
 */
const expected = Array.from({ length: 142 }, (_, i) => i + 1);

const foundNumbers = found.map(x => x.number);

const missing = expected.filter(
  n => !foundNumbers.includes(n)
);

const duplicates = foundNumbers.filter(
  (n, i) => foundNumbers.indexOf(n) !== i
);

const orderingProblems = [];

for (let i = 1; i < foundNumbers.length; i++) {
  if (foundNumbers[i] <= foundNumbers[i - 1]) {
    orderingProblems.push(
      `${foundNumbers[i - 1]} -> ${foundNumbers[i]}`
    );
  }
}

console.log();
console.log("========================================");
console.log("VALIDATION");
console.log("========================================");
console.log(`Expected sections: 142`);
console.log(`Found sections: ${found.length}`);
console.log(`Missing: ${missing.length}`);
console.log(`Duplicates: ${duplicates.length}`);
console.log(`Ordering problems: ${orderingProblems.length}`);

if (missing.length) {
  console.log();
  console.log("Missing sections:");
  console.log(missing.join(", "));
}

if (duplicates.length) {
  console.log();
  console.log("Duplicate sections:");
  console.log([...new Set(duplicates)].join(", "));
}

if (orderingProblems.length) {
  console.log();
  console.log("Ordering problems:");
  console.log(orderingProblems.join(", "));
}

/*
 * Save diagnostic structure report.
 */
const report = {
  source: "Police-Act-2020.json",
  sourceTitle: "Nigeria Police Act, 2020",
  actStart: ACT_START,
  scheduleStart: SCHEDULE_START,
  bodyLength: body.length,
  expectedSections: 142,
  foundSections: found.length,
  missing,
  duplicates: [...new Set(duplicates)],
  orderingProblems,
  sections: selected
};

fs.writeFileSync(
  path.join(
    OUTPUT_DIR,
    "Police-Act-2020.structure-report.json"
  ),
  JSON.stringify(report, null, 2),
  "utf8"
);

/*
 * Save chunks.
 */
fs.writeFileSync(
  path.join(
    OUTPUT_DIR,
    "Police-Act-2020.chunks.json"
  ),
  JSON.stringify(
    {
      metadata: {
        sourceTitle: "Nigeria Police Act, 2020",
        authorityLevel: "primary",
        jurisdiction: "Nigeria",
        year: 2020,
        verificationStatus: "unverified",
        sourceFile: "Police-Act-2020.pdf"
      },
      chunks
    },
    null,
    2
  ),
  "utf8"
);

console.log();
console.log("Output:");
console.log(
  path.join(
    OUTPUT_DIR,
    "Police-Act-2020.chunks.json"
  )
);

console.log();
console.log("========================================");
console.log("V4 COMPLETE");
console.log("========================================");