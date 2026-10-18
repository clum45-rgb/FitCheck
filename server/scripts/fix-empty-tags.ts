import fs from "node:fs";
import { ruleTag } from "../lib/ruleTag";
import { tagProducts } from "../lib/llmTag";
import { saveProducts } from "../lib/cache";
import type { Product, TaggedProduct } from "../lib/types";

const data = JSON.parse(fs.readFileSync("/tmp/scan-result.json", "utf8")) as {
  storeDomain: string;
  products: Product[];
};

const brokenPositions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 56, 101, 102, 103, 104, 105, 106, 107, 108, 109];
const products = brokenPositions.map((i) => data.products[i]);

async function main() {
  console.log(`Re-tagging ${products.length} products...`);
  const hints = products.map(ruleTag);
  const tags = await tagProducts(products, hints);

  const taggedProducts: TaggedProduct[] = products.map((p, i) => ({ ...p, styleTags: tags[i] }));

  for (const p of taggedProducts) {
    const isEmpty =
      p.styleTags.category.length === 0 &&
      p.styleTags.fit.length === 0 &&
      p.styleTags.color.length === 0 &&
      p.styleTags.material.length === 0 &&
      p.styleTags.aesthetic.length === 0;
    console.log(p.id, p.title, isEmpty ? "STILL EMPTY" : JSON.stringify(p.styleTags));
  }

  await saveProducts(data.storeDomain, taggedProducts);
  console.log("Saved to Supabase.");
}

main();
