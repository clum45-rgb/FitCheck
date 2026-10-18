import type { ShopifyRawProduct } from "./shopify";
import type { Product } from "./types";

const NOISE_TAG_PATTERN = /^[A-Za-z][A-Za-z ]*:/; // e.g. "Dimensions: 10x20", "Collection: Fall"

function parseTags(rawTags: string | string[] | undefined): string[] {
  // Shopify's products.json normally sends tags as a comma-separated string,
  // but some storefronts return an array of strings instead.
  const list = Array.isArray(rawTags) ? rawTags : (rawTags ?? "").split(",");

  return list
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0 && !NOISE_TAG_PATTERN.test(tag));
}

function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function parseColorFromTitle(title: string): string | null {
  const match = title.match(/\(([^)]+)\)/);
  return match ? match[1].trim() : null;
}

function isUsableImage(src: string): boolean {
  const filename = src.split("/").pop() ?? "";
  if (/SIZE|CHART/i.test(filename)) return false;
  if (/\.heic$/i.test(filename.split("?")[0])) return false;
  return true;
}

function withWidthParam(src: string): string {
  const [base, query] = src.split("?");
  const params = new URLSearchParams(query ?? "");
  params.set("width", "600");
  return `${base}?${params.toString()}`;
}

// Default currency per store. Shopify's public products.json doesn't expose
// the shop's currency, so this is a simple per-domain override point until
// we have a real source of truth.
const STORE_CURRENCY_OVERRIDES: Record<string, string> = {};

function currencyForStore(storeDomain: string): string {
  return STORE_CURRENCY_OVERRIDES[storeDomain] ?? "USD";
}

export function normalizeProduct(raw: ShopifyRawProduct, storeDomain: string): Product {
  const firstVariant = raw.variants[0];

  return {
    id: String(raw.id),
    storeDomain,
    title: raw.title,
    handle: raw.handle,
    url: `https://${storeDomain}/products/${raw.handle}`,
    price: firstVariant ? parseFloat(firstVariant.price) : 0,
    currency: currencyForStore(storeDomain),
    productType: raw.product_type ?? "",
    tags: parseTags(raw.tags),
    available: raw.variants.some((v) => v.available ?? true),
    description: stripHtml(raw.body_html ?? ""),
    colorFromTitle: parseColorFromTitle(raw.title),
    images: raw.images
      .map((img) => img.src)
      .filter(isUsableImage)
      .slice(0, 2)
      .map(withWidthParam),
    updatedAt: raw.updated_at,
  };
}
