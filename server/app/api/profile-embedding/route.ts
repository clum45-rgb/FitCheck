import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";
import { embedTags } from "@/lib/embed";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { Tags } from "@/lib/types";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401, headers: corsHeaders });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("style_profiles")
    .select("keywords")
    .eq("user_id", userId)
    .maybeSingle<{ keywords: Tags }>();

  if (error) throw error;
  if (!data) {
    return NextResponse.json({ error: "No style profile for this user." }, { status: 404, headers: corsHeaders });
  }

  const embedding = await embedTags(data.keywords);
  const { error: updateError } = await supabase
    .from("style_profiles")
    .update({ embedding })
    .eq("user_id", userId);

  if (updateError) throw updateError;
  return NextResponse.json({ ok: true }, { headers: corsHeaders });
}
