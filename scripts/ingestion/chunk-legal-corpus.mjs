import {
  readdir,
  readFile,
  writeFile,
  mkdir,
} from "node:fs/promises";
import { join, basename } from "node:path";

const normalizedDir = join(
  process.cwd(),
  "normalized-corpus",
  "normalized"
);

const chunksDir = join(
  process.cwd(),
  "normalized-corpus",
  "chunks"
);

const DOCUMENT_RULES = {
  "Constitution-of-the-Federal-Republic-of-Nigeria-1999-Updated.json":
    {
      type: "constitution",
      authorityLevel: "primary",
      jurisdiction: "federal",
    },

  "FCCPA-2018.json": {
    type: "act",
    authorityLevel: "primary",
    jurisdiction: "federal",
  },

  "Labour Act.json": {
    type: "act",
    authorityLevel: "primary",
    jurisdiction: "federal",
  },

  "Lagos-State-Road-Traffic-Law.json": {
    type: "state_act",
    authorityLevel: "primary",
    jurisdiction: "Lagos State",
  },

  "Police-Act-2020.json": {
    type: "act",
    authorityLevel: "primary",
    jurisdiction: "federal",
  },

  "DCRMA-COMPENDIUM_2022.json": {
    type: "compendium",
    authorityLevel: "secondary",
    jurisdiction: "federal",
  },

  "RC-COMPENDIUM-2024.json": {
    type: "compendium",
    authorityLevel: "secondary",
    jurisdiction: "federal",
  },

  "Roles-Rights-Responsibilities-Under-New-Police-Act.json":
    {
      type: "secondary_explanatory",
      authorityLevel: "secondary",
      jurisdiction: "federal",
    },
};

