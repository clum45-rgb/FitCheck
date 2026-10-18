import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";
import { asVector, embedTagBatch, embedTags } from "@/lib/embed";
import { rankMatches, type EmbeddedProduct } from "@/lib/match";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { VOCAB_VERSION } from "@/lib/vocab";
import type { Tags, TaggedProduct } from "@/lib/types";

type MatchRequest = {
  storeDomain?: string;
};

type ScannedRow = {
  store_domain: string;
  product_id: string;
  product: TaggedProduct;
  vocab_version: number;
  embedding: unknown;
};

type StyleProfileRow = {
  keywords: Tags;
  confirmed_at: string | null;
  embedding: unknown;
};

async function profileEmbedding(userId: string, row: StyleProfileRow): Promise<number[]> {
  const existing = asVector(row.embedding);
  if (existing) return existing;

  const embedding = await embedTags(row.keywords);
  const { error } = await getSupabaseAdmin()
    .from("style_profiles")
    .update({ embedding })
    .eq("user_id", userId);
  if (error) throw error;
  return embedding;
}

async function productsWithEmbeddings(rows: ScannedRow[]): Promise<EmbeddedProduct[]> {
  const missing = rows.filter((row) => !asVector(row.embedding));
  const embeddings = await embedTagBatch(missing.map((row) => row.product.styleTags));
  const supabase = getSupabaseAdmin();

  await Promise.all(missing.map(async (row, index) => {
    const { error } = await supabase
      .from("scanned_products")
      .update({ embedding: embeddings[index] })
      .eq("store_domain", row.store_domain)
      .eq("product_id", row.product_id);
    if (error) throw error;
  }));

  const stored = new Map(missing.map((row, index) => [`${row.store_domain}:${row.product_id}`, embeddings[index]]));
  return rows.map((row) => ({
    ...row.product,
    embedding: asVector(row.embedding) ?? stored.get(`${row.store_domain}:${row.product_id}`)!,
  }));
}

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as MatchRequest | null;
  const storeDomain = body?.storeDomain;
  if (typeof storeDomain !== "string" || storeDomain.length === 0) {
    return NextResponse.json({ error: "storeDomain is required." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: profileRow, error: profileError } = await supabase
    .from("style_profiles")
    .select("keywords, confirmed_at, embedding")
    .eq("user_id", userId)
    .maybeSingle<StyleProfileRow>();

  if (profileError) throw profileError;
  if (!profileRow || !profileRow.confirmed_at) {
    return NextResponse.json({ error: "No confirmed style profile for this user." }, { status: 404 });
  }

  const { data: scannedRows, error: scanError } = await supabase
    .from("scanned_products")
    .select("store_domain, product_id, product, vocab_version, embedding")
    .eq("store_domain", storeDomain);

  if (scanError) throw scanError;

  const rows = ((scannedRows ?? []) as ScannedRow[])
    .filter((row) => row.vocab_version === VOCAB_VERSION);

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "No scanned products found for this store. Run a scan first." },
      { status: 404 },
    );
  }

  const [profileVector, products] = await Promise.all([
    profileEmbedding(userId, profileRow),
    productsWithEmbeddings(rows),
  ]);
  const matches = rankMatches(products, profileVector);

  return NextResponse.json({ storeDomain, matches });
}
