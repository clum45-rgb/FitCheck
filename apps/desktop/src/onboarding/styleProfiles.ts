import { supabase } from "../lib/supabase";
import {
  MAX_AESTHETIC_LENGTH,
  STYLE_TAG_FIELDS,
  STYLE_TAG_VOCAB,
  aestheticTitle,
  addProfileTag,
  coerceProfileTags,
  emptyProfileTags,
  limitAestheticTitle,
  normalizeProfileTagKey,
  profileTagCount,
  type ProfileTags,
} from "../style-profile";

const PROFILE_METADATA_KEY = "__fitcheck";
const profileEmbeddingUrl = "http://localhost:3000/api/profile-embedding";

export type ProfilePreferenceState = {
  version: 1;
  manualTags: ProfileTags;
  keptTags: ProfileTags;
  dismissedTags: ProfileTags;
  aiTags: ProfileTags;
  lastAnalysisSignature: string | null;
};

const profileEmbeddingUrl = "http://localhost:3000/api/profile-embedding";

export type ConfirmedStyleProfile = {
  aesthetic: string;
  keywords: ProfileTags;
  confirmed_at: string | null;
  preferenceState: ProfilePreferenceState;
};

export type StyleProfileRepository = {
  saveStyleProfile: (aesthetic: string, keywords: ProfileTags, preferenceState?: ProfilePreferenceState, confirm?: boolean) => Promise<void>;
  markOnboardingComplete: () => Promise<void>;
};

export function normalizeStyleProfile(aesthetic: string, keywords: unknown) {
  const normalizedAesthetic = aesthetic.trim();
  const normalizedKeywords = coerceProfileTags(keywords);
  if (!normalizedAesthetic) throw new Error("Add an aesthetic label before confirming.");
  if (normalizedAesthetic.length > MAX_AESTHETIC_LENGTH) throw new Error(`Aesthetic labels must be ${MAX_AESTHETIC_LENGTH} characters or fewer.`);
  if (profileTagCount(normalizedKeywords) === 0) throw new Error("Keep at least one style tag before confirming.");
  return { aesthetic: normalizedAesthetic, keywords: normalizedKeywords };
}

