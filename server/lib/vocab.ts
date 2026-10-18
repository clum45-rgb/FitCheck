// Single source of truth for the tagging vocabulary.
// The tagging prompt and all validation read from here — change the
// vocabulary by editing this file and bumping VOCAB_VERSION, nothing else.

export const VOCAB_VERSION = 1;

export const CATEGORY = [
  "t-shirt",
  "long-sleeve",
  "shirt",
  "knit",
  "hoodie",
  "jacket",
  "coat",
  "pants",
  "jeans",
  "shorts",
  "skirt",
  "dress",
  "accessory",
] as const;

export const FIT = [
  "oversized",
  "relaxed",
  "regular",
  "fitted",
  "cropped",
  "boxy",
] as const;

export const COLOR = [
  "black",
  "white",
  "grey",
  "navy",
  "blue",
  "green",
  "olive",
  "brown",
  "tan",
  "beige",
  "red",
  "pink",
  "purple",
  "yellow",
  "orange",
  "multicolor",
] as const;

export const MATERIAL = [
  "cotton",
  "denim",
  "wool",
  "knit",
  "leather",
  "suede",
  "nylon",
  "linen",
  "synthetic",
] as const;

export const AESTHETIC = [
  "minimal",
  "streetwear",
  "vintage",
  "workwear",
  "preppy",
  "sporty",
  "y2k",
  "elegant",
  "grunge",
  "casual",
] as const;

export type Category = (typeof CATEGORY)[number];
export type Fit = (typeof FIT)[number];
export type Color = (typeof COLOR)[number];
export type Material = (typeof MATERIAL)[number];
export type Aesthetic = (typeof AESTHETIC)[number];

export const VOCAB = {
  category: CATEGORY,
  fit: FIT,
  color: COLOR,
  material: MATERIAL,
  aesthetic: AESTHETIC,
} as const;

export type VocabKey = keyof typeof VOCAB;