function cleanText(text) {
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/*
 * Legal section headings usually look like:
 *
 * 35. Notification of cause of arrest and rights of suspect
 *
 * We intentionally require the number at the beginning of a line.
 *
 * This prevents:
 *
 * "under section 35..."
 *
 * from becoming a new legal section.
 */
function findSectionHeadings(text) {
  const regex =
    /(?:^|\n)\s*(\d{1,3})\.\s+([^\n]{3,200})/g;

  const headings = [];

  for (const match of text.matchAll(regex)) {
    const number = Number(match[1]);
    const heading = match[2].trim();

    /*
     * Avoid obvious table-of-content continuation lines.
     *
     * This is still heuristic. Human verification remains authoritative.
     */
    if (!Number.isInteger(number)) {
      continue;
    }

    headings.push({
      section: String(number),
      heading,
      index: match.index ?? 0,
    });
  }

  return headings;
}

function findParts(text) {
  const regex =
    /(?:^|\n)\s*PART\s+([IVXLCDM]+)\b[^\n]*/gi;

  const parts = [];

  for (const match of text.matchAll(regex)) {
    parts.push({
      part: match[1].toUpperCase(),
      heading: match[0].trim(),
      index: match.index ?? 0,
    });
  }

  return parts;
}

function findChapters(text) {
  const regex =
    /(?:^|\n)\s*CHAPTER\s+([IVXLCDM]+)\b[^\n]*/gi;

  const chapters = [];

  for (const match of text.matchAll(regex)) {
    chapters.push({
      chapter: match[1].toUpperCase(),
      heading: match[0].trim(),
      index: match.index ?? 0,
    });
  }

  return chapters;
}

function findSchedules(text) {
  const regex =
    /(?:^|\n)\s*(?:THE\s+)?(?:FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH)?\s*SCHEDULE\b[^\n]*/gi;

  return [...text.matchAll(regex)].map((match) => ({
    heading: match[0].trim(),
    index: match.index ?? 0,
  }));
}

function findScheduleStart(text) {
  const chapterEight = /(?:^|\n)\s*CHAPTER\s+VIII\b/im.exec(text)
  if (!chapterEight) return null
  const searchFrom = chapterEight.index + chapterEight[0].search(/CHAPTER/i)
  const schedule = /(?:^|\n)\s*FIRST\s+SCHEDULE\s*(?:\n|$)/im.exec(text.slice(searchFrom))
  return schedule ? searchFrom + schedule.index + schedule[0].search(/FIRST\s+SCHEDULE/i) : null
}

function getPartAtIndex(parts, index, scheduleStart) {
  if (scheduleStart !== null && index >= scheduleStart) return null
  let current = null

  for (const part of parts) {
    if (part.index <= index) {
      current = part.part;
    } else {
      break;
    }
  }

  return current;
}

function getChapterAtIndex(chapters, index, scheduleStart) {
  if (scheduleStart !== null && index >= scheduleStart) return null
  let current = null

  for (const chapter of chapters) {
    if (chapter.index <= index) {
      current = chapter.chapter;
    } else {
      break;
    }
  }

  return current;
}

function createSectionChunks(text, metadata) {
  const sections = findSectionHeadings(text);
  const parts = findParts(text);
  const chapters = findChapters(text);
  const scheduleStart = metadata.sourceType === "constitution"
    ? findScheduleStart(text)
    : null

  const chunks = [];

  /*
   * If no section headings are detected, fall back to document-level
   * chunks rather than inventing legal sections.
   */
  if (sections.length === 0) {
    return [];
  }

  for (let i = 0; i < sections.length; i++) {
    const current = sections[i];
    const next = sections[i + 1];

    const start = current.index;
    const end = next ? next.index : text.length;

    const rawSectionText = text
      .slice(start, end)
      .trim();

    /*
     * Separate heading from body.
     */
    const headingMatch = rawSectionText.match(
      /^\s*\d{1,3}\.\s+([^\n]+)/
    );

    const heading = headingMatch
      ? headingMatch[1].trim()
      : current.heading;

    let body = rawSectionText;

    if (headingMatch) {
      body = rawSectionText
        .slice(headingMatch[0].length)
        .trim();
    }

    if (!body.trim() && metadata.sourceType === 'constitution') continue

    const part = getPartAtIndex(parts, current.index, scheduleStart)
    const chapter = getChapterAtIndex(chapters, current.index, scheduleStart)
    chunks.push({
      chunkType: "legal_section",

      sourceFile: metadata.sourceFile,

      sourceTitle: metadata.sourceTitle,

      sourceType: metadata.sourceType,

      authorityLevel: metadata.authorityLevel,

      jurisdiction: metadata.jurisdiction,

      enactmentYear: metadata.enactmentYear,

      verificationStatus:
        metadata.verificationStatus,

      section: current.section,

      heading,

      part,

      chapter,

      text: body,

      citation: buildCitation({
        sourceTitle: metadata.sourceTitle,
        section: current.section,
        heading,
        part,
        chapter,
      }),
    });
  }

  return chunks;
}

function buildCitation({
  sourceTitle,
  section,
  heading,
  part,
  chapter,
}) {
  const hierarchy = [];

  if (part) {
    hierarchy.push(`Part ${part}`);
  }

  if (chapter) {
    hierarchy.push(`Chapter ${chapter}`);
  }

  hierarchy.push(`Section ${section}`);

  return `${sourceTitle}, ${hierarchy.join(", ")} — ${heading}`;
}

function createFallbackChunks(text, metadata) {
  /*
   * Secondary documents and compendiums don't necessarily have legal
   * sections. We therefore chunk them by paragraph groups.
   */

  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks = [];

  const TARGET = 1800;

  let current = "";

  for (const paragraph of paragraphs) {
    if (
      current.length > 0 &&
      current.length + paragraph.length > TARGET
    ) {
      chunks.push({
        chunkType: "document_context",

        sourceFile: metadata.sourceFile,

        sourceTitle: metadata.sourceTitle,

        sourceType: metadata.sourceType,

        authorityLevel: metadata.authorityLevel,

        jurisdiction: metadata.jurisdiction,

        enactmentYear: metadata.enactmentYear,

        verificationStatus:
          metadata.verificationStatus,

        section: null,

        heading: null,

        part: null,

        chapter: null,

        text: current.trim(),

        citation:
          `${metadata.sourceTitle} — ` +
          `supporting material`,
      });

      current = "";
    }

    current += `${paragraph}\n\n`;
  }

  if (current.trim()) {
    chunks.push({
      chunkType: "document_context",

      sourceFile: metadata.sourceFile,

      sourceTitle: metadata.sourceTitle,

      sourceType: metadata.sourceType,

      authorityLevel: metadata.authorityLevel,

      jurisdiction: metadata.jurisdiction,

      enactmentYear: metadata.enactmentYear,

      verificationStatus:
        metadata.verificationStatus,

      section: null,

      heading: null,

      part: null,

      chapter: null,

      text: current.trim(),

      citation:
        `${metadata.sourceTitle} — ` +
        `supporting material`,
    });
  }

  return chunks;
}

async function processDocument(file) {
  const path = join(normalizedDir, file);

  const document = JSON.parse(
    await readFile(path, "utf8")
  );

  const metadata = document.metadata;

  const text = cleanText(
    document.content.normalizedText
  );

  const rule = DOCUMENT_RULES[file];

  if (!rule) {
    console.log(`Skipping unknown document: ${file}`);
    return null;
  }

  let chunks;

  if (
    rule.type === "act" ||
    rule.type === "state_act" ||
    rule.type === "constitution"
  ) {
    chunks = createSectionChunks(
      text,
      metadata
    );

    /*
     * Constitution and poorly extracted Acts can produce zero section
     * chunks. Don't invent structure.
     */
    if (chunks.length === 0) {
      chunks = createFallbackChunks(
        text,
        metadata
      );
    }
  } else {
    chunks = createFallbackChunks(
      text,
      metadata
    );
  }

  const output = {
    source: metadata,

    chunking: {
      strategy:
        chunks[0]?.chunkType === "legal_section"
          ? "section-aware"
          : "paragraph-group",
      chunkCount: chunks.length,
    },

    chunks,
  };

  const outputFile =
    `${basename(file, ".json")}.chunks.json`;

  await writeFile(
    join(chunksDir, outputFile),
    JSON.stringify(output, null, 2),
    "utf8"
  );

  console.log(
    `${file}: ${chunks.length} chunks`
  );

  return output;
}

async function main() {
  await mkdir(chunksDir, {
    recursive: true,
  });

  const requestedFile = process.argv[2];
  const files = (await readdir(normalizedDir))
    .filter((file) =>
      file.endsWith(".json")
    )
    .filter((file) => !requestedFile || file === requestedFile)
    .sort();

  const manifest = [];

  for (const file of files) {
    try {
      const result =
        await processDocument(file);

      if (result) {
        manifest.push({
          file,
          chunks: result.chunking.chunkCount,
          strategy:
            result.chunking.strategy,
        });
      }
    } catch (error) {
      console.error(
        `ERROR processing ${file}`
      );

      console.error(error);

      manifest.push({
        file,
        error: String(error),
      });
    }
  }

  const manifestPath = join(chunksDir, "chunking-manifest.json");
  let manifestDocuments = manifest;
  if (requestedFile) {
    try {
      const existingManifest = JSON.parse(await readFile(manifestPath, "utf8"));
      manifestDocuments = [
        ...(existingManifest.documents ?? []).filter((entry) => entry.file !== requestedFile),
        ...manifest,
      ];
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }

  await writeFile(
    manifestPath,
    JSON.stringify(
      {
        documents: manifestDocuments,
      },
      null,
      2
    ),
    "utf8"
  );

  console.log("\n========================================");
  console.log("CHUNKING COMPLETE");
  console.log("========================================");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});