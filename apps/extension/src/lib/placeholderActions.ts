import type { CartItem, Match, ProductCardData } from "../types";

const backendOrigin = "http://localhost:3000";
const scanApiUrl = `${backendOrigin}/api/scan`;
const matchApiUrl = `${backendOrigin}/api/match`;
const approveApiUrl = `${backendOrigin}/api/cart/approve`;
const removeApiUrl = `${backendOrigin}/api/cart/remove`;

export type StoreScan = {
  storeDomain: string;
  products: ProductCardData[];
};

type ScanProduct = {
  id: string;
  title: string;
  price: number;
  currency: string;
  url: string;
  images: string[];
};

type ScanResponseBody = {
  error?: string;
  storeDomain?: string;
  products?: ScanProduct[];
};

export async function scanCurrentPage(): Promise<StoreScan> {
  const origin = await currentStoreOrigin();

  let response: Response;
  try {
    response = await fetch(scanApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin }),
    });
  } catch {
    throw new Error("The scan server is unavailable. Start it and try again.");
  }

  const body = (await response.json().catch(() => null)) as ScanResponseBody | null;
  if (!response.ok) {
    throw new Error(body?.error ?? "This store doesn't have a Shopify product catalog.");
  }
  if (!body?.storeDomain || !Array.isArray(body.products)) {
    throw new Error("The scan server returned an unexpected response.");
  }

  return {
    storeDomain: body.storeDomain,
    products: body.products.map((product) => ({
      name: product.title,
      imageUrl: product.images[0] ?? "",
      price: `${product.currency} ${product.price.toFixed(2)}`,
      url: product.url,
      matchLabel: "Scanned",
    })),
  };
}

async function currentStoreOrigin() {
  if (typeof chrome === "undefined" || !chrome.tabs?.query) {
    throw new Error("FitFinder can only scan from the Chrome side panel.");
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) {
    throw new Error("FitFinder can't read this page. Open a store tab and try again.");
  }

  let pageUrl: URL;
  try {
    pageUrl = new URL(tab.url);
  } catch {
    throw new Error("FitFinder can only scan http and https stores.");
  }

  if (pageUrl.protocol !== "http:" && pageUrl.protocol !== "https:") {
    throw new Error("FitFinder can only scan http and https stores.");
  }

  return pageUrl.origin;
}

export async function saveStyleProfile(): Promise<never> {
  throw new Error("Saving style preferences isn't implemented yet.");
}

export async function uploadInspirationPhotos(): Promise<never> {
  throw new Error("Photo uploads aren't implemented yet.");
}

type MatchProduct = {
  id: string;
  title: string;
  price: number;
  currency: string;
  url: string;
  images: string[];
  matchScore: number;
  matchLabel: string;
};

type MatchResponseBody = {
  error?: string;
  storeDomain?: string;
  matches?: MatchProduct[];
};

export async function fetchMatches(accessToken: string, storeDomain: string): Promise<Match[]> {
  let response: Response;
  try {
    response = await fetch(matchApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ storeDomain }),
    });
  } catch {
    throw new Error("The match server is unavailable. Start it and try again.");
  }

  const body = (await response.json().catch(() => null)) as MatchResponseBody | null;
  if (!response.ok) {
    throw new Error(body?.error ?? "Matches couldn't be loaded.");
  }
  if (!Array.isArray(body?.matches)) {
    throw new Error("The match server returned an unexpected response.");
  }

  return body.matches.map((product) => ({
    productId: product.id,
    name: product.title,
    imageUrl: product.images[0] ?? "",
    price: `${product.currency} ${product.price.toFixed(2)}`,
    url: product.url,
    matchLabel: product.matchLabel,
    matchScore: product.matchScore,
    storeDomain,
  }));
}

type ApproveResponseBody = {
  error?: string;
  items?: CartItem[];
};

export async function approveMatch(accessToken: string, match: Match): Promise<void> {
  let response: Response;
  try {
    response = await fetch(approveApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        product: {
          productId: match.productId,
          name: match.name,
          imageUrl: match.imageUrl,
          url: match.url,
          storeDomain: match.storeDomain,
        },
      }),
    });
  } catch {
    throw new Error("The cart server is unavailable. Start it and try again.");
  }

  const body = (await response.json().catch(() => null)) as ApproveResponseBody | null;
  if (!response.ok) {
    throw new Error(body?.error ?? "This piece couldn't be added to your cart.");
  }
}

export async function removeFromCart(accessToken: string, productId: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(removeApiUrl, {
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

  const body = (await response.json().catch(() => null)) as ApproveResponseBody | null;
  if (!response.ok) {
    throw new Error(body?.error ?? "This piece couldn't be removed from your cart.");
  }
}

export async function navigateCurrentTab(url: string): Promise<void> {
  if (typeof chrome === "undefined" || !chrome.tabs?.query || !chrome.tabs.update) {
    throw new Error("FitFinder can only navigate from the Chrome side panel.");
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error("FitFinder can't find the current tab.");
  }

  await chrome.tabs.update(tab.id, { url });
}
