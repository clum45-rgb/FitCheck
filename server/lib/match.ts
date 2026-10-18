import type { Tags, TaggedProduct } from "./types";

const FIELD_WEIGHTS: Record<keyof Tags, number> = {
  aesthetic: 3,
  category: 2,
  fit: 1,
  color: 1,
  material: 1,
};

function overlaps(a: readonly string[], b: readonly string[]): boolean {
  return a.some((v) => b.includes(v));
}

// Score = % of the weight of fields the user actually expressed a preference
// in (empty profile fields don't count against a product) where the product
// shares at least one value with the user's keywords for that field.
export function scoreProduct(productTags: Tags, profileKeywords: Tags): number {
  let earned = 0;
  let possible = 0;

  for (const field of Object.keys(FIELD_WEIGHTS) as (keyof Tags)[]) {
    const profileValues = profileKeywords[field];
    if (profileValues.length === 0) continue;

    possible += FIELD_WEIGHTS[field];
    if (overlaps(productTags[field], profileValues)) {
      earned += FIELD_WEIGHTS[field];
    }
  }

  return possible === 0 ? 0 : Math.round((earned / possible) * 100);
}

export const MATCH_THRESHOLD = 50; // tunable
export const MAX_MATCHES = 24; // tunable

export type MatchedProduct = TaggedProduct & { matchScore: number; matchLabel: string };

function matchLabelFor(score: number): string {
  if (score >= 80) return "Great match";
  if (score >= 50) return "Good match";
  return "Possible match";
}

export function rankMatches(products: TaggedProduct[], profileKeywords: Tags): MatchedProduct[] {
  return products
    .map((p) => ({ ...p, matchScore: scoreProduct(p.styleTags, profileKeywords) }))
    .map((p) => ({ ...p, matchLabel: matchLabelFor(p.matchScore) }))
    .filter((p) => p.matchScore >= MATCH_THRESHOLD)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, MAX_MATCHES);
}
