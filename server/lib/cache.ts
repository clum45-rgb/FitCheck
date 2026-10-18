import { VOCAB_VERSION } from "./vocab";
import { getSupabaseAdmin } from "./supabaseAdmin";
import type { Product, Tags, TaggedProduct } from "./types";

const TABLE = "scanned_products";

type CacheRow = {
  product_id: string;
  vocab_version: number;
  tags: Tags;
};

// Cache decision is gated on vocab_version only, not updated_at. Some
// storefronts (e.g. mutimer.co) stamp updated_at from an automated sync job
// that advances on every poll with no real content change, which would
// defeat caching entirely if we gated on it. Tradeoff: a genuine merchant
// edit won't invalidate a cached product until VOCAB_VERSION bumps — fine
// for a demo catalog that isn't changing mid-hackathon. updated_at is still
// stored per row in case this needs revisiting later.
export async function getCachedTags(
  storeDomain: string,
  products: Product[],
): Promise<Map<string, Tags>> {
  if (products.length === 0) return new Map();

  const { data, error } = await getSupabaseAdmin()
    .from(TABLE)
    .select("product_id, vocab_version, tags")
    .eq("store_domain", storeDomain)
    .in(
      "product_id",
      products.map((p) => p.id),
    );

  if (error) throw error;

  const result = new Map<string, Tags>();

  for (const row of (data ?? []) as CacheRow[]) {
    if (row.vocab_version === VOCAB_VERSION) {
      result.set(row.product_id, row.tags);
    }
  }

  return result;
}

export async function saveProducts(
  storeDomain: string,
  products: TaggedProduct[],
  embeddings: number[][] = [],
): Promise<void> {
  if (products.length === 0) return;

  const rows = products.map((p, index) => ({
    store_domain: storeDomain,
    product_id: p.id,
    updated_at: p.updatedAt,
    vocab_version: VOCAB_VERSION,
    product: p,
    tags: p.styleTags,
    ...(embeddings[index] ? { embedding: embeddings[index] } : {}),
  }));

  const { error } = await getSupabaseAdmin()
    .from(TABLE)
    .upsert(rows, { onConflict: "store_domain,product_id" });

  if (error) throw error;
}
