import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import pdfParse from "pdf-parse";

const corpusDir = join(process.cwd(), "..", "..", "legal corpus");

const DOCUMENT_RULES = {
  "Constitution-of-the-Federal-Republic-of-Nigeria-1999-Updated.pdf": {
    type: "constitution",
    requiredPatterns: [
      /CHAPTER I/i,
      /CHAPTER II/i,
      /CHAPTER III/i,
      /FIRST SCHEDULE/i,
      /SECOND SCHEDULE/i,
      /THIRD SCHEDULE/i,
      /FOURTH SCHEDULE/i,
      /FIFTH SCHEDULE/i,
      /SIXTH SCHEDULE/i,
      /SEVENTH SCHEDULE/i,
    ],
  },

  "FCCPA-2018.pdf": {
    type: "act",
    expectedLastSection: 163,
    requiredPatterns: [
      /ARRANGEMENT OF SECTIONS/i,
      /PART I/i,
      /PART II/i,
      /PART III/i,
      /SCHEDULE/i,
    ],
  },

  "Labour Act.pdf": {
    type: "act_with_subsidiary",
    expectedLastSection: 91,
    requiredPatterns: [
      /ARRANGEMENT OF SECTIONS/i,
      /PART I/i,
      /PART II/i,
      /PART III/i,
    ],
  },

  "Lagos-State-Road-Traffic-Law.pdf": {
    type: "state_act_with_subsidiary",
    requiredPatterns: [
      /ROAD TRAFFIC LAW/i,
      /ARRANGEMENT OF SECTIONS/i,
      /REGULATIONS/i,
    ],
  },

  "Police-Act-2020.pdf": {
    type: "act",
    expectedLastSection: 142,
    requiredPatterns: [
      /NIGERIA POLICE ACT/i,
      /ARRANGEMENT OF SECTIONS/i,
      /PART I/i,
      /PART II/i,
      /PART XVII/i,
      /SCHEDULE/i,
    ],
  },

  "DCRMA-COMPENDIUM_2022.pdf": {
    type: "compendium",
    requiredPatterns: [
      /FRSC/i,
      /COMPENDIUM/i,
    ],
  },

  "RC-COMPENDIUM-2024.pdf": {
    type: "compendium",
    requiredPatterns: [
      /COMPENDIUM/i,
      /HIGHWAY CODE/i,
    ],
  },

  "Roles-Rights-Responsibilities-Under-New-Police-Act.pdf": {
    type: "secondary_explanatory",
    requiredPatterns: [
      /POLICE ACT/i,
      /ROLES/i,
      /RIGHTS/i,
      /RESPONSIBILITIES/i,
    ],
  },
};

