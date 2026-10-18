import { similarityPercent } from "./embed";
import type { TaggedProduct } from "./types";

export const MATCH_THRESHOLD = 50;
export const GOOD_MATCH_THRESHOLD = 60;
export const GREAT_MATCH_THRESHOLD = 75;
export const MAX_MATCHES = 24;

export type EmbeddedProduct = TaggedProduct & { embedding: number[] };

export type MatchedProduct = TaggedProduct & { matchScore: number; matchLabel: string };

function matchLabelFor(score: number): string {
  if (score >= GREAT_MATCH_THRESHOLD) return "Great match";
  if (score >= GOOD_MATCH_THRESHOLD) return "Good match";
  return "Ok match";
}

export function rankMatches(products: EmbeddedProduct[], profileEmbedding: number[]): MatchedProduct[] {
  return products
    .map(({ embedding, ...product }) => {
      const matchScore = similarityPercent(embedding, profileEmbedding);
      return { ...product, matchScore, matchLabel: matchLabelFor(matchScore) };
    })
    .filter((product) => product.matchScore >= MATCH_THRESHOLD)
    .sort((left, right) => right.matchScore - left.matchScore)
    .slice(0, MAX_MATCHES);
}
