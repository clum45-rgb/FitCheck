import { supabase } from "../lib/supabase";

export type ConfirmedStyleProfile = {
  aesthetic: string;
  keywords: string[];
  confirmed_at: string | null;
};

export type StyleProfileRepository = {
  saveStyleProfile: (aesthetic: string, keywords: string[]) => Promise<void>;
  markOnboardingComplete: () => Promise<void>;
};

export function normalizeStyleProfile(aesthetic: string, keywords: string[]) {
  const normalizedAesthetic = aesthetic.trim();
  const normalizedKeywords = [...new Set(keywords.map((keyword) => keyword.trim()).filter(Boolean))];
  if (!normalizedAesthetic) throw new Error("Add an aesthetic label before confirming.");
  if (normalizedKeywords.length === 0) throw new Error("Keep at least one style keyword before confirming.");
  return { aesthetic: normalizedAesthetic, keywords: normalizedKeywords };
}

export async function persistConfirmedStyleProfile(
  repository: StyleProfileRepository,
  aesthetic: string,
  keywords: string[],
) {
  const profile = normalizeStyleProfile(aesthetic, keywords);
  await repository.saveStyleProfile(profile.aesthetic, profile.keywords);
  try {
    await repository.markOnboardingComplete();
  } catch {
    throw new Error("Your style profile was saved, but onboarding could not be completed. Retry confirmation to finish.");
  }
}

export async function persistEditedStyleProfile(
  repository: StyleProfileRepository,
  aesthetic: string,
  keywords: string[],
) {
  const profile = normalizeStyleProfile(aesthetic, keywords);
  await repository.saveStyleProfile(profile.aesthetic, profile.keywords);
  return profile;
}

function createStyleProfileRepository(userId: string): StyleProfileRepository {
  if (!supabase) throw new Error("Supabase is not configured.");
  const client = supabase;

  return {
    async saveStyleProfile(aesthetic, keywords) {
      const now = new Date().toISOString();
      const { error } = await client
        .from("style_profiles")
        .upsert({
          user_id: userId,
          aesthetic,
          keywords,
          confirmed_at: now,
          updated_at: now,
        }, { onConflict: "user_id" });
      if (error) throw error;
    },
    async markOnboardingComplete() {
      const { error } = await client
        .from("profiles")
        .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
        .eq("id", userId)
        .select("id")
        .single();
      if (error) throw error;
    },
  };
}

export async function saveConfirmedStyleProfile(aesthetic: string, keywords: string[]) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? "Sign in again to save your style profile.");

  await persistConfirmedStyleProfile(createStyleProfileRepository(user.id), aesthetic, keywords);
}

export async function updateSavedStyleProfile(aesthetic: string, keywords: string[]) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? "Sign in again to save your style profile.");

  await persistEditedStyleProfile(createStyleProfileRepository(user.id), aesthetic, keywords);
}

export async function getConfirmedStyleProfile(): Promise<ConfirmedStyleProfile | null> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error(userError?.message ?? "Sign in again to view your style profile.");

  const { data, error } = await supabase
    .from("style_profiles")
    .select("aesthetic, keywords, confirmed_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data || !data.confirmed_at) return null;
  return data;
}