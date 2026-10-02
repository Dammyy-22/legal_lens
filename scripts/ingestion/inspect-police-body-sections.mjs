import fs from "node:fs";
import path from "node:path";

const INPUT = path.join(
  process.cwd(),
  "normalized-corpus",
  "normalized",
  "Police-Act-2020.json"
);

const data = JSON.parse(fs.readFileSync(INPUT, "utf8"));
const text = data.content.normalizedText;

const ACT_START = text.indexOf("ENACTED by the National Assembly");
const SCHEDULE_START = text.indexOf("\nSCHEDULE", ACT_START);

const body = text.slice(
  ACT_START,
  SCHEDULE_START === -1 ? text.length : SCHEDULE_START
);

console.log("========================================");
console.log("POLICE ACT BODY SAMPLE INSPECTION");
console.log("========================================");

console.log(`ACT_START: ${ACT_START}`);
console.log(`SCHEDULE_START: ${SCHEDULE_START}`);
console.log(`BODY LENGTH: ${body.length}`);

const targets = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 30, 31, 32, 40, 41, 42, 43, 44, 50, 60, 70, 80, 90, 100, 106, 110, 119, 120, 130, 131, 140, 141, 142];

function showAround(position, chars = 600) {
  const start = Math.max(0, position - 150);
  const end = Math.min(body.length, position + chars);

  console.log("\n----------------------------------------");
  console.log(`BODY OFFSET: ${position}`);
  console.log("----------------------------------------");
  console.log(body.slice(start, end));
}

for (const number of targets) {
  /*
   * Look for the number as a standalone token.
   * This is deliberately broad; this is an inspection tool,
   * NOT a parser.
   */
  const patterns = [
    new RegExp(`(?:^|\\n)\\s*${number}\\s*[.,]?\\s*`, "m"),
    new RegExp(`\\n\\s*${number}\\s*\\n`, "m"),
    new RegExp(`\\n\\s*${number}[.,]`, "m")
  ];

  let found = false;

  for (const regex of patterns) {
    const match = regex.exec(body);

    if (match) {
      console.log(`\n### SECTION ${number} CANDIDATE ###`);
      console.log(`Regex: ${regex}`);
      console.log(`Offset: ${match.index}`);
      showAround(match.index);
      found = true;
      break;
    }
  }

  if (!found) {
    console.log(`\n### SECTION ${number}: NO SIMPLE MATCH ###`);
  }
}

console.log("\n========================================");
console.log("INSPECTION COMPLETE");
console.log("========================================");