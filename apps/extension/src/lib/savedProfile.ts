import { supabase } from "./supabase";

const tagFields = [
  ["category", "Category"],
  ["fit", "Fit"],
  ["color", "Color"],
  ["material", "Material"],
  ["aesthetic", "Aesthetic"],
] as const;

export type StyleTagGroup = {
  label: string;
  values: string[];
};

export type SavedStyle = {
  aesthetic: string;
  tags: StyleTagGroup[];
};

export type InspirationPhoto = {
  id: string;
  url: string;
};

export type SavedProfile = {
  style: SavedStyle | null;
  photos: InspirationPhoto[];
};

function stringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function aestheticTitle(value: unknown) {
  if (typeof value === "string") return value.trim();
  return stringList(value).join(" ");
}

async function signedInUserId() {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? "Sign in again to view your profile.");
  return user.id;
}

export async function loadSavedProfile(): Promise<SavedProfile> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const userId = await signedInUserId();

  const [styleResult, photoResult] = await Promise.all([
    supabase
      .from("style_profiles")
      .select("aesthetic, keywords")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("style_photos")
      .select("id, storage_path")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
  ]);

  if (styleResult.error) throw styleResult.error;
  if (photoResult.error) throw photoResult.error;

  const keywords = styleResult.data?.keywords;
  const keywordRecord = keywords && typeof keywords === "object" && !Array.isArray(keywords)
    ? keywords as Record<string, unknown>
    : {};
  const style = styleResult.data
    ? {
        aesthetic: aestheticTitle(styleResult.data.aesthetic),
        tags: tagFields
          .map(([field, label]) => ({ label, values: stringList(keywordRecord[field]) }))
          .filter((group) => group.values.length > 0),
      }
    : null;

  const photos = photoResult.data ?? [];
  const ownedPhotos = photos.filter((photo) => photo.storage_path.startsWith(`${userId}/`));
  if (ownedPhotos.length === 0) return { style, photos: [] };

  const { data: signed, error: signedError } = await supabase.storage
    .from("style-photos")
    .createSignedUrls(ownedPhotos.map((photo) => photo.storage_path), 60 * 60);
  if (signedError) throw signedError;

  const urlsByPath = new Map((signed ?? []).map((item) => [item.path, item.signedUrl]));
  return {
    style,
    photos: ownedPhotos.flatMap((photo) => {
      const url = urlsByPath.get(photo.storage_path);
      return url ? [{ id: photo.id, url }] : [];
    }),
  };
}
