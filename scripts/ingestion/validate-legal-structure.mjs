import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import pdfParse from "pdf-parse";

const corpusDir = join(process.cwd(), "..", "..", "legal corpus");
const reportPath = join(process.cwd(), "legal-structure-report.json");

const DOCUMENT_RULES = {
  "Constitution-of-the-Federal-Republic-of-Nigeria-1999-Updated.pdf": {
    type: "constitution",
    expectedSectionMax: 320,
    requireArrangement: true,
    requireChapters: true,
    requireSchedules: true,
  },

  "FCCPA-2018.pdf": {
    type: "act",
    expectedSectionMax: 168,
    requireArrangement: true,
    requireParts: true,
    requireSchedules: true,
  },

  "Labour Act.pdf": {
    type: "act",
    expectedSectionMax: 92,
    requireArrangement: true,
    requireParts: false,
    requireSchedules: true,
  },

  "Police-Act-2020.pdf": {
    type: "act",
    expectedSectionMax: 142,
    requireArrangement: true,
    requireParts: true,
    requireSchedules: true,
  },

  "Lagos-State-Road-Traffic-Law.pdf": {
    type: "state-law",
    requireArrangement: true,
    requireParts: false,
    requireSchedules: false,
  },

  "DCRMA-COMPENDIUM_2022.pdf": {
    type: "compendium",
    requireArrangement: false,
    requireParts: false,
    requireSchedules: false,
  },

  "RC-COMPENDIUM-2024.pdf": {
    type: "compendium",
    requireArrangement: false,
    requireParts: false,
    requireSchedules: false,
  },

  "Roles-Rights-Responsibilities-Under-New-Police-Act.pdf": {
    type: "secondary",
    requireArrangement: false,
    requireParts: false,
    requireSchedules: false,
  },
};

