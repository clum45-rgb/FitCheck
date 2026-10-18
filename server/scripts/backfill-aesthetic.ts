import { createClient } from "@supabase/supabase-js";
import { ruleTag } from "../lib/ruleTag";
import { tagProducts } from "../lib/llmTag";
import { saveProducts } from "../lib/cache";
import type { Product, TaggedProduct, Tags } from "../lib/types";

const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

const STORE_DOMAIN = "mutimer.co";

async function main() {
  const { data, error } = await client
    .from("scanned_products")
    .select("product_id, product, tags")
    .eq("store_domain", STORE_DOMAIN);
  if (error) throw error;

  const rows = data as Array<{ product_id: string; product: Product; tags: Tags }>;
  const affected = rows.filter((r) => r.tags.aesthetic.length === 0);
  console.log(`Re-tagging ${affected.length} rows with empty aesthetic...`);

  const products = affected.map((r) => r.product);
  const hints = products.map(ruleTag);
  const newTags = await tagProducts(products, hints);

  const taggedProducts: TaggedProduct[] = products.map((p, i) => ({ ...p, styleTags: newTags[i] }));

  let stillEmpty = 0;
  taggedProducts.forEach((p) => {
    if (p.styleTags.aesthetic.length === 0) stillEmpty++;
  });

  await saveProducts(STORE_DOMAIN, taggedProducts);
  console.log(`Saved ${taggedProducts.length} rows. Still empty aesthetic after backfill: ${stillEmpty}`);
}

main();
