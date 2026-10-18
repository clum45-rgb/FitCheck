import fs from "node:fs";
import OpenAI from "openai";
import { AESTHETIC, CATEGORY, COLOR, FIT, MATERIAL } from "../lib/vocab";
import { ruleTag } from "../lib/ruleTag";
import type { Product, Tags } from "../lib/types";
import type { RuleHints } from "../lib/ruleTag";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const OLD_PROMPT = `You are tagging clothing products for a style-matching app. For each product, choose zero or more values per attribute, using ONLY the exact vocabulary values defined in the schema enums — never invent new values.

Some products include "Hints" derived from the store's own data (merchant tags, product type, description text). Trust a hint unless the image or description clearly contradicts it. "fit" and "aesthetic" are never given as hints — determine those yourself from the image and text, every time.

If an attribute genuinely doesn't apply (e.g. "fit" for a belt), return an empty array for it rather than guessing.`;

const NEW_PROMPT = `You are tagging clothing products for a style-matching app. For each product, choose one or more values per attribute, using ONLY the exact vocabulary values defined in the schema enums — never invent new values.

Some products include "Hints" derived from the store's own data (merchant tags, product type, description text). Trust a hint unless the image or description clearly contradicts it. "fit" and "aesthetic" are never given as hints — determine those yourself from the image and text, every time, for every product in the batch. Do not skip this reasoning for later items in the batch just because you already reasoned about earlier ones.

"aesthetic" almost always applies to wearable apparel (t-shirts, shirts, knits, hoodies, jackets, coats, pants, jeans, shorts, skirts, dresses) — every one of these has a vibe. Only leave "aesthetic" empty for items where it genuinely doesn't apply, such as plain functional accessories. A near-empty "aesthetic" or "fit" array across most items in a batch is a sign you are not reasoning carefully enough about each one individually — take your best-supported guess rather than defaulting to empty.

An empty array should be rare, not the default. Only use it when an attribute truly doesn't apply to the product (e.g. "fit" for a flat accessory), not when you're merely uncertain.`;

function emptyTags(): Tags {
  return { category: [], fit: [], color: [], material: [], aesthetic: [] };
}

function enumArray(values: readonly string[]) {
  return { type: "array" as const, items: { type: "string" as const, enum: [...values] } };
}

function buildSchema() {
  return {
    name: "tag_batch",
    strict: true,
    schema: {
      type: "object",
      properties: {
        products: {
          type: "array",
          items: {
            type: "object",
            properties: {
              index: { type: "integer" },
              category: enumArray(CATEGORY),
              fit: enumArray(FIT),
              color: enumArray(COLOR),
              material: enumArray(MATERIAL),
              aesthetic: enumArray(AESTHETIC),
            },
            required: ["index", "category", "fit", "color", "material", "aesthetic"],
            additionalProperties: false,
          },
        },
      },
      required: ["products"],
      additionalProperties: false,
    },
  };
}

function validate<T extends string>(value: unknown, vocab: readonly T[]): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is T => typeof v === "string" && (vocab as readonly string[]).includes(v));
}

function productToContent(product: Product, hints: RuleHints, index: number) {
  const lines = [
    `Product ${index}:`,
    `Title: ${product.title}`,
    `Product type: ${product.productType || "(none)"}`,
    `Store tags: ${product.tags.join(", ") || "(none)"}`,
    `Color from title: ${product.colorFromTitle ?? "(none)"}`,
    `Description: ${product.description || "(none)"}`,
    `Hints — category: [${hints.category.join(", ")}], color: [${hints.color.join(", ")}], material: [${hints.material.join(", ")}]`,
  ];
  const content: any[] = [{ type: "text", text: lines.join("\n") }];
  const image = product.images[0];
  if (image) content.push({ type: "image_url", image_url: { url: image, detail: "low" } });
  return content;
}

async function runCondition(
  label: string,
  products: Product[],
  hints: RuleHints[],
  batchSize: number,
  systemPrompt: string,
) {
  const tags: Tags[] = [];
  for (let i = 0; i < products.length; i += batchSize) {
    const batchProducts = products.slice(i, i + batchSize);
    const batchHints = hints.slice(i, i + batchSize);
    const content = batchProducts.flatMap((p, j) => productToContent(p, batchHints[j], j));

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content },
      ],
      response_format: { type: "json_schema", json_schema: buildSchema() },
    });

    const raw = response.choices[0]?.message?.content;
    const parsed = raw ? JSON.parse(raw) : { products: [] };
    const byIndex = new Map<number, any>();
    for (const item of parsed.products ?? []) byIndex.set(item.index, item);

    batchProducts.forEach((_, j) => {
      const item = byIndex.get(j);
      tags.push(
        item
          ? {
              category: validate(item.category, CATEGORY),
              fit: validate(item.fit, FIT),
              color: validate(item.color, COLOR),
              material: validate(item.material, MATERIAL),
              aesthetic: validate(item.aesthetic, AESTHETIC),
            }
          : emptyTags(),
      );
    });
  }

  const emptyAesthetic = tags.filter((t) => t.aesthetic.length === 0).length;
  const emptyFit = tags.filter((t) => t.fit.length === 0).length;
  console.log(`\n=== ${label} ===`);
  tags.forEach((t, i) => console.log(products[i].title, "|", JSON.stringify(t)));
  console.log(`empty aesthetic: ${emptyAesthetic}/${products.length} | empty fit: ${emptyFit}/${products.length}`);
}

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
const hints = products.map(ruleTag);

async function main() {
  await runCondition("A: batch size 10 + NEW prompt", products, hints, 10, NEW_PROMPT);
  await runCondition("B: batch size 5 + OLD prompt", products, hints, 5, OLD_PROMPT);
}

main();
