import fs from "fs";
import path from "path";

const inputPath = path.join(
  process.cwd(),
  "normalized-corpus",
  "normalized",
  "Police-Act-2020.json"
);

const outputDir = path.join(
  process.cwd(),
  "normalized-corpus",
  "chunks-v2"
);

fs.mkdirSync(outputDir, { recursive: true });

const data = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const fullText = data.content.normalizedText;

const ACT_START = fullText.indexOf(
  "ENACTED by the National Assembly"
);

const SCHEDULE_START = fullText.indexOf("SCHEDULE");

if (ACT_START === -1) {
  throw new Error("Could not find actual Act start.");
}

if (SCHEDULE_START === -1) {
  throw new Error("Could not find Schedule.");
}

console.log("Actual Act marker:", ACT_START);
console.log("Schedule marker:", SCHEDULE_START);

// ------------------------------------------------------------
// 1. Extract TOC region
// ------------------------------------------------------------

const tocEnd = fullText.indexOf(
  "A Bill"
);

if (tocEnd === -1) {
  throw new Error("Could not locate TOC boundary.");
}

const tocText = fullText.slice(0, tocEnd);

// ------------------------------------------------------------
// 2. Extract actual Act body
// ------------------------------------------------------------

const bodyStart =
  fullText.indexOf(
    "ENACTED by the National Assembly"
  );

const bodyEnd = SCHEDULE_START;

const bodyText = fullText.slice(
  bodyStart,
  bodyEnd
);

// ------------------------------------------------------------
// 3. Extract Schedule
// ------------------------------------------------------------

const scheduleText = fullText.slice(
  SCHEDULE_START
);

// ------------------------------------------------------------
// 4. Parse Parts from TOC
// ------------------------------------------------------------

const partRegex =
  /(?:^|\n)\s*PART\s+([IVXLCDM]+)\s*[-–—]?\s*([^\n]*)/gi;

const parts = [];

let match;

while ((match = partRegex.exec(tocText)) !== null) {
  const partNumber = match[1].toUpperCase();

  let title = match[2]
    .replace(/\s+/g, " ")
    .trim();

  if (!title) continue;

  parts.push({
    part: partNumber,
    title,
    position: match.index
  });
}

// Remove obvious duplicate/corrupt TOC matches
const uniqueParts = [];

for (const part of parts) {
  const exists = uniqueParts.some(
    p =>
      p.part === part.part &&
      Math.abs(p.position - part.position) < 200
  );

  if (!exists) {
    uniqueParts.push(part);
  }
}

// ------------------------------------------------------------
// 5. Parse TOC section entries
// ------------------------------------------------------------

const sectionRegex =
  /(?:^|\n)\s*(\d{1,3})[.,]\s+([^\n]+)/g;

const sections = [];

while ((match = sectionRegex.exec(tocText)) !== null) {
  const number = Number(match[1]);

  if (number < 1 || number > 142) {
    continue;
  }

  let heading = match[2]
    .replace(/\s+/g, " ")
    .trim();

  // Skip entries that are obviously continuation noise
  if (
    heading === "" ||
    /^\d+[.,]?$/.test(heading)
  ) {
    continue;
  }

  sections.push({
    section: number,
    heading,
    tocPosition: match.index
  });
}

// ------------------------------------------------------------
// 6. Deduplicate section numbers
// ------------------------------------------------------------

const sectionMap = new Map();

for (const section of sections) {
  if (!sectionMap.has(section.section)) {
    sectionMap.set(
      section.section,
      section
    );
  }
}

const orderedSections = [...sectionMap.values()]
  .sort((a, b) => a.section - b.section);

// ------------------------------------------------------------
// 7. Print discovered structure
// ------------------------------------------------------------

console.log("\n========================================");
console.log("POLICE ACT V2 STRUCTURE");
console.log("========================================");

console.log("\nParts:");

for (const part of uniqueParts) {
  console.log(
    `Part ${part.part} — ${part.title}`
  );
}

console.log(
  `\nSections detected: ${orderedSections.length}`
);

for (const section of orderedSections) {
  console.log(
    `${section.section}. ${section.heading}`
  );
}

// ------------------------------------------------------------
// 8. Find likely section boundaries in ACT BODY
// ------------------------------------------------------------

