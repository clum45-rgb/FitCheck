import { classifyStylePhotos } from "./classify-style.ts";
import { downloadStylePhotos, requireSupabase } from "./style-photos.ts";
import { MAX_AESTHETIC_LENGTH, coerceProfileTags } from "../src/style-profile.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function analyzeStyleRequest(authorization: string | undefined, payload: unknown) {
  const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";
  if (!token) return { status: 401, body: { error: "Sign in again to analyze your photos." } };

  const requested = payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as { storagePaths?: unknown }).storagePaths
    : undefined;
  if (!Array.isArray(requested) || requested.length === 0 || requested.some((path) => typeof path !== "string")) {
    return { status: 400, body: { error: "Choose photos from your style-photos folder before analyzing." } };
  }

  const rawContext = isRecord(payload) && isRecord(payload.context) ? payload.context : null;
  const context = rawContext && typeof rawContext.aesthetic === "string"
    && rawContext.aesthetic.trim().length <= MAX_AESTHETIC_LENGTH
    ? { aesthetic: rawContext.aesthetic.trim(), keywords: coerceProfileTags(rawContext.keywords) }
    : undefined;

  const { supabaseUrl, serviceRoleKey } = requireSupabase();
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: serviceRoleKey,
    },
  });
  const user = (await userResponse.json()) as { id?: string };
  if (!userResponse.ok || !user.id) {
    return { status: 401, body: { error: "Sign in again to analyze your photos." } };
  }

  let images;
  try {
    images = await downloadStylePhotos(user.id, requested);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read your photos.";
    return { status: 502, body: { error: message } };
  }
  if (images.length === 0) {
    return { status: 400, body: { error: "Those photos are not in your style-photos folder." } };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { status: 500, body: { error: "The style analyzer is missing its API key." } };

  try {
    const profile = await classifyStylePhotos(images, apiKey, context);
    return {
      status: 200,
      body: {
        aesthetic: profile.aesthetic,
        keywords: profile.keywords,
        colors: profile.colors,
        silhouettes: profile.silhouettes,
        materials: profile.materials,
        categories: profile.categories,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not analyze these photos.";
    return { status: 502, body: { error: message } };
  }
}
