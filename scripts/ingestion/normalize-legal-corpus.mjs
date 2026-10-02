import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { join, basename } from "node:path";
import pdfParse from "pdf-parse";

const corpusDir = join(process.cwd(), "..", "..", "legal corpus");
const outputDir = join(process.cwd(), "normalized-corpus");
const rawDir = join(outputDir, "raw");
const normalizedDir = join(outputDir, "normalized");

const DOCUMENT_RULES = {
  "Constitution-of-the-Federal-Republic-of-Nigeria-1999-Updated.pdf": {
    documentType: "constitution",
    authorityLevel: "primary",
    jurisdiction: "federal",
    title: "Constitution of the Federal Republic of Nigeria 1999",
    year: 1999,
  },

  "FCCPA-2018.pdf": {
    documentType: "act",
    authorityLevel: "primary",
    jurisdiction: "federal",
    title: "Federal Competition and Consumer Protection Act",
    year: 2018,
    expectedLastSection: 163,
  },

  "Labour Act.pdf": {
    documentType: "act_with_subsidiary",
    authorityLevel: "primary",
    jurisdiction: "federal",
    title: "Labour Act",
    year: null,
  },

  "Lagos-State-Road-Traffic-Law.pdf": {
    documentType: "state_act_with_subsidiary",
    authorityLevel: "primary",
    jurisdiction: "Lagos State",
    title: "Lagos State Road Traffic Law",
    year: 2012,
  },

  "Police-Act-2020.pdf": {
    documentType: "act",
    authorityLevel: "primary",
    jurisdiction: "federal",
    title: "Nigeria Police Act",
    year: 2020,
    expectedLastSection: 142,
  },

  "DCRMA-COMPENDIUM_2022.pdf": {
    documentType: "compendium",
    authorityLevel: "secondary",
    jurisdiction: "federal",
    title: "DCRMA Compendium",
    year: 2022,
  },

  "RC-COMPENDIUM-2024.pdf": {
    documentType: "compendium",
    authorityLevel: "secondary",
    jurisdiction: "federal",
    title: "RC Compendium",
    year: 2024,
  },

  "Roles-Rights-Responsibilities-Under-New-Police-Act.pdf": {
    documentType: "secondary_explanatory",
    authorityLevel: "secondary",
    jurisdiction: "federal",
    title: "Roles, Rights and Responsibilities Under the New Police Act",
    year: 2020,
  },
};

function normalizeWhitespace(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeLine(line) {
  return line
    .replace(/[ \t]+/g, " ")
    .trim();
}

function normalizeLines(text) {
  return text
    .split("\n")
    .map(normalizeLine)
    .filter(Boolean)
    .join("\n");
}

/*
 * IMPORTANT:
 *
 * We deliberately do NOT perform OCR correction here.
 *
 * Examples such as:
 *   Cornpetition -> Competition
 *   Consurner -> Consumer
 *   Palice -> Police
 *
 * are NOT automatically changed.
 *
 * Legal text must not be silently rewritten.
 */

function detectPoliceCorruptedTail(text) {
  const markers = [
    "VLo o)",
    "weamieq",
    "dystouied",
    "dystouied",
  ];

  let earliest = -1;

  for (const marker of markers) {
    const index = text.indexOf(marker);

    if (index !== -1 && (earliest === -1 || index < earliest)) {
      earliest = index;
    }
  }

  return earliest;
}

function splitPoliceAct(text) {
  const tailIndex = detectPoliceCorruptedTail(text);

  if (tailIndex === -1) {
    return {
      mainText: text,
      excludedText: "",
      boundary: null,
    };
  }

  return {
    mainText: text.slice(0, tailIndex).trim(),
    excludedText: text.slice(tailIndex).trim(),
    boundary: {
      type: "corrupted_pdf_text_layer",
      index: tailIndex,
    },
  };
}

function splitSubsidiaryMaterial(text, file) {
  /*
   * These boundaries are intentionally conservative.
   *
   * We do NOT delete anything.
   * We separate suspected subsidiary material so that it can later receive
   * its own legal-source metadata.
   */

  const patterns = [];

  if (file === "Labour Act.pdf") {
    patterns.push(
      /\n\s*DOCK LABOUR\s*\(REGISTRATION AND CONTROL OF EMPLOYMENT\)\s*RULES\b/i,
      /\n\s*DOCK LABOUR RULES\b/i
    );
  }

  if (file === "Lagos-State-Road-Traffic-Law.pdf") {
    patterns.push(
      /\n\s*REGULATIONS\b/i
    );
  }

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match && match.index !== undefined) {
      return {
        mainText: text.slice(0, match.index).trim(),
        subsidiaryText: text.slice(match.index).trim(),
        boundary: {
          type: "suspected_subsidiary_legislation",
          marker: match[0].trim(),
          index: match.index,
        },
      };
    }
  }

  return {
    mainText: text,
    subsidiaryText: "",
    boundary: null,
  };
}

