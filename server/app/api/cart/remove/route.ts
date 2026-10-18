import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";
import { removeProduct } from "@/lib/cart";

type RemoveRequest = {
  productId?: string;
};

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as RemoveRequest | null;
    const productId = body?.productId;
    if (typeof productId !== "string" || productId.length === 0) {
      return NextResponse.json({ error: "productId is required." }, { status: 400 });
    }

    const items = await removeProduct(userId, productId);
    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "This piece couldn't be removed from your cart.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
