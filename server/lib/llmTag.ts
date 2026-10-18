import OpenAI from "openai";
import { AESTHETIC, CATEGORY, COLOR, FIT, MATERIAL } from "./vocab";
import type { Product, Tags } from "./types";
import type { RuleHints } from "./ruleTag";

const MODEL = "gpt-4o-mini";
const BATCH_SIZE = 10;

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

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

const SYSTEM_PROMPT = `You are tagging clothing products for a style-matching app. For each product, choose one or more values per attribute, using ONLY the exact vocabulary values defined in the schema enums — never invent new values.

Some products include "Hints" derived from the store's own data (merchant tags, product type, description text). Trust a hint unless the image or description clearly contradicts it. "fit" and "aesthetic" are never given as hints — determine those yourself from the image and text, every time, for every product in the batch. Do not skip this reasoning for later items in the batch just because you already reasoned about earlier ones.

"aesthetic" almost always applies to wearable apparel (t-shirts, shirts, knits, hoodies, jackets, coats, pants, jeans, shorts, skirts, dresses) — every one of these has a vibe. Only leave "aesthetic" empty for items where it genuinely doesn't apply, such as plain functional accessories. A near-empty "aesthetic" or "fit" array across most items in a batch is a sign you are not reasoning carefully enough about each one individually — take your best-supported guess rather than defaulting to empty.

An empty array should be rare, not the default. Only use it when an attribute truly doesn't apply to the product (e.g. "fit" for a flat accessory), not when you're merely uncertain.`;

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail: "low" } };

function productToContent(product: Product, hints: RuleHints, index: number): ContentPart[] {
  const lines = [
    `Product ${index}:`,
    `Title: ${product.title}`,
    `Product type: ${product.productType || "(none)"}`,
    `Store tags: ${product.tags.join(", ") || "(none)"}`,
    `Color from title: ${product.colorFromTitle ?? "(none)"}`,
    `Description: ${product.description || "(none)"}`,
    `Hints — category: [${hints.category.join(", ")}], color: [${hints.color.join(", ")}], material: [${hints.material.join(", ")}]`,
  ];

  const content: ContentPart[] = [{ type: "text", text: lines.join("\n") }];
  const image = product.images[0];
  if (image) {
    content.push({ type: "image_url", image_url: { url: image, detail: "low" } });
  }
  return content;
}

function validate<T extends string>(value: unknown, vocab: readonly T[]): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is T => typeof v === "string" && (vocab as readonly string[]).includes(v));
}

const MAX_BATCH_ATTEMPTS = 3;

// gpt-4o-mini's structured-output array occasionally comes back short for a
// 10-item batch (confirmed by re-running an identical batch that returned
// all 10 the second time) — not malformed JSON, just missing entries. Retry
// the whole batch while any index is unaccounted for before giving up.
async function tagBatch(products: Product[], hints: RuleHints[]): Promise<Tags[]> {
  if (products.length === 0) return [];

  let byIndex = new Map<number, Record<string, unknown>>();

  for (let attempt = 1; attempt <= MAX_BATCH_ATTEMPTS; attempt++) {
    const missing = products.map((_, i) => i).filter((i) => !byIndex.has(i));
    if (missing.length === 0) break;

    const missingProducts = missing.map((i) => products[i]);
    const missingHints = missing.map((i) => hints[i]);
    const content = missingProducts.flatMap((p, j) => productToContent(p, missingHints[j], missing[j]));

    const response = await getClient().chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content },
      ],
      response_format: { type: "json_schema", json_schema: buildSchema() },
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) continue;

    let parsed: { products?: Array<Record<string, unknown>> };
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }

    for (const item of parsed.products ?? []) {
      if (typeof item.index === "number") byIndex.set(item.index, item);
    }
  }

  return products.map((_, i) => {
    const item = byIndex.get(i);
    if (!item) return emptyTags();
    return {
      category: validate(item.category, CATEGORY),
      fit: validate(item.fit, FIT),
      color: validate(item.color, COLOR),
      material: validate(item.material, MATERIAL),
      aesthetic: validate(item.aesthetic, AESTHETIC),
    };
  });
}

export async function tagProducts(products: Product[], hints: RuleHints[]): Promise<Tags[]> {
  const results: Tags[] = [];
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batchResults = await tagBatch(products.slice(i, i + BATCH_SIZE), hints.slice(i, i + BATCH_SIZE));
    results.push(...batchResults);
  }
  return results;
}