function normalizeText(text) {
  return text
    .replace(/\u0000/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getSectionNumbers(text) {
  /*
   * Match actual legal section starts such as:
   *
   * 1. Objective.
   * 12. Quorum.
   * 35. (1) ...
   * 140.—(1) ...
   *
   * We intentionally do NOT treat every occurrence of "section 35"
   * as a section heading.
   */
  const matches = [
    ...text.matchAll(
      /(?:^|\n)\s*(\d{1,3})\s*[.:\-—–]\s*(?=[A-Z(“"'‘])/gm
    ),
  ];

  return matches.map((m) => ({
    number: Number(m[1]),
    index: m.index ?? 0,
    raw: m[0].trim(),
  }));
}

function getPartHeadings(text) {
  return [
    ...text.matchAll(
      /\bPART\s+(?:[IVXLCDM]+|[A-Z]+|\d+)\b[^\n]*/gi,
    ),
  ].map((m) => m[0].trim());
}

function getChapterHeadings(text) {
  return [
    ...text.matchAll(
      /\bCHAPTER\s+(?:[IVXLCDM]+|[A-Z]+|\d+)\b[^\n]*/gi,
    ),
  ].map((m) => m[0].trim());
}

function countPattern(text, pattern) {
  return (text.match(pattern) || []).length;
}

function getRepeatedLines(text) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length >= 8 && line.length <= 150);

  const counts = new Map();

  for (const line of lines) {
    counts.set(line, (counts.get(line) || 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= 5)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([line, count]) => ({ line, count }));
}

function detectSuspiciousPatterns(text) {
  const patterns = [
    {
      name: "replacement-character",
      regex: /\uFFFD/g,
    },
    {
      name: "broken-spaced-word",
      regex: /\b[A-Za-z]{1,4}\s+[A-Z]\s+[A-Za-z]{2,}\b/g,
    },
    {
      name: "OCR-extroordinary",
      regex: /\bExtroordinary\b/gi,
    },
    {
      name: "OCR-gotentntent",
      regex: /\bGot['’]?entntent\b/gi,
    },
    {
      name: "split-word-OF",
      regex: /\bO\s+F\b/g,
    },
    {
      name: "split-word-REPUBLIC",
      regex: /\bR\s+EPUBLIC\b/g,
    },
    {
      name: "private-use-area",
      regex: /[\uE000-\uF8FF]/g,
    },
    {
      name: "excessive-symbol-run",
      regex: /[^\p{L}\p{N}\s]{8,}/gu,
    },
  ];

  return patterns.map(({ name, regex }) => ({
    name,
    count: countPattern(text, regex),
    examples: [...text.matchAll(regex)]
      .slice(0, 5)
      .map((m) => m[0]),
  }));
}

function validateSectionSequence(sectionNumbers, expectedMax) {
  const unique = [...new Set(sectionNumbers)];

  const missing = [];
  const duplicates = [];

  if (expectedMax) {
    for (let i = 1; i <= expectedMax; i++) {
      if (!unique.includes(i)) {
        missing.push(i);
      }
    }
  }

  const counts = new Map();

  for (const number of sectionNumbers) {
    counts.set(number, (counts.get(number) || 0) + 1);
  }

  for (const [number, count] of counts) {
    if (count > 1) {
      duplicates.push({
        section: number,
        occurrences: count,
      });
    }
  }

  return {
    totalDetected: sectionNumbers.length,
    uniqueDetected: unique.length,
    firstDetected: unique.length ? Math.min(...unique) : null,
    lastDetected: unique.length ? Math.max(...unique) : null,
    missing,
    duplicates,
  };
}

function assess(result) {
  const failures = [];
  const warnings = [];

  if (result.characters === 0) {
    failures.push("No text extracted from PDF.");
  }

  if (result.words < 500 && result.rule.type !== "secondary") {
    warnings.push("Very low extracted word count.");
  }

  if (
    result.rule.requireArrangement &&
    !result.textUpper.includes("ARRANGEMENT OF SECTIONS")
  ) {
    warnings.push("ARRANGEMENT OF SECTIONS not detected.");
  }

  if (
    result.rule.requireParts &&
    result.parts.length === 0
  ) {
    warnings.push("No PART headings detected.");
  }

  if (
    result.rule.requireChapters &&
    result.chapters.length === 0
  ) {
    warnings.push("No CHAPTER headings detected.");
  }

  if (
    result.rule.requireSchedules &&
    !/\bSCHEDULES?\b/i.test(result.text)
  ) {
    warnings.push("No SCHEDULE heading detected.");
  }

  const suspiciousTotal = result.suspicious.reduce(
    (sum, item) => sum + item.count,
    0,
  );

  if (suspiciousTotal > 0) {
    warnings.push(
      `${suspiciousTotal} suspicious extraction pattern(s) detected.`,
    );
  }

  if (
    result.rule.expectedSectionMax &&
    result.sectionValidation.lastDetected !==
      result.rule.expectedSectionMax
  ) {
    warnings.push(
      `Expected final section ${result.rule.expectedSectionMax}, ` +
        `but detected final section ${result.sectionValidation.lastDetected}.`,
    );
  }

  if (
    result.rule.expectedSectionMax &&
    result.sectionValidation.missing.length > 0
  ) {
    warnings.push(
      `Possible missing sections: ${result.sectionValidation.missing
        .slice(0, 25)
        .join(", ")}` +
        (result.sectionValidation.missing.length > 25
          ? " ..."
          : ""),
    );
  }

  if (result.sectionValidation.duplicates.length > 0) {
    warnings.push(
      `Potential duplicate section headings detected: ` +
        result.sectionValidation.duplicates
          .slice(0, 10)
          .map((x) => `${x.section} (${x.occurrences}x)`)
          .join(", "),
    );
  }

  let status = "PASS";

  if (failures.length > 0) {
    status = "FAIL";
  } else if (warnings.length > 0) {
    status = "REVIEW";
  }

  return {
    status,
    failures,
    warnings,
  };
}

async function validatePdf(file) {
  const rule =
    DOCUMENT_RULES[file] || {
      type: "unknown",
      requireArrangement: false,
      requireParts: false,
      requireSchedules: false,
    };

  const filePath = join(corpusDir, file);
  const buffer = await readFile(filePath);

  let parsed;

  try {
    parsed = await pdfParse(buffer);
  } catch (error) {
    return {
      file,
      rule,
      status: "FAIL",
      error: String(error),
    };
  }

  const text = normalizeText(parsed.text || "");
  const textUpper = text.toUpperCase();

  const sections = getSectionNumbers(text);
  const sectionNumbers = sections.map((x) => x.number);

  const result = {
    file,
    rule,
    pages: parsed.numpages ?? null,
    characters: text.length,
    words: text.split(/\s+/).filter(Boolean).length,

    text,
    textUpper,

    sections,
    sectionValidation: validateSectionSequence(
      sectionNumbers,
      rule.expectedSectionMax,
    ),

    parts: getPartHeadings(text),
    chapters: getChapterHeadings(text),

    arrangementCount: countPattern(
      textUpper,
      /ARRANGEMENT\s+OF\s+SECTIONS/g,
    ),

    schedulesCount: countPattern(
      textUpper,
      /\bSCHEDULES?\b/g,
    ),

    repeatedLines: getRepeatedLines(text),

    suspicious: detectSuspiciousPatterns(text),
  };

  const assessment = assess(result);

  return {
    ...result,
    ...assessment,

    /*
     * Keep excerpts in the report for human inspection,
     * but do not store the entire PDF text.
     */
    firstExcerpt: text.slice(0, 1200),
    lastExcerpt: text.slice(-1200),

    text: undefined,
    textUpper: undefined,
    sections: undefined,
  };
}

async function main() {
  const files = (await readdir(corpusDir))
    .filter((file) => file.toLowerCase().endsWith(".pdf"))
    .sort();

  console.log(`Found ${files.length} PDFs\n`);

  const results = [];

  for (const file of files) {
    console.log(`Validating: ${file}`);

    const result = await validatePdf(file);

    results.push(result);

    console.log(`  Status:     ${result.status}`);
    console.log(`  Pages:      ${result.pages ?? "n/a"}`);
    console.log(`  Characters: ${result.characters ?? "n/a"}`);
    console.log(`  Words:      ${result.words ?? "n/a"}`);

    if (result.sectionValidation) {
      console.log(
        `  Sections:   ${result.sectionValidation.firstDetected ?? "?"}` +
          ` -> ${result.sectionValidation.lastDetected ?? "?"}` +
          ` (${result.sectionValidation.uniqueDetected} unique)`,
      );
    }

    if (result.warnings?.length) {
      console.log("  Warnings:");
      for (const warning of result.warnings) {
        console.log(`    - ${warning}`);
      }
    }

    if (result.failures?.length) {
      console.log("  Failures:");
      for (const failure of result.failures) {
        console.log(`    - ${failure}`);
      }
    }

    console.log("");
  }

  await writeFile(
    reportPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        corpusDir,
        results,
      },
      null,
      2,
    ),
    "utf8",
  );

  const pass = results.filter((x) => x.status === "PASS").length;
  const review = results.filter((x) => x.status === "REVIEW").length;
  const fail = results.filter((x) => x.status === "FAIL").length;

  console.log("=".repeat(80));
  console.log("LEGAL STRUCTURE VALIDATION SUMMARY");
  console.log("=".repeat(80));
  console.log(`PASS:   ${pass}`);
  console.log(`REVIEW: ${review}`);
  console.log(`FAIL:   ${fail}`);
  console.log(`\nReport: ${reportPath}`);

  /*
   * Do NOT make CI fail merely because a legal document needs review.
   * The purpose of this script is to identify documents requiring
   * human/legal verification before ingestion.
   */
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});