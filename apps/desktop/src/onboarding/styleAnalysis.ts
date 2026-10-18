import { supabase } from "../lib/supabase";
import { coerceStyleTags, type ProfileTags, type StyleTags } from "../style-profile";

export type ProfileAnalysisContext = {
  aesthetic: string;
  keywords: ProfileTags;
};

export type StyleAnalysis = {
  aesthetic: string;
  keywords: StyleTags;
  isMock: false;
};

export async function analyzeStylePhotos(storagePaths: string[], context?: ProfileAnalysisContext): Promise<StyleAnalysis> {
  if (storagePaths.length === 0) throw new Error("Upload inspiration photos before analysis.");
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) throw new Error(error?.message ?? "Sign in again to analyze your photos.");

  const response = await fetch("/api/analyze-style", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ storagePaths, context }),
  });
  const body = (await response.json().catch(() => null)) as {
    error?: string;
    aesthetic?: unknown;
    keywords?: unknown;
  } | null;

  if (!response.ok) {
    throw new Error(body?.error ?? "Could not analyze these photos.");
  }
  if (!body || typeof body.aesthetic !== "string") {
    throw new Error("The style analysis did not come back in the expected shape.");
  }

  return {
    aesthetic: body.aesthetic,
    keywords: coerceStyleTags(body.keywords),
    isMock: false,
  };
}
