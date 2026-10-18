import type { ProductCardData } from "../types";

const scanApiUrl = "http://localhost:3000/api/scan";

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
