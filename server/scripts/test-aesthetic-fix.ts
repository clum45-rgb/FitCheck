import fs from "node:fs";
import { ruleTag } from "../lib/ruleTag";
import { tagProducts } from "../lib/llmTag";
import type { Product } from "../lib/types";

const data = JSON.parse(fs.readFileSync("/tmp/scan-result.json", "utf8")) as { products: Product[] };

const testIds = new Set([
  "8597495808196",
  "8604094857412",
  "8604094628036",
  "8604094464196",
  "8604094070980",
  "8604093710532",
  "8604093120708",
  "8604093087940",
  "8604092924100",
  "8604092596420",
]);

const products = data.products.filter((p) => testIds.has(p.id));

async function main() {
  console.log(`Testing ${products.length} previously-empty-aesthetic products with new prompt + batch size 5...`);
  const hints = products.map(ruleTag);
  const tags = await tagProducts(products, hints);

  let emptyAesthetic = 0;
  products.forEach((p, i) => {
    if (tags[i].aesthetic.length === 0) emptyAesthetic++;
    console.log(p.title, "|", JSON.stringify(tags[i]));
  });
  console.log(`\nempty aesthetic: ${emptyAesthetic}/${products.length}`);
}

main();
