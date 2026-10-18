import type { Aesthetic, Category, Color, Fit, Material } from "./vocab";

export type Product = {
  id: string;
  storeDomain: string;
  title: string;
  handle: string;
  url: string;
  price: number;
  currency: string;
  productType: string;
  tags: string[];
  available: boolean;
  description: string;
  colorFromTitle: string | null;
  images: string[];
  updatedAt: string;
};

export type Tags = {
  category: Category[];
  fit: Fit[];
  color: Color[];
  material: Material[];
  aesthetic: Aesthetic[];
};

// Product.tags is the raw merchant tags (string[]); styleTags is the
// controlled-vocabulary attributes this pipeline derives, kept as a
// separate field since the two shapes aren't compatible.
export type TaggedProduct = Product & { styleTags: Tags };

export type ScanRequest = {
  origin: string;
};

export type ScanResponse = {
  storeDomain: string;
  products: TaggedProduct[];
  counts: {
    total: number;
    newlyTagged: number;
    fromCache: number;
  };
};

export type ScanErrorResponse = {
  error: string;
};

export type CartItem = {
  productId: string;
  name: string;
  imageUrl: string;
  url: string;
  storeDomain: string;
  approvedAt: string;
};
