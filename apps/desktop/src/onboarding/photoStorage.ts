import { supabase } from "../lib/supabase";
import { MAX_PHOTO_COUNT, MAX_PHOTO_SIZE_BYTES, detectImageType, fileExtensionForType, type SupportedImageType } from "./photoValidation";

export type PhotoUploadProgress = {
  complete: number;
  total: number;
  fileIndex: number;
  fileName: string;
  status: "saved" | "failed";
};

export type PhotoUploadFailure = {
  fileIndex: number;
  fileName: string;
  message: string;
};

export type PhotoUploadResult = {
  saved: Array<{ fileIndex: number; fileName: string; storagePath: string }>;
  failed: PhotoUploadFailure[];
};

export type PhotoUploadRepository = {
  getPhotoCount: (userId: string) => Promise<number>;
  uploadObject: (storagePath: string, file: File, contentType: SupportedImageType) => Promise<void>;
  insertPhotoRecord: (userId: string, storagePath: string) => Promise<void>;
  removePhotoRecord: (userId: string, storagePath: string) => Promise<void>;
  removeObject: (storagePath: string) => Promise<void>;
};

export class PhotoUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PhotoUploadError";
  }
}

export async function uploadPhotoFiles(
  repository: PhotoUploadRepository,
  userId: string,
  files: File[],
  onProgress?: (progress: PhotoUploadProgress) => void,
): Promise<PhotoUploadResult> {
  const result: PhotoUploadResult = { saved: [], failed: [] };

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    let savedCount: number;
    try {
      savedCount = await repository.getPhotoCount(userId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not check your saved photo count.";
      result.failed.push(...files.slice(index).map((remainingFile, offset) => ({ fileIndex: index + offset, fileName: remainingFile.name, message })));
      break;
    }

    if (savedCount >= MAX_PHOTO_COUNT) {
      result.failed.push(...files.slice(index).map((remainingFile, offset) => ({
        fileIndex: index + offset,
        fileName: remainingFile.name,
        message: `Your ${MAX_PHOTO_COUNT}-photo collection is full. Remove a photo before adding more.`,
      })));
      break;
    }

    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      result.failed.push({ fileIndex: index, fileName: file.name, message: "Each photo must be 5 MB or smaller." });
      onProgress?.({ complete: index + 1, total: files.length, fileIndex: index, fileName: file.name, status: "failed" });
      continue;
    }

    const imageType = await detectImageType(file);
    if (!imageType) {
      result.failed.push({ fileIndex: index, fileName: file.name, message: "Choose a valid JPEG, PNG, or WebP image." });
      onProgress?.({ complete: index + 1, total: files.length, fileIndex: index, fileName: file.name, status: "failed" });
      continue;
    }

    const storagePath = `${userId}/${crypto.randomUUID()}.${fileExtensionForType(imageType)}`;
    let uploadAttempted = false;
    try {
      uploadAttempted = true;
      await repository.uploadObject(storagePath, file, imageType);
      await repository.insertPhotoRecord(userId, storagePath);
      result.saved.push({ fileIndex: index, fileName: file.name, storagePath });
      onProgress?.({ complete: index + 1, total: files.length, fileIndex: index, fileName: file.name, status: "saved" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Photo upload failed.";
      const cleanupMessages: string[] = [];
      if (uploadAttempted) {
        try {
          await repository.removePhotoRecord(userId, storagePath);
        } catch (cleanupError) {
          cleanupMessages.push(`The photo record may need cleanup: ${cleanupError instanceof Error ? cleanupError.message : "request failed"}.`);
        }
        try {
          await repository.removeObject(storagePath);
        } catch (cleanupError) {
          cleanupMessages.push(`The uploaded file may need cleanup: ${cleanupError instanceof Error ? cleanupError.message : "request failed"}.`);
        }
      }
      result.failed.push({ fileIndex: index, fileName: file.name, message: [message, ...cleanupMessages].join(" ") });
      onProgress?.({ complete: index + 1, total: files.length, fileIndex: index, fileName: file.name, status: "failed" });
    }
  }

  return result;
}

function createSupabasePhotoRepository(): PhotoUploadRepository {
  if (!supabase) throw new PhotoUploadError("Supabase is not configured.");
  const client = supabase;

  return {
    async getPhotoCount(userId) {
      const { count, error } = await client
        .from("style_photos")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      if (error) throw error;
      return count ?? 0;
    },
    async uploadObject(storagePath, file, contentType) {
      const { error } = await client.storage.from("style-photos").upload(storagePath, file, {
        contentType,
        upsert: false,
      });
      if (error) throw error;
    },
    async insertPhotoRecord(userId, storagePath) {
      const { error } = await client.from("style_photos").insert({ user_id: userId, storage_path: storagePath });
      if (error) throw error;
    },
    async removePhotoRecord(userId, storagePath) {
      const { error } = await client
        .from("style_photos")
        .delete()
        .eq("user_id", userId)
        .eq("storage_path", storagePath);
      if (error) throw error;
    },
    async removeObject(storagePath) {
      const { error } = await client.storage.from("style-photos").remove([storagePath]);
      if (error) throw error;
    },
  };
}

export async function uploadInspirationPhotos(
  files: File[],
  onProgress?: (progress: PhotoUploadProgress) => void,
): Promise<PhotoUploadResult> {
  if (!supabase) throw new PhotoUploadError("Supabase is not configured.");
  if (files.length === 0) throw new PhotoUploadError("Select at least one photo first.");

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new PhotoUploadError(error?.message ?? "Sign in again to upload photos.");

  return uploadPhotoFiles(createSupabasePhotoRepository(), user.id, files, onProgress);
}