function detectStructure(text, rule) {
  const structure = {
    arrangementOfSections: /ARRANGEMENT\s+OF\s+SECTIONS/i.test(text),
    parts: [],
    chapters: [],
    schedules: [],
    sections: [],
  };

  const partMatches = [
    ...text.matchAll(
      /(?:^|\n)\s*PART\s+([IVXLCDM]+)\b[^\n]*/gi
    ),
  ];

  structure.parts = [
    ...new Set(
      partMatches
        .map((m) => m[1].toUpperCase())
        .filter(Boolean)
    ),
  ];

  const chapterMatches = [
    ...text.matchAll(
      /(?:^|\n)\s*CHAPTER\s+([IVXLCDM]+)\b[^\n]*/gi
    ),
  ];

  structure.chapters = [
    ...new Set(
      chapterMatches
        .map((m) => m[1].toUpperCase())
        .filter(Boolean)
    ),
  ];

  const scheduleMatches = [
    ...text.matchAll(
      /(?:^|\n)\s*(?:THE\s+)?(?:FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH)?\s*SCHEDULE\b[^\n]*/gi
    ),
  ];

  structure.schedules = scheduleMatches.map(
    (m) => m[0].trim()
  );

  /*
   * This is only a structural hint.
   * It is NOT used to decide whether sections are missing.
   */
  const sectionMatches = [
    ...text.matchAll(
      /(?:^|\n)\s*(\d{1,3})\.\s+([A-Z][^\n]{2,180})/g
    ),
  ];

  structure.sections = [
    ...new Set(
      sectionMatches
        .map((m) => Number(m[1]))
        .filter(Number.isInteger)
    ),
  ].sort((a, b) => a - b);

  if (rule.expectedLastSection) {
    structure.expectedLastSection = rule.expectedLastSection;
  }

  return structure;
}

function createMetadata(file, rule, parsed, boundaries) {
  return {
    sourceFile: file,

    sourceTitle: rule.title,

    sourceType: rule.documentType,

    authorityLevel: rule.authorityLevel,

    jurisdiction: rule.jurisdiction,

    enactmentYear: rule.year,

    publicationDate: null,

    version: null,

    amendedBy: [],

    effectiveDate: null,

    officialSourceUrl: null,

    verificationStatus: "unverified",

    extraction: {
      parser: "pdf-parse",
      pages: parsed.numpages,
      rawCharacters: parsed.text?.length ?? 0,
      rawWords:
        parsed.text?.split(/\s+/).filter(Boolean).length ?? 0,
    },

    boundaries,
  };
}

