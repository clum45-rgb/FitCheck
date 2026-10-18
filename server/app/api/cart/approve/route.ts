import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";
import { approveProduct } from "@/lib/cart";

type ApproveRequest = {
  product?: {
    productId?: string;
    name?: string;
    imageUrl?: string;
    url?: string;
    storeDomain?: string;
  };
};

const REQUIRED_FIELDS = ["productId", "name", "imageUrl", "url", "storeDomain"] as const;

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as ApproveRequest | null;
  const product = body?.product;

  for (const field of REQUIRED_FIELDS) {
    if (typeof product?.[field] !== "string" || product[field]!.length === 0) {
      return NextResponse.json({ error: `product.${field} is required.` }, { status: 400 });
    }
  }

  const items = await approveProduct(userId, {
    productId: product!.productId!,
    name: product!.name!,
    imageUrl: product!.imageUrl!,
    url: product!.url!,
    storeDomain: product!.storeDomain!,
  });

  return NextResponse.json({ items });
}
