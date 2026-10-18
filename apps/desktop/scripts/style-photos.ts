import { readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { normalizeStylePhotoPath, selectOwnedPhotoPaths } from "../src/style-photo-paths.ts";

export const stylePhotoBucket = "style-photos";

const mimeTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export type StylePhoto = {
  name: string;
  mimeType: string;
  base64: string;
};

const userIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function loadEnvFile(path: string) {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return;
  }

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

export function loadProjectEnv(scriptDir: string) {
  loadEnvFile(resolve(scriptDir, "../../../.env"));
}

export function requireSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.");
  }
  return { supabaseUrl, serviceRoleKey };
}

function objectPath(storagePath: string) {
  return normalizeStylePhotoPath(storagePath);
}

export function assertUserId(userId: string | undefined) {
  if (!userId || !userIdPattern.test(userId)) {
    throw new Error("Pass a user id, like npm run analyze:style -w @fitcheck/desktop -- USER_ID");
  }
  return userId;
}

export async function listStylePhotoPaths(userId: string) {
  assertUserId(userId);

  const { supabaseUrl, serviceRoleKey } = requireSupabase();
  const response = await fetch(
    `${supabaseUrl}/rest/v1/style_photos?select=storage_path&user_id=eq.${userId}&order=created_at.asc`,
    {
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
    },
  );

  const body = (await response.json()) as Array<{ storage_path: string | null }> | { message?: string };
  if (!response.ok || !Array.isArray(body)) {
    const message = Array.isArray(body) ? undefined : body.message;
    throw new Error(message ?? `Could not read style_photos (${response.status}).`);
  }

  return body.flatMap((row) => (row.storage_path ? [objectPath(row.storage_path)] : []));
}

export async function downloadStylePhotos(userId: string, requestedPaths?: string[]): Promise<StylePhoto[]> {
  const { supabaseUrl, serviceRoleKey } = requireSupabase();
  const storedPaths = await listStylePhotoPaths(userId);
  const paths = requestedPaths ? selectOwnedPhotoPaths(userId, storedPaths, requestedPaths) : storedPaths;
  const photos: StylePhoto[] = [];

  for (const path of paths) {
    const mimeType = mimeTypes[extname(path).toLowerCase()];
    if (!mimeType) continue;

    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    const response = await fetch(`${supabaseUrl}/storage/v1/object/${stylePhotoBucket}/${encodedPath}`, {
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Could not download ${path} (${response.status}).`);
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    photos.push({
      name: path,
      mimeType,
      base64: bytes.toString("base64"),
    });
  }

  return photos;
}