export function emptyProfilePreferenceState(): ProfilePreferenceState {
  return {
    version: 1,
    manualTags: emptyProfileTags(),
    keptTags: emptyProfileTags(),
    dismissedTags: emptyProfileTags(),
    aiTags: emptyProfileTags(),
    lastAnalysisSignature: null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function legacyProfileTags(value: unknown): ProfileTags {
  if (isRecord(value)) return coerceProfileTags(value);
  const tags = emptyProfileTags();
  if (!Array.isArray(value)) return tags;
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    const separator = trimmed.indexOf(":");
    if (separator > 0) {
      const field = trimmed.slice(0, separator).trim().toLowerCase();
      const tag = trimmed.slice(separator + 1).trim();
      if (STYLE_TAG_FIELDS.includes(field as (typeof STYLE_TAG_FIELDS)[number])) {
        const result = addProfileTag(tags, field as (typeof STYLE_TAG_FIELDS)[number], tag);
        if (!result.error) Object.assign(tags, result.tags);
        continue;
      }
    }
    const normalized = normalizeProfileTagKey(trimmed);
    const field = STYLE_TAG_FIELDS.find((candidate) => STYLE_TAG_VOCAB[candidate]
      .some((known) => normalizeProfileTagKey(known) === normalized)) ?? "aesthetic";
    const result = addProfileTag(tags, field, trimmed);
    if (!result.error) Object.assign(tags, result.tags);
  }
  return tags;
}

export function readProfilePreferenceState(value: unknown, legacyKeywords?: unknown): ProfilePreferenceState {
  const metadata = isRecord(value) && value.version === 1
    ? value
    : isRecord(value) && isRecord(value[PROFILE_METADATA_KEY])
      ? value[PROFILE_METADATA_KEY]
      : isRecord(legacyKeywords) && isRecord(legacyKeywords[PROFILE_METADATA_KEY])
        ? legacyKeywords[PROFILE_METADATA_KEY]
        : null;
  if (!metadata) return { ...emptyProfilePreferenceState(), aiTags: legacyProfileTags(legacyKeywords ?? value) };
  return {
    version: 1,
    manualTags: coerceProfileTags(metadata.manualTags),
    keptTags: coerceProfileTags(metadata.keptTags),
    dismissedTags: coerceProfileTags(metadata.dismissedTags),
    aiTags: metadata.aiTags === undefined ? legacyProfileTags(legacyKeywords) : coerceProfileTags(metadata.aiTags),
    lastAnalysisSignature: typeof metadata.lastAnalysisSignature === "string" ? metadata.lastAnalysisSignature : null,
  };
}

function withoutTags(tags: ProfileTags, excluded: ProfileTags): ProfileTags {
  return Object.fromEntries(STYLE_TAG_FIELDS.map((field) => [
    field,
    tags[field].filter((tag) => !excluded[field].some((item) => normalizeProfileTagKey(item) === normalizeProfileTagKey(tag))),
  ])) as ProfileTags;
}

export function mergeProfileTags(...groups: ProfileTags[]): ProfileTags {
  const merged = emptyProfileTags();
  for (const group of groups) {
    for (const field of STYLE_TAG_FIELDS) {
      for (const tag of group[field]) {
        if (merged[field].some((current) => normalizeProfileTagKey(current) === normalizeProfileTagKey(tag))) continue;
        if (merged[field].length >= 5) continue;
        merged[field].push(tag);
      }
    }
  }
  return merged;
}

export function profileTagsFromPreferenceState(state: ProfilePreferenceState): ProfileTags {
  return mergeProfileTags(
    state.manualTags,
    state.keptTags,
    withoutTags(state.aiTags, state.dismissedTags),
  );
}

export function flattenProfileTags(keywords: ProfileTags): string[] {
  const flat: string[] = [];
  for (const field of STYLE_TAG_FIELDS) {
    for (const tag of keywords[field]) {
      if (!flat.some((current) => normalizeProfileTagKey(current) === normalizeProfileTagKey(tag))) flat.push(tag);
    }
  }
  return flat;
}

function normalizedTagsForSignature(tags: ProfileTags) {
  return Object.fromEntries(STYLE_TAG_FIELDS.map((field) => [
    field,
    tags[field].map(normalizeProfileTagKey).sort(),
  ]));
}

export function profileAnalysisSignature(
  photoPaths: string[],
  preferences: Pick<ProfilePreferenceState, "manualTags" | "keptTags" | "dismissedTags">,
) {
  return JSON.stringify({
    photoPaths: [...photoPaths].sort(),
    manualTags: normalizedTagsForSignature(preferences.manualTags),
    keptTags: normalizedTagsForSignature(preferences.keptTags),
    dismissedTags: normalizedTagsForSignature(preferences.dismissedTags),
  });
}

export async function persistConfirmedStyleProfile(
  repository: StyleProfileRepository,
  aesthetic: string,
  keywords: unknown,
  preferenceState = emptyProfilePreferenceState(),
) {
  const profile = normalizeStyleProfile(aesthetic, keywords);
  await repository.saveStyleProfile(profile.aesthetic, profile.keywords, preferenceState);
  try {
    await repository.markOnboardingComplete();
  } catch {
    throw new Error("Your style profile was saved, but onboarding could not be completed. Retry confirmation to finish.");
  }
}

export async function persistEditedStyleProfile(
  repository: StyleProfileRepository,
  aesthetic: string,
  keywords: unknown,
  preferenceState = emptyProfilePreferenceState(),
  confirm = true,
) {
  const profile = normalizeStyleProfile(aesthetic, keywords);
  await repository.saveStyleProfile(profile.aesthetic, profile.keywords, preferenceState, confirm);
  return profile;
}

function createStyleProfileRepository(userId: string): StyleProfileRepository {
  if (!supabase) throw new Error("Supabase is not configured.");
  const client = supabase;

  return {
    async saveStyleProfile(aesthetic, keywords, preferenceState = emptyProfilePreferenceState(), confirm = true) {
      const now = new Date().toISOString();
      const fields = {
        keywords,
        preference_state: preferenceState,
        updated_at: now,
      };
      if (!confirm) {
        const { error } = await client
          .from("style_profiles")
          .update(fields)
          .eq("user_id", userId)
          .select("user_id")
          .single();
        if (error) throw error;
        return;
      }
      const { error } = await client
        .from("style_profiles")
        .upsert({
          user_id: userId,
          aesthetic,
          ...fields,
          confirmed_at: now,
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

async function storeProfileEmbedding() {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) throw new Error(error?.message ?? "Sign in again to save your style profile.");

  let response: Response;
  try {
    response = await fetch(profileEmbeddingUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
  } catch {
    throw new Error("Your style profile was saved, but its match vector could not be stored.");
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Your style profile was saved, but its match vector could not be stored.");
  }
}

export async function saveConfirmedStyleProfile(aesthetic: string, keywords: unknown, preferenceState?: ProfilePreferenceState) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? "Sign in again to save your style profile.");

  await persistConfirmedStyleProfile(createStyleProfileRepository(user.id), aesthetic, keywords, preferenceState);
  await storeProfileEmbedding();
}

export async function updateSavedStyleProfile(aesthetic: string, keywords: unknown, preferenceState?: ProfilePreferenceState, confirm = true) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? "Sign in again to save your style profile.");

  await persistEditedStyleProfile(createStyleProfileRepository(user.id), aesthetic, keywords, preferenceState, confirm);
  await storeProfileEmbedding();
}

export async function getConfirmedStyleProfile(): Promise<ConfirmedStyleProfile | null> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error(userError?.message ?? "Sign in again to view your style profile.");

  const { data, error } = await supabase
    .from("style_profiles")
    .select("aesthetic, keywords, preference_state, confirmed_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data || !data.confirmed_at) return null;
  const aesthetic = limitAestheticTitle(data.aesthetic);
  if (aesthetic !== aestheticTitle(data.aesthetic)) {
    const { error: normalizeError } = await supabase
      .from("style_profiles")
      .update({ aesthetic, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);
    if (normalizeError) throw normalizeError;
  }
  const preferenceState = readProfilePreferenceState(data.preference_state, data.keywords);
  return {
    aesthetic,
    keywords: profileTagsFromPreferenceState(preferenceState),
    confirmed_at: data.confirmed_at,
    preferenceState,
  };
}