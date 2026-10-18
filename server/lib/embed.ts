import OpenAI from "openai";
import type { Tags } from "./types";

const MODEL = "text-embedding-3-small";
const TAG_FIELDS = ["category", "fit", "color", "material", "aesthetic"] as const;

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export function tagsToEmbeddingText(tags: Tags): string {
  return TAG_FIELDS.map((field) => {
    const values = Array.isArray(tags?.[field]) ? [...tags[field]].sort() : [];
    return `${field}: ${values.join(", ")}`;
  }).join("\n");
}

export function asVector(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (!value.every((item) => typeof item === "number" && Number.isFinite(item))) return null;
  return value;
}

export function cosineSimilarity(left: number[], right: number[]): number {
  const length = Math.min(left.length, right.length);
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  if (leftNorm === 0 || rightNorm === 0) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

export function similarityPercent(left: number[], right: number[]): number {
  return Math.round(Math.max(0, cosineSimilarity(left, right)) * 100);
}

export async function embedTags(tags: Tags): Promise<number[]> {
  const [embedding] = await embedTagBatch([tags]);
  return embedding;
}

export async function embedTagBatch(tagList: Tags[]): Promise<number[][]> {
  if (tagList.length === 0) return [];

  const response = await getClient().embeddings.create({
    model: MODEL,
    input: tagList.map(tagsToEmbeddingText),
  });

  return [...response.data]
    .sort((left, right) => left.index - right.index)
    .map((item) => item.embedding);
}