async function processFile(file) {
  const rule = DOCUMENT_RULES[file];

  if (!rule) {
    console.log(`Skipping unclassified file: ${file}`);
    return null;
  }

  console.log(`\nProcessing: ${file}`);

  const pdfPath = join(corpusDir, file);
  const buffer = await readFile(pdfPath);

  const parsed = await pdfParse(buffer);

  const rawText = parsed.text || "";

  /*
   * Save EXACT extracted text before normalization.
   */
  const rawOutputName = `${basename(file, ".pdf")}.raw.txt`;

  await writeFile(
    join(rawDir, rawOutputName),
    rawText,
    "utf8"
  );

  let workingText = normalizeWhitespace(rawText);

  const boundaries = {};

  /*
   * Police Act special handling.
   */
  if (file === "Police-Act-2020.pdf") {
    const police = splitPoliceAct(workingText);

    workingText = police.mainText;

    boundaries.policeCorruptedTail = police.boundary;

    if (police.excludedText) {
      const excludedName =
        `${basename(file, ".pdf")}.excluded.txt`;

      await writeFile(
        join(rawDir, excludedName),
        police.excludedText,
        "utf8"
      );
    }
  }

  /*
   * Labour Act / Lagos Traffic Law.
   */
  if (
    file === "Labour Act.pdf" ||
    file === "Lagos-State-Road-Traffic-Law.pdf"
  ) {
    const subsidiary = splitSubsidiaryMaterial(
      workingText,
      file
    );

    workingText = subsidiary.mainText;

    boundaries.subsidiary = subsidiary.boundary;

    if (subsidiary.subsidiaryText) {
      const subsidiaryName =
        `${basename(file, ".pdf")}.subsidiary.txt`;

      await writeFile(
        join(rawDir, subsidiaryName),
        subsidiary.subsidiaryText,
        "utf8"
      );
    }
  }

  workingText = normalizeLines(workingText);

  const metadata = createMetadata(
    file,
    rule,
    parsed,
    boundaries
  );

  const structure = detectStructure(
    workingText,
    rule
  );

  const document = {
    metadata,

    structure,

    content: {
      normalizedText: workingText,
    },
  };

  const jsonName =
    `${basename(file, ".pdf")}.json`;

  await writeFile(
    join(normalizedDir, jsonName),
    JSON.stringify(document, null, 2),
    "utf8"
  );

  console.log(`Pages: ${parsed.numpages}`);
  console.log(`Raw characters: ${rawText.length}`);
  console.log(`Normalized characters: ${workingText.length}`);
  console.log(
    `Sections detected: ${structure.sections.length}`
  );
  console.log(
    `Parts detected: ${structure.parts.length}`
  );
  console.log(
    `Schedules detected: ${structure.schedules.length}`
  );

  if (boundaries.policeCorruptedTail) {
    console.log(
      "⚠ Police Act corrupted extraction tail excluded."
    );
  }

  if (boundaries.subsidiary) {
    console.log(
      "⚠ Suspected subsidiary legislation separated."
    );
  }

  return document;
}

async function main() {
  await mkdir(rawDir, { recursive: true });
  await mkdir(normalizedDir, { recursive: true });

  const files = (await readdir(corpusDir))
    .filter((file) => file.toLowerCase().endsWith(".pdf"))
    .sort();

  console.log(`Found ${files.length} PDFs`);

  const results = [];

  for (const file of files) {
    try {
      const result = await processFile(file);

      if (result) {
        results.push({
          file,
          status: "processed",
          pages: result.metadata.extraction.pages,
          sourceType: result.metadata.sourceType,
          authorityLevel:
            result.metadata.authorityLevel,
        });
      }
    } catch (error) {
      console.error(`ERROR processing ${file}`);
      console.error(error);

      results.push({
        file,
        status: "failed",
        error: String(error),
      });
    }
  }

  await writeFile(
    join(outputDir, "normalization-manifest.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        parser: "pdf-parse",
        documents: results,
      },
      null,
      2
    ),
    "utf8"
  );

  console.log("\n========================================");
  console.log("NORMALIZATION COMPLETE");
  console.log("========================================");
  console.log(`Output: ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});