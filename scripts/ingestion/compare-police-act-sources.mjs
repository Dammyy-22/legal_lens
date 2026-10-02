import fs from "fs";
import path from "path";
import pdfParse from "pdf-parse";

const ROOT = process.cwd();

const CORPUS_DIR = path.resolve(
  ROOT,
  "..",
  "..",
  "legal corpus"
);

const OFFICIAL_PDF = path.join(
  CORPUS_DIR,
  "Police-Act-2020.pdf"
);

const PLAC_PDF = path.join(
  CORPUS_DIR,
  "Police-Act-2020-PLAC.pdf"

);

const OUTPUT_DIR = path.join(
  ROOT,
  "normalized-corpus",
  "police-comparison"
);

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function extract(file) {
  const buffer = fs.readFileSync(file);
  const result = await pdfParse(buffer);

  return {
    pages: result.numpages,
    text: result.text
  };
}

function sectionCandidates(text) {
  const results = [];

  /*
   * Broad detection only.
   *
   * We are not using this to create legal chunks yet.
   */
  const patterns = [
    /(?:^|\n)\s*(\d{1,3})\s*[.,]?\s+(?=[A-Za-z([])/g,
    /(?:^|\n)\s*(\d{1,3})\s*[.,]?\s*\n/g
  ];

  for (const regex of patterns) {
    for (const match of text.matchAll(regex)) {
      const number = Number(match[1]);

      if (number >= 1 && number <= 142) {
        results.push({
          number,
          offset: match.index
        });
      }
    }
  }

  return results;
}

function sectionPresence(text) {
  const candidates = sectionCandidates(text);

  const map = new Map();

  for (const c of candidates) {
    if (!map.has(c.number)) {
      map.set(c.number, []);
    }

    map.get(c.number).push(c.offset);
  }

  return map;
}

function extractWindow(text, offset, size = 700) {
  return text
    .slice(
      Math.max(0, offset - 100),
      Math.min(text.length, offset + size)
    )
    .replace(/\r/g, "")
    .trim();
}

function normalizeForComparison(text) {
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function main() {
  console.log("========================================");
  console.log("POLICE ACT SOURCE COMPARISON");
  console.log("========================================");

  if (!fs.existsSync(OFFICIAL_PDF)) {
    throw new Error(
      `Missing official PDF:\n${OFFICIAL_PDF}`
    );
  }

  if (!fs.existsSync(PLAC_PDF)) {
    throw new Error(
      `Missing PLAC PDF:\n${PLAC_PDF}`
    );
  }

  console.log("\nExtracting official Ministry PDF...");
  const official = await extract(OFFICIAL_PDF);

  console.log("Extracting PLAC PDF...");
  const plac = await extract(PLAC_PDF);

  console.log();
  console.log("SOURCE STATISTICS");
  console.log("----------------------------------------");

  console.log(
    `Official pages: ${official.pages}`
  );

  console.log(
    `Official characters: ${official.text.length}`
  );

  console.log(
    `PLAC pages: ${plac.pages}`
  );

  console.log(
    `PLAC characters: ${plac.text.length}`
  );

  /*
   * Save raw PLAC extraction.
   */
  fs.writeFileSync(
    path.join(
      OUTPUT_DIR,
      "Police-Act-2020-PLAC.raw.txt"
    ),
    plac.text,
    "utf8"
  );

  /*
   * Save raw official extraction separately.
   */
  fs.writeFileSync(
    path.join(
      OUTPUT_DIR,
      "Police-Act-2020-official.raw.txt"
    ),
    official.text,
    "utf8"
  );

  const officialSections =
    sectionPresence(official.text);

  const placSections =
    sectionPresence(plac.text);

  console.log();
  console.log("SECTION COVERAGE");
  console.log("----------------------------------------");

  const coverage = [];

  for (let section = 1; section <= 142; section++) {
    const officialMatches =
      officialSections.get(section) || [];

    const placMatches =
      placSections.get(section) || [];

    const row = {
      section,
      officialMatches: officialMatches.length,
      placMatches: placMatches.length,
      officialFound: officialMatches.length > 0,
      placFound: placMatches.length > 0
    };

    coverage.push(row);

    console.log(
      `${String(section).padStart(3)} | ` +
      `Official: ${row.officialFound ? "YES" : "NO "} ` +
      `(${row.officialMatches}) | ` +
      `PLAC: ${row.placFound ? "YES" : "NO "} ` +
      `(${row.placMatches})`
    );
  }

  /*
   * Save coverage.
   */
  fs.writeFileSync(
    path.join(
      OUTPUT_DIR,
      "section-coverage.json"
    ),
    JSON.stringify(coverage, null, 2),
    "utf8"
  );

  /*
   * Compare selected sections.
   */
  const importantSections = [
    1,
    2,
    3,
    4,
    5,
    10,
    20,
    30,
    31,
    32,
    40,
    41,
    42,
    43,
    44,
    50,
    60,
    70,
    80,
    90,
    100,
    106,
    110,
    119,
    120,
    130,
    131,
    132,
    140,
    141,
    142
  ];

  console.log();
  console.log("SELECTED SECTION COMPARISON");
  console.log("========================================");

  const selected = [];

  for (const section of importantSections) {
    console.log();
    console.log(`### SECTION ${section}`);
    console.log("----------------------------------------");

    const officialOffsets =
      officialSections.get(section) || [];

    const placOffsets =
      placSections.get(section) || [];

    const officialOffset =
      officialOffsets[0];

    const placOffset =
      placOffsets[0];

    const item = {
      section,
      official: null,
      plac: null
    };

    if (officialOffset !== undefined) {
      item.official = {
        offset: officialOffset,
        text: extractWindow(
          official.text,
          officialOffset
        )
      };

      console.log(
        `OFFICIAL OFFSET: ${officialOffset}`
      );

      console.log(
        item.official.text
      );
    } else {
      console.log("OFFICIAL: NOT FOUND");
    }

    console.log();

    if (placOffset !== undefined) {
      item.plac = {
        offset: placOffset,
        text: extractWindow(
          plac.text,
          placOffset
        )
      };

      console.log(
        `PLAC OFFSET: ${placOffset}`
      );

      console.log(
        item.plac.text
      );
    } else {
      console.log("PLAC: NOT FOUND");
    }

    selected.push(item);
  }

  /*
   * Basic structural indicators.
   */
  const indicators = {
    official: {
      hasActTitle:
        /NIGERIA POLICE ACT,\s*2020/i.test(
          official.text
        ),

      hasEnacted:
        /ENACTED by the National Assembly/i.test(
          official.text
        ),

      hasSchedule:
        /\bSCHEDULE\b/i.test(
          official.text
        ),

      hasCertification:
        /CERTIFICATION/i.test(
          official.text
        ),

      hasABill:
        /\bA Bill\b/i.test(
          official.text
        )
    },

    plac: {
      hasActTitle:
        /NIGERIA POLICE ACT,\s*2020/i.test(
          plac.text
        ),

      hasEnacted:
        /ENACTED by the National Assembly/i.test(
          plac.text
        ),

      hasSchedule:
        /\bSCHEDULE\b/i.test(
          plac.text
        ),

      hasCertification:
        /CERTIFICATION/i.test(
          plac.text
        ),

      hasABill:
        /\bA Bill\b/i.test(
          plac.text
        )
    }
  };

  console.log();
  console.log("STRUCTURAL INDICATORS");
  console.log("----------------------------------------");

  console.log(
    "OFFICIAL:",
    indicators.official
  );

  console.log(
    "PLAC:",
    indicators.plac
  );

  const report = {
    generatedAt: new Date().toISOString(),

    official: {
      file: path.basename(OFFICIAL_PDF),
      pages: official.pages,
      characters: official.text.length,
      indicators: indicators.official
    },

    plac: {
      file: path.basename(PLAC_PDF),
      pages: plac.pages,
      characters: plac.text.length,
      indicators: indicators.plac
    },

    coverage,

    selected
  };

  fs.writeFileSync(
    path.join(
      OUTPUT_DIR,
      "Police-Act-source-comparison.json"
    ),
    JSON.stringify(report, null, 2),
    "utf8"
  );

  console.log();
  console.log("========================================");
  console.log("COMPARISON COMPLETE");
  console.log("========================================");

  console.log(
    `Output: ${OUTPUT_DIR}`
  );
}

main().catch(error => {
  console.error();
  console.error("ERROR:");
  console.error(error);
  process.exit(1);
});