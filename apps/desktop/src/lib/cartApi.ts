/** Cart items from the extension cart API (`user_carts` via Next.js server). */

export type CartItem = {
  productId: string;
  name: string;
  imageUrl: string;
  price: string;
  url: string;
  storeDomain: string;
  approvedAt?: string;
};

type CartResponseBody = {
  error?: string;
  items?: CartItem[];
};

const apiOrigin = (import.meta.env.VITE_API_ORIGIN as string | undefined)?.replace(/\/$/, "") ?? "";

function cartUrl(path: string) {
  return `${apiOrigin}${path}`;
}

function sortNewestFirst(items: CartItem[]) {
  return [...items].sort((left, right) => {
    const leftTime = left.approvedAt ? Date.parse(left.approvedAt) : 0;
    const rightTime = right.approvedAt ? Date.parse(right.approvedAt) : 0;
    return rightTime - leftTime;
  });
}

async function readCartResponse(response: Response, fallback: string): Promise<CartItem[]> {
  const body = (await response.json().catch(() => null)) as CartResponseBody | null;
  if (!response.ok) {
    throw new Error(body?.error ?? fallback);
  }
  if (!Array.isArray(body?.items)) {
    throw new Error("The cart server returned an unexpected response.");
  }
  return sortNewestFirst(body.items);
}

export async function fetchCartItems(accessToken: string): Promise<CartItem[]> {
  let response: Response;
  try {
    response = await fetch(cartUrl("/api/cart"), {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    throw new Error("The cart server is unavailable. Start it and try again.");
  }

  return readCartResponse(response, "Your cart couldn't be loaded.");
}

export async function removeCartItem(accessToken: string, productId: string): Promise<CartItem[]> {
  let response: Response;
  try {
    response = await fetch(cartUrl("/api/cart/remove"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ productId }),
    });
  } catch {
    throw new Error("The cart server is unavailable. Start it and try again.");
  }

  return readCartResponse(response, "This piece couldn't be removed from your cart.");
}
