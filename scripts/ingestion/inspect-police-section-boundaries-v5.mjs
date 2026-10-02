import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const INPUT = path.join(
  ROOT,
  "normalized-corpus",
  "normalized",
  "Police-Act-2020.json"
);

const data = JSON.parse(fs.readFileSync(INPUT, "utf8"));
const fullText = data.content.normalizedText;

const ACT_START = fullText.indexOf(
  "ENACTED by the National Assembly"
);

const scheduleMatches = [...fullText.matchAll(/\nSCHEDULE\b/gi)]
  .map(m => m.index)
  .filter(i => i > ACT_START + 10000);

const SCHEDULE_START = scheduleMatches[0];

const body = fullText.slice(ACT_START, SCHEDULE_START);

console.log("========================================");
console.log("POLICE ACT — SECTION BOUNDARY FORENSICS");
console.log("========================================");
console.log(`Body length: ${body.length}`);
console.log();

const targets = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
  30, 31, 32, 40, 41, 42, 43, 44, 45,
  50, 60, 70, 80, 90, 100, 106, 110,
  119, 120, 130, 131, 132, 140, 141, 142
];

function showMatches(number) {
  console.log();
  console.log(`### SECTION ${number}`);
  console.log("----------------------------------------");

  /*
   * Deliberately broad searches.
   */

  const patterns = [
    new RegExp(`(?:^|\\n)\\s*${number}\\s*[.,]?`, "g"),
    new RegExp(`\\b${number}\\s*[.,]\\s*\\(`, "g"),
    new RegExp(`\\b${number}\\s*[.,]\\s+[A-Z]`, "g"),
    new RegExp(`\\n\\s*${number}\\s*\\n`, "g")
  ];

  const found = [];

  for (const regex of patterns) {
    for (const match of body.matchAll(regex)) {
      const index = match.index;

      if (!found.some(x => Math.abs(x - index) < 5)) {
        found.push(index);
      }
    }
  }

  found.sort((a, b) => a - b);

  if (!found.length) {
    console.log("NO MATCH");
    return;
  }

  console.log(`Matches found: ${found.length}`);

  /*
   * Show up to 5 occurrences.
   */
  for (const index of found.slice(0, 5)) {
    console.log();
    console.log(`OFFSET: ${index}`);
    console.log("----------------------------------------");

    const start = Math.max(0, index - 350);
    const end = Math.min(body.length, index + 900);

    const fragment = body.slice(start, end);

    /*
     * Show whitespace visibly.
     */
    const visible = fragment
      .replace(/\r/g, "\\r")
      .replace(/\n/g, "\\n\n")
      .replace(/\t/g, "\\t");

    console.log(visible);
  }
}

for (const number of targets) {
  showMatches(number);
}

console.log();
console.log("========================================");
console.log("FORENSICS COMPLETE");
console.log("========================================");