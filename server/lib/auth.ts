import { getSupabaseAdmin } from "./supabaseAdmin";

// Verifies the extension's real Supabase session token server-side rather
// than trusting a client-supplied user id.
export async function getUserIdFromRequest(req: Request): Promise<string | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;

  const { data, error } = await getSupabaseAdmin().auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}
