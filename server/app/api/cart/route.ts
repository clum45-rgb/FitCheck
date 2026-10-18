import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";
import { getUserCart } from "@/lib/cart";

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    const items = await getUserCart(userId);
    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Your cart couldn't be loaded.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
