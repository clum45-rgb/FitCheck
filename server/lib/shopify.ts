export class ShopifyFetchError extends Error {}

export type ShopifyRawVariant = {
  id: number;
  price: string;
  available?: boolean;
};

export type ShopifyRawImage = {
  src: string;
};

export type ShopifyRawProduct = {
  id: number;
  title: string;
  body_html: string;
  product_type: string;
  handle: string;
  updated_at: string;
  tags: string | string[];
  variants: ShopifyRawVariant[];
  images: ShopifyRawImage[];
};

const PAGE_LIMIT = 250;
const REQUEST_DELAY_MS = 1000;
const MAX_PAGES = 200; // safety cap against a misbehaving/malicious endpoint

// Some storefronts' bot protection (e.g. Cloudflare) blocks requests with no
// User-Agent, which is what Node's fetch sends by default.
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MAX_RETRIES_PER_PAGE = 3;

async function fetchPage(url: string): Promise<Response> {
  for (let attempt = 1; attempt <= MAX_RETRIES_PER_PAGE; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      });
    } catch {
      throw new ShopifyFetchError("not a supported Shopify store");
    }

    if (res.status === 429 && attempt < MAX_RETRIES_PER_PAGE) {
      await sleep(REQUEST_DELAY_MS * attempt * 2);
      continue;
    }

    return res;
  }

  throw new ShopifyFetchError("not a supported Shopify store");
}

export async function fetchAllProducts(origin: string): Promise<ShopifyRawProduct[]> {
  const products: ShopifyRawProduct[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    if (page > 1) {
      await sleep(REQUEST_DELAY_MS);
    }

    const url = `${origin}/products.json?limit=${PAGE_LIMIT}&page=${page}`;
    const res = await fetchPage(url);

    if (!res.ok) {
      throw new ShopifyFetchError("not a supported Shopify store");
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      throw new ShopifyFetchError("not a supported Shopify store");
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new ShopifyFetchError("not a supported Shopify store");
    }

    const pageProducts = (json as { products?: unknown })?.products;
    if (!Array.isArray(pageProducts)) {
      throw new ShopifyFetchError("not a supported Shopify store");
    }

    if (pageProducts.length === 0) {
      break;
    }

    products.push(...(pageProducts as ShopifyRawProduct[]));
  }

  return products;
}