function normalizeText(text) {
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function countWords(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

function findAll(text, regex) {
  return [...text.matchAll(regex)].map((m) => ({
    index: m.index ?? -1,
    match: m[0],
  }));
}

function uniqueNumbers(numbers) {
  return [...new Set(numbers)].sort((a, b) => a - b);
}

/**
 * Extract only section-heading-looking occurrences.
 *
 * We deliberately require the number to appear at the beginning of a line
 * or after substantial whitespace. This prevents most subsection references
 * such as "under section 23" from being interpreted as a new section.
 */
function detectSectionHeadings(text) {
  const matches = findAll(
    text,
    /(?:^|\n)\s*(\d{1,3})\.\s+([A-Z][^\n]{2,180})/g
  );

  return matches.map((m) => {
    const match = m.match.match(/^\s*(\d{1,3})\.\s+(.+)$/s);

    return {
      number: match ? Number(match[1]) : null,
      heading: match ? match[2].trim() : "",
      index: m.index,
    };
  });
}

function detectParts(text) {
  const matches = findAll(
    text,
    /(?:^|\n)\s*PART\s+([IVXLCDM]+)\b[^\n]*/gi
  );

  return matches.map((m) => ({
    part: m.match.match(/PART\s+([IVXLCDM]+)/i)?.[1] ?? "",
    heading: m.match.trim(),
    index: m.index,
  }));
}

function detectChapters(text) {
  const matches = findAll(
    text,
    /(?:^|\n)\s*CHAPTER\s+([IVXLCDM]+)\b[^\n]*/gi
  );

  return matches.map((m) => ({
    chapter: m.match.match(/CHAPTER\s+([IVXLCDM]+)/i)?.[1] ?? "",
    heading: m.match.trim(),
    index: m.index,
  }));
}

function detectSchedules(text) {
  const matches = findAll(
    text,
    /(?:^|\n)\s*(?:THE\s+)?(?:FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH)?\s*SCHEDULE\b[^\n]*/gi
  );

  return matches.map((m) => ({
    heading: m.match.trim(),
    index: m.index,
  }));
}

function findArrangementBoundary(text) {
  const match = text.match(
    /(?:^|\n)\s*ARRANGEMENT\s+OF\s+SECTIONS\b/i
  );

  return match ? match.index ?? -1 : -1;
}

function findFirstSubstantiveSection(text) {
  const match = text.match(
    /(?:^|\n)\s*1\.\s+[A-Z][^\n]{2,180}/
  );

  return match ? match.index ?? -1 : -1;
}

function findPoliceActTail(text) {
  /*
   * The Ministry PDF contains a valid legal ending followed by a corrupted
   * reversed/garbled text layer. We don't rewrite the source; we only flag
   * the suspicious tail so ingestion can exclude it.
   */
  const markers = [
    "VLo o)",
    "weamieq",
    "dystouied",
  ];

  for (const marker of markers) {
    const index = text.indexOf(marker);

    if (index !== -1) {
      return index;
    }
  }

  return -1;
}

function detectSuspiciousPatterns(text) {
  const suspicious = [];

  const patterns = [
    {
      name: "private_use_font_warning_pattern",
      regex: /private use area/i,
    },
    {
      name: "reversed_or_garbled_tail",
      regex: /VLo\s+o\)|weamieq|dystouied/i,
    },
    {
      name: "excessive_replacement_characters",
      regex: / {3,}/,
    },
    {
      name: "obvious_encoding_corruption",
      regex: /[â€™â€œâ€]/,
    },
  ];

  for (const pattern of patterns) {
    const matches = text.match(pattern.regex);

    if (matches) {
      suspicious.push({
        type: pattern.name,
        sample: matches[0],
      });
    }
  }

  return suspicious;
}

function validateDocument(file, text) {
  const rule = DOCUMENT_RULES[file];

  if (!rule) {
    return {
      file,
      status: "UNCLASSIFIED",
      reason: "No document rule defined.",
    };
  }

  const normalized = normalizeText(text);

  const result = {
    file,
    type: rule.type,
    pages: null,
    characters: normalized.length,
    words: countWords(normalized),
    status: "PASS",
    warnings: [],
    structure: {},
  };

  for (const pattern of rule.requiredPatterns ?? []) {
    if (!pattern.test(normalized)) {
      result.status = "REVIEW";
      result.warnings.push(
        `Required structural pattern not found: ${pattern}`
      );
    }
  }

  const arrangementIndex = findArrangementBoundary(normalized);
  const firstSectionIndex = findFirstSubstantiveSection(normalized);

  result.structure.arrangementFound = arrangementIndex !== -1;
  result.structure.firstSectionFound = firstSectionIndex !== -1;

  if (rule.type === "act" || rule.type === "act_with_subsidiary") {
    const sections = detectSectionHeadings(normalized);

    const sectionNumbers = uniqueNumbers(
      sections
        .map((s) => s.number)
        .filter((n) => Number.isInteger(n))
    );

    result.structure.detectedSectionCount = sections.length;
    result.structure.uniqueSectionCount = sectionNumbers.length;
    result.structure.firstDetectedSection = sectionNumbers[0] ?? null;
    result.structure.lastDetectedSection =
      sectionNumbers[sectionNumbers.length - 1] ?? null;

    if (rule.expectedLastSection) {
      result.structure.expectedLastSection = rule.expectedLastSection;

      /*
       * Do NOT fail just because the crude detector doesn't find every
       * section. We only flag a discrepancy for manual review.
       */
      if (
        result.structure.lastDetectedSection !== rule.expectedLastSection
      ) {
        result.status = "REVIEW";
        result.warnings.push(
          `Detected last section ${result.structure.lastDetectedSection}; expected approximately ${rule.expectedLastSection}.`
        );
      }
    }

    result.structure.parts = detectParts(normalized).map(
      (p) => p.part
    );

    result.structure.schedules = detectSchedules(normalized).length;
  }

  if (rule.type === "constitution") {
    result.structure.chapters = detectChapters(normalized).map(
      (c) => c.chapter
    );

    result.structure.schedules = detectSchedules(normalized).length;
  }

  if (rule.type === "compendium") {
    result.structure.parts = detectParts(normalized).length;
    result.structure.chapters = detectChapters(normalized).length;
    result.structure.schedules = detectSchedules(normalized).length;
  }

  if (rule.type === "secondary_explanatory") {
    result.structure.parts = detectParts(normalized).length;
    result.structure.chapters = detectChapters(normalized).length;
  }

  const suspicious = detectSuspiciousPatterns(normalized);

  if (suspicious.length) {
    result.status = "REVIEW";
    result.warnings.push(
      ...suspicious.map(
        (item) => `Suspicious extraction pattern: ${item.type}`
      )
    );

    result.structure.suspicious = suspicious;
  }

  if (file === "Police-Act-2020.pdf") {
    const tailIndex = findPoliceActTail(normalized);

    if (tailIndex !== -1) {
      result.status = "REVIEW";

      result.structure.corruptedTailDetected = true;
      result.structure.corruptedTailIndex = tailIndex;

      result.warnings.push(
        "Potential corrupted PDF text layer detected after the valid legal content. Preserve raw PDF; exclude the corrupted tail during normalization."
      );
    } else {
      result.structure.corruptedTailDetected = false;
    }
  }

  return result;
}

async function main() {
  const files = (await readdir(corpusDir))
    .filter((file) => file.toLowerCase().endsWith(".pdf"))
    .sort();

  const report = [];

  console.log(`Found ${files.length} PDFs\n`);

  for (const file of files) {
    console.log("=".repeat(80));
    console.log(file);
    console.log("=".repeat(80));

    try {
      const buffer = await readFile(join(corpusDir, file));
      const parsed = await pdfParse(buffer);

      const result = validateDocument(file, parsed.text || "");

      result.pages = parsed.numpages;

      report.push(result);

      console.log(`Type:       ${result.type}`);
      console.log(`Pages:      ${result.pages}`);
      console.log(`Characters: ${result.characters}`);
      console.log(`Words:      ${result.words}`);
      console.log(`Status:     ${result.status}`);

      if (result.structure.lastDetectedSection) {
        console.log(
          `Last section detected: ${result.structure.lastDetectedSection}`
        );
      }

      if (result.structure.corruptedTailDetected) {
        console.log("⚠ Corrupted extraction tail detected");
      }

      if (result.warnings.length) {
        console.log("\nWarnings:");

        for (const warning of result.warnings) {
          console.log(`- ${warning}`);
        }
      }

      console.log();
    } catch (error) {
      console.error(`ERROR processing ${file}`);
      console.error(error);

      report.push({
        file,
        status: "FAIL",
        error: String(error),
      });
    }
  }

  const outputPath = join(process.cwd(), "legal-structure-report-v2.json");

  await writeFile(
    outputPath,
    JSON.stringify(report, null, 2),
    "utf8"
  );

  console.log("=".repeat(80));
  console.log(`Report written to: ${outputPath}`);
  console.log("=".repeat(80));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});