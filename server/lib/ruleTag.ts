import type { Category, Color, Material } from "./vocab";
import type { Product } from "./types";

// Cheap, free pre-pass: pulls obvious signal straight from the store's own
// text fields before paying for an LLM call. Never attempts fit/aesthetic —
// those aren't explicit in merchant data and always need visual judgment.
export type RuleHints = {
  category: Category[];
  color: Color[];
  material: Material[];
};

// Ordered so more specific terms are checked before generic ones
// (e.g. "t-shirt" before "shirt", "jeans" before "pants").
const CATEGORY_SYNONYMS: Array<[Category, string[]]> = [
  ["t-shirt", ["t-shirt", "tshirt", "tee"]],
  ["long-sleeve", ["long sleeve", "longsleeve", "long-sleeve"]],
  ["hoodie", ["hoodie", "hooded"]],
  ["jacket", ["jacket"]],
  ["coat", ["coat"]],
  ["jeans", ["jean", "denim pant"]],
  ["pants", ["pant", "trouser"]],
  ["shorts", ["short"]],
  ["skirt", ["skirt"]],
  ["dress", ["dress"]],
  ["knit", ["sweater", "jumper", "cardigan"]],
  ["shirt", ["shirt"]],
  [
    "accessory",
    ["accessory", "accessories", "hat", "cap", "beanie", "bag", "belt", "scarf", "sock", "glove"],
  ],
];

const COLOR_SYNONYMS: Array<[Color, string[]]> = [
  ["black", ["black"]],
  ["white", ["white"]],
  ["grey", ["grey", "gray"]],
  ["navy", ["navy"]],
  ["blue", ["blue"]],
  ["green", ["green"]],
  ["olive", ["olive"]],
  ["brown", ["brown"]],
  ["tan", ["tan", "khaki"]],
  ["beige", ["beige", "cream", "ecru"]],
  ["red", ["red"]],
  ["pink", ["pink"]],
  ["purple", ["purple"]],
  ["yellow", ["yellow"]],
  ["orange", ["orange"]],
  ["multicolor", ["multicolor", "multicolour", "multi"]],
];

const MATERIAL_SYNONYMS: Array<[Material, string[]]> = [
  ["cotton", ["cotton"]],
  ["denim", ["denim"]],
  ["wool", ["wool", "merino"]],
  ["knit", ["knit", "ribbed"]],
  ["leather", ["leather"]],
  ["suede", ["suede"]],
  ["nylon", ["nylon"]],
  ["linen", ["linen"]],
  ["synthetic", ["polyester", "synthetic", "acrylic", "elastane", "spandex"]],
];

function matchAll<T extends string>(text: string, synonyms: Array<[T, string[]]>): T[] {
  const matches: T[] = [];
  for (const [value, keywords] of synonyms) {
    if (keywords.some((kw) => text.includes(kw))) matches.push(value);
  }
  return [...new Set(matches)];
}

export function ruleTag(product: Product): RuleHints {
  const categoryText = `${product.productType} ${product.tags.join(" ")}`.toLowerCase();
  const colorText = `${product.colorFromTitle ?? ""} ${product.tags.join(" ")}`.toLowerCase();
  const materialText = `${product.description} ${product.tags.join(" ")}`.toLowerCase();

  return {
    category: matchAll(categoryText, CATEGORY_SYNONYMS),
    color: matchAll(colorText, COLOR_SYNONYMS),
    material: matchAll(materialText, MATERIAL_SYNONYMS),
  };
}
