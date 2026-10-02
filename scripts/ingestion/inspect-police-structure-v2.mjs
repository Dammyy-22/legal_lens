import fs from "fs";
import path from "path";

const file = path.join(
  process.cwd(),
  "normalized-corpus",
  "normalized",
  "Police-Act-2020.json"
);

const data = JSON.parse(fs.readFileSync(file, "utf8"));
const text = data.content.normalizedText;

console.log("========================================");
console.log("POLICE ACT STRUCTURE INSPECTION");
console.log("========================================\n");

console.log("Total characters:", text.length);
console.log("Total lines:", text.split("\n").length);

const lines = text.split("\n");

console.log("\n--- FIRST 150 LINES ---\n");

lines.slice(0, 150).forEach((line, i) => {
  if (line.trim()) {
    console.log(`${String(i + 1).padStart(4)} | ${line}`);
  }
});

console.log("\n--- PART MARKERS ---\n");

const partRegex =
  /(?:^|\n)\s*PART\s+([IVXLCDM]+)\s*[-–—:]?\s*([^\n]*)/gi;

let match;
while ((match = partRegex.exec(text)) !== null) {
  const position = match.index;

  console.log(
    `PART ${match[1]} | ${match[2].trim()} | char ${position}`
  );
}

console.log("\n--- SECTION-LIKE HEADINGS ---\n");

const sectionRegex =
  /(?:^|\n)\s*(\d{1,3})[.,]?\s+([^\n]{3,180})/g;

let count = 0;

while ((match = sectionRegex.exec(text)) !== null) {
  const section = match[1];
  const heading = match[2].trim();

  if (Number(section) <= 142) {
    console.log(
      `Section ${section} | ${heading} | char ${match.index}`
    );
    count++;
  }

  if (count >= 220) break;
}

console.log("\n--- IMPORTANT MARKERS ---\n");

const markers = [
  "ARRANGEMENT OF SECTIONS",
  "ENACTED by the National Assembly",
  "A Bill",
  "SCHEDULE",
  "CERTIFICATION",
  "EXPLANATORY MEMORANDUM",
  "Police Act Cap",
  "NIGERIA POLICE ACT, 2020"
];

for (const marker of markers) {
  const positions = [];

  let start = 0;

  while (true) {
    const index = text.indexOf(marker, start);

    if (index === -1) break;

    positions.push(index);
    start = index + marker.length;
  }

  console.log(`${marker}:`, positions);
}

console.log("\n========================================");
console.log("INSPECTION COMPLETE");
console.log("========================================");