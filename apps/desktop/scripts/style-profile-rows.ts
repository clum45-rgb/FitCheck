import type { StyleProfile, StyleTags } from "../src/style-profile.ts";
import { assertUserId, requireSupabase } from "./style-photos.ts";

export type SavedStyleProfile = {
  id: string;
  user_id: string;
  aesthetic: string;
  keywords: StyleTags;
  colors: string[];
  silhouettes: string[];
  materials: string[];
  categories: string[];
  confirmed_at: string | null;
};

const profileColumns =
  "id,user_id,aesthetic,keywords,colors,silhouettes,materials,categories,confirmed_at";

async function rest(path: string, init?: RequestInit) {
  const { supabaseUrl, serviceRoleKey } = requireSupabase();
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...init?.headers,
    },
  });
  const body = (await response.json()) as SavedStyleProfile[] | { message?: string; code?: string };
  if (!response.ok || !Array.isArray(body)) {
    const message = Array.isArray(body) ? undefined : body.message;
    if (message?.includes("row-level security")) {
      throw new Error(
        "Supabase blocked the save. The key in .env is the public key. Replace SUPABASE_SERVICE_ROLE_KEY with the secret key.",
      );
    }
    throw new Error(message ?? `Could not update style_profiles (${response.status}).`);
  }
  return body;
}

export async function saveStyleProfile(userId: string, profile: StyleProfile) {
  assertUserId(userId);
  const rows = await rest("style_profiles", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      aesthetic: profile.aesthetic,
      keywords: profile.keywords,
      colors: profile.colors,
      silhouettes: profile.silhouettes,
      materials: profile.materials,
      categories: profile.categories,
    }),
  });
  const saved = rows[0];
  if (!saved) throw new Error("Supabase did not return the saved profile.");
  return saved;
}

export async function confirmStyleProfile(userId: string) {
  assertUserId(userId);
  const pending = await rest(
    `style_profiles?select=${profileColumns}&user_id=eq.${userId}&confirmed_at=is.null&order=created_at.desc&limit=1`,
  );
  const row = pending[0];
  if (!row) return null;

  const confirmed = await rest(`style_profiles?id=eq.${row.id}`, {
    method: "PATCH",
    body: JSON.stringify({ confirmed_at: new Date().toISOString() }),
  });
  const saved = confirmed[0];
  if (!saved) throw new Error("Supabase did not return the confirmed profile.");
  return saved;
}
