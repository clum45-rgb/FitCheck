export type StyleProfile = {
  aesthetics: string[];
  colors: string[];
  fit: string;
};

export type ProductCardData = {
  name: string;
  imageUrl: string;
  price: string;
  url: string;
  matchLabel: string;
};

export type Match = ProductCardData & {
  productId: string;
  storeDomain: string;
  matchScore: number;
};

export type CartItem = {
  productId: string;
  name: string;
  imageUrl: string;
  price: string;
  url: string;
  storeDomain: string;
};

export type NoticeTone = "error" | "info";
