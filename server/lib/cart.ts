import { getSupabaseAdmin } from "./supabaseAdmin";
import type { CartItem } from "./types";

const TABLE = "user_carts";

export async function getUserCart(userId: string): Promise<CartItem[]> {
  const { data, error } = await getSupabaseAdmin()
    .from(TABLE)
    .select("items")
    .eq("user_id", userId)
    .maybeSingle<{ items: CartItem[] }>();

  if (error) throw error;
  return data?.items ?? [];
}

// Read-then-upsert, not atomic — a real race (two rapid approve clicks for
// the same user) could drop one. Fine for a single-user demo; the correct
// fix later is a Postgres function doing the append+dedupe in one statement
// via .rpc().
export async function approveProduct(userId: string, item: Omit<CartItem, "approvedAt">): Promise<CartItem[]> {
  const current = await getUserCart(userId);
  const approvedAt = new Date().toISOString();
  const withoutExisting = current.filter((existing) => existing.productId !== item.productId);
  const items = [...withoutExisting, { ...item, approvedAt }];

  const { error } = await getSupabaseAdmin()
    .from(TABLE)
    .upsert(
      { user_id: userId, items, updated_at: approvedAt },
      { onConflict: "user_id" },
    );

  if (error) throw error;
  return items;
}

// Same not-atomic caveat as approveProduct above.
export async function removeProduct(userId: string, productId: string): Promise<CartItem[]> {
  const current = await getUserCart(userId);
  const items = current.filter((existing) => existing.productId !== productId);

  const { error } = await getSupabaseAdmin()
    .from(TABLE)
    .upsert(
      { user_id: userId, items, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );

  if (error) throw error;
  return items;
}
