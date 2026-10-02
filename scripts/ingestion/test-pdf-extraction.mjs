import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import pdfParse from "pdf-parse";

const corpusDir = join(process.cwd(), "..", "..", "legal corpus");

const files = (await readdir(corpusDir))
  .filter((file) => file.toLowerCase().endsWith(".pdf"))
  .sort();

console.log(`Found ${files.length} PDF files\n`);

for (const file of files) {
  console.log("=".repeat(80));
  console.log(file);
  console.log("=".repeat(80));

  try {
    const buffer = await readFile(join(corpusDir, file));
    const parsed = await pdfParse(buffer);

    const text = parsed.text.replace(/\s+\n/g, "\n").trim();

    console.log(`Pages:       ${parsed.numpages}`);
    console.log(`Characters:  ${text.length}`);
    console.log(
      `Words:       ${text.split(/\s+/).filter(Boolean).length}`
    );

    console.log("\nFirst 500 characters:\n");
    console.log(text.slice(0, 500));

    console.log("\n");
  } catch (error) {
    console.error(`ERROR processing ${file}`);
    console.error(error);
  }
}