function normalizeForSearch(value) {
  return value
    .toLowerCase()
    .replace(/[.,;:!?'"“”‘’()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const normalizedBody =
  normalizeForSearch(bodyText);

// ------------------------------------------------------------
// 9. Fuzzy-ish heading locator
// ------------------------------------------------------------

function findHeadingPosition(
  heading,
  fromPosition
) {
  const normalizedHeading =
    normalizeForSearch(heading);

  // First try exact normalized heading
  const exactIndex =
    normalizedBody.indexOf(
      normalizedHeading,
      fromPosition
    );

  if (exactIndex !== -1) {
    return exactIndex;
  }

  // Fall back to first meaningful words
  const words =
    normalizedHeading
      .split(" ")
      .filter(word => word.length >= 4)
      .slice(0, 6);

  if (words.length < 2) {
    return -1;
  }

  const firstWords =
    words.join(" ");

  return normalizedBody.indexOf(
    firstWords,
    fromPosition
  );
}

// ------------------------------------------------------------
// 10. Locate section boundaries
// ------------------------------------------------------------

const locatedSections = [];

let searchPosition = 0;

for (const section of orderedSections) {
  const position = findHeadingPosition(
    section.heading,
    searchPosition
  );

  if (position !== -1) {
    locatedSections.push({
      ...section,
      bodyPosition: position
    });

    searchPosition =
      position +
      normalizeForSearch(section.heading).length;
  } else {
    locatedSections.push({
      ...section,
      bodyPosition: -1
    });
  }
}

// ------------------------------------------------------------
// 11. Report boundary quality
// ------------------------------------------------------------

console.log(
  "\n========================================"
);

console.log(
  "SECTION LOCATION RESULTS"
);

console.log(
  "========================================"
);

for (const section of locatedSections) {
  const status =
    section.bodyPosition === -1
      ? "NOT FOUND"
      : "FOUND";

  console.log(
    `${String(section.section).padStart(3)} | ${status} | ${section.heading}`
  );
}

// ------------------------------------------------------------
// 12. Create chunks only for successfully located sections
// ------------------------------------------------------------

const chunks = [];

for (
  let i = 0;
  i < locatedSections.length;
  i++
) {
  const current =
    locatedSections[i];

  if (current.bodyPosition === -1) {
    continue;
  }

  const next =
    locatedSections[i + 1];

  const start =
    current.bodyPosition;

  const end =
    next && next.bodyPosition !== -1
      ? next.bodyPosition
      : normalizedBody.length;

  const text =
    normalizedBody
      .slice(start, end)
      .trim();

  if (!text) {
    continue;
  }

  const chunk = {
    chunkType: "legal_provision",

    sourceFile:
      "Police-Act-2020.pdf",

    sourceTitle:
      "Nigeria Police Act",

    sourceType:
      "act",

    authorityLevel:
      "primary",

    jurisdiction:
      "federal",

    enactmentYear:
      2020,

    verificationStatus:
      "unverified",

    section:
      String(current.section),

    heading:
      current.heading,

    part:
      null,

    chapter:
      null,

    text,

    citation:
      `Nigeria Police Act, Section ${current.section} — ${current.heading}`
  };

  chunks.push(chunk);
}

// ------------------------------------------------------------
// 13. Schedule chunk
// ------------------------------------------------------------

if (scheduleText.trim()) {
  chunks.push({
    chunkType: "schedule",

    sourceFile:
      "Police-Act-2020.pdf",

    sourceTitle:
      "Nigeria Police Act",

    sourceType:
      "act",

    authorityLevel:
      "primary",

    jurisdiction:
      "federal",

    enactmentYear:
      2020,

    verificationStatus:
      "unverified",

    section:
      null,

    heading:
      "Schedule",

    part:
      null,

    chapter:
      null,

    text:
      scheduleText.trim(),

    citation:
      "Nigeria Police Act, Schedule"
  });
}

// ------------------------------------------------------------
// 14. Write result
// ------------------------------------------------------------

const outputPath =
  path.join(
    outputDir,
    "Police-Act-2020.chunks.json"
  );

fs.writeFileSync(
  outputPath,
  JSON.stringify(
    {
      source: data.metadata,
      parser: {
        version: "2.0",
        strategy:
          "toc-structure + substantive-body",
        actualActStart:
          ACT_START,
        scheduleStart:
          SCHEDULE_START
      },
      statistics: {
        tocSections:
          orderedSections.length,
        locatedSections:
          locatedSections.filter(
            s => s.bodyPosition !== -1
          ).length,
        chunks:
          chunks.length
      },
      chunks
    },
    null,
    2
  ),
  "utf8"
);

console.log(
  "\n========================================"
);

console.log(
  "POLICE ACT V2 COMPLETE"
);

console.log(
  `Chunks: ${chunks.length}`
);

console.log(
  `Output: ${outputPath}`
);