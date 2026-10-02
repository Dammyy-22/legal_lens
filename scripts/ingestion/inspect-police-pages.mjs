import { readFile } from "node:fs/promises";
import pdfParse from "pdf-parse";

const file = "../../legal corpus/Police-Act-2020.pdf";

const buffer = await readFile(file);

const parsed = await pdfParse(buffer, {
  pagerender: async (pageData) => {
    const content = await pageData.getTextContent();

    return content.items
      .map((item) => item.str)
      .join(" ");
  },
});

const text = parsed.text || "";

console.log(`Pages: ${parsed.numpages}`);
console.log(`Characters: ${text.length}`);
console.log(`Words: ${text.split(/\s+/).filter(Boolean).length}`);

console.log("\n--- LAST 5000 CHARACTERS ---\n");
console.log(text.slice(-5000));