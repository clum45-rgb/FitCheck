import { NextRequest, NextResponse } from "next/server";
import { fetchAllProducts, ShopifyFetchError } from "@/lib/shopify";
import { normalizeProduct } from "@/lib/parse";
import { ruleTag } from "@/lib/ruleTag";
import { tagProducts } from "@/lib/llmTag";
import { getCachedTags, saveProducts } from "@/lib/cache";
import { embedTagBatch } from "@/lib/embed";
import type { ScanRequest, TaggedProduct } from "@/lib/types";

// Temporary stand-in until the recommender selects matches. Remove this cap then.
const SCAN_PRODUCT_LIMIT = 10;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as ScanRequest | null;
  const origin = body?.origin;

  if (typeof origin !== "string" || !/^https?:\/\//.test(origin)) {
    return NextResponse.json(
      { error: "origin must be a full URL, e.g. https://store.com" },
      { status: 400 },
    );
  }

  const storeDomain = new URL(origin).hostname;

  try {
    const rawProducts = await fetchAllProducts(origin, SCAN_PRODUCT_LIMIT);
    const products = rawProducts.map((raw) => normalizeProduct(raw, storeDomain));

    const cachedTags = await getCachedTags(storeDomain, products);
    const uncachedProducts = products.filter((p) => !cachedTags.has(p.id));

    const hints = uncachedProducts.map(ruleTag);
    const newTags = await tagProducts(uncachedProducts, hints);
    const newTagsById = new Map(uncachedProducts.map((p, i) => [p.id, newTags[i]]));

    const taggedProducts: TaggedProduct[] = products.map((product) => ({
      ...product,
      styleTags: cachedTags.get(product.id) ?? newTagsById.get(product.id)!,
    }));

    const newlyTagged = taggedProducts.filter((p) => !cachedTags.has(p.id));
    const embeddings = await embedTagBatch(newlyTagged.map((product) => product.styleTags));
    await saveProducts(storeDomain, newlyTagged, embeddings);

    return NextResponse.json({
      storeDomain,
      products: taggedProducts,
      counts: {
        total: taggedProducts.length,
        newlyTagged: newlyTagged.length,
        fromCache: cachedTags.size,
      },
    });
  } catch (err) {
    if (err instanceof ShopifyFetchError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    throw err;
  }
}
