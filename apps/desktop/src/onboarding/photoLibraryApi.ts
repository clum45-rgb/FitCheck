import { supabase } from "../lib/supabase";

export const SIGNED_PHOTO_URL_TTL_SECONDS = 60 * 60;

export type UserPhoto = {
  id: string;
  user_id: string;
  storage_path: string;
  created_at: string;
  signedUrl?: string;
};

async function getAuthenticatedUserId() {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? "Sign in again to access your photos.");
  return user.id;
}

export async function getUserPhotoMetadata(): Promise<UserPhoto[]> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const userId = await getAuthenticatedUserId();
  const { data, error } = await supabase
    .from("style_photos")
    .select("id, user_id, storage_path, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getUserPhotoCount() {
  if (!supabase) throw new Error("Supabase is not configured.");
  const userId = await getAuthenticatedUserId();
  const { count, error } = await supabase
    .from("style_photos")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) throw error;
  return count ?? 0;
}

export async function createSignedPhotoUrl(storagePath: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const userId = await getAuthenticatedUserId();
  if (!storagePath.startsWith(`${userId}/`)) throw new Error("This photo does not belong to the signed-in user.");

  const { data, error } = await supabase.storage
    .from("style-photos")
    .createSignedUrl(storagePath, SIGNED_PHOTO_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? "Could not create a private photo preview.");
  return data.signedUrl;
}

export async function getUserPhotoGallery(): Promise<UserPhoto[]> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const [photos, userId] = await Promise.all([getUserPhotoMetadata(), getAuthenticatedUserId()]);
  const invalidPath = photos.find((photo) => !photo.storage_path.startsWith(`${userId}/`));
  if (invalidPath) throw new Error("A saved photo path does not match your account. Contact support before changing it.");
  if (photos.length === 0) return [];

  const { data, error } = await supabase.storage
    .from("style-photos")
    .createSignedUrls(photos.map(({ storage_path }) => storage_path), SIGNED_PHOTO_URL_TTL_SECONDS);
  if (error) throw error;
  const urlsByPath = new Map((data ?? []).map(({ path, signedUrl }) => [path, signedUrl]));

  return photos.map((photo) => ({
    ...photo,
    signedUrl: urlsByPath.get(photo.storage_path) || undefined,
  }));
}

export type PhotoDeletionRepository = {
  removeStorageObject: (storagePath: string) => Promise<void>;
  deleteMetadataRecord: (userId: string, photo: UserPhoto) => Promise<void>;
};

export async function deleteOwnedPhoto(repository: PhotoDeletionRepository, userId: string, photo: UserPhoto) {
  if (photo.user_id !== userId || !photo.storage_path.startsWith(`${userId}/`)) {
    throw new Error("This photo does not belong to the signed-in user.");
  }

  await repository.removeStorageObject(photo.storage_path);
  await repository.deleteMetadataRecord(userId, photo);
}

export async function deleteUserPhoto(photo: UserPhoto) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const userId = await getAuthenticatedUserId();
  const client = supabase;

  await deleteOwnedPhoto({
    async removeStorageObject(storagePath) {
      const { error } = await client.storage.from("style-photos").remove([storagePath]);
      if (error) throw new Error(`The photo was not removed from Storage: ${error.message}`);
    },
    async deleteMetadataRecord(ownerId, savedPhoto) {
      const { data, error } = await client
        .from("style_photos")
        .delete()
        .eq("id", savedPhoto.id)
        .eq("user_id", ownerId)
        .eq("storage_path", savedPhoto.storage_path)
        .select("id")
        .maybeSingle();
      if (error || !data) {
        throw new Error(`The image file was removed, but its photo record could not be confirmed deleted. Refresh and try again. ${error?.message ?? ""}`);
      }
    },
  }, userId, photo);
}