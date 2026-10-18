import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { rankMatches } from "@/lib/match";
import { VOCAB_VERSION } from "@/lib/vocab";
import type { Tags, TaggedProduct } from "@/lib/types";

type MatchRequest = {
  storeDomain?: string;
};

type ScannedRow = {
  product: TaggedProduct;
  vocab_version: number;
};

type StyleProfileRow = {
  keywords: Tags;
  confirmed_at: string | null;
};

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
    .select("keywords, confirmed_at")
    .eq("user_id", userId)
    .maybeSingle<StyleProfileRow>();

  if (profileError) throw profileError;
  if (!profileRow || !profileRow.confirmed_at) {
    return NextResponse.json({ error: "No confirmed style profile for this user." }, { status: 404 });
  }

  const { data: scannedRows, error: scanError } = await supabase
    .from("scanned_products")
    .select("product, vocab_version")
    .eq("store_domain", storeDomain);

  if (scanError) throw scanError;

  const products = ((scannedRows ?? []) as ScannedRow[])
    .filter((row) => row.vocab_version === VOCAB_VERSION)
    .map((row) => row.product);

  if (products.length === 0) {
    return NextResponse.json(
      { error: "No scanned products found for this store. Run a scan first." },
      { status: 404 },
    );
  }

  const matches = rankMatches(products, profileRow.keywords);

  return NextResponse.json({ storeDomain, matches });
}
