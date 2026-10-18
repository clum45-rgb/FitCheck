import {
  AESTHETIC,
  CATEGORY,
  COLOR,
  FIT,
  MATERIAL,
  VOCAB,
  type Aesthetic,
  type Category,
  type Color,
  type Fit,
  type Material,
  type VocabKey,
} from "../../../server/lib/vocab.ts";

export const STYLE_PROFILE_LIST_FIELDS = [
  "colors",
  "silhouettes",
  "materials",
  "categories",
] as const;

export type StyleProfileListField = (typeof STYLE_PROFILE_LIST_FIELDS)[number];

export const STYLE_TAG_FIELDS = ["category", "fit", "color", "material", "aesthetic"] as const;

export type StyleTagField = (typeof STYLE_TAG_FIELDS)[number];

export type StyleTags = {
  category: Category[];
  fit: Fit[];
  color: Color[];
  material: Material[];
  aesthetic: Aesthetic[];
};

export const STYLE_TAG_VOCAB = VOCAB;

export type StyleProfile = {
  aesthetic: string;
  keywords: StyleTags;
  colors: string[];
  silhouettes: string[];
  materials: string[];
  categories: string[];
  status: "pending_review";
};

const MAX_ITEMS = 12;
const MAX_ITEM_LENGTH = 80;

const stringListSchema = {
  type: "array",
  items: { type: "string" },
} as const;

function enumArray(values: readonly string[]) {
  return {
    type: "array" as const,
    items: { type: "string" as const, enum: [...values] },
  };
}

const styleTagSchema = {
  type: "object",
  additionalProperties: false,
  required: [...STYLE_TAG_FIELDS],
  properties: {
    category: enumArray(CATEGORY),
    fit: enumArray(FIT),
    color: enumArray(COLOR),
    material: enumArray(MATERIAL),
    aesthetic: enumArray(AESTHETIC),
  },
} as const;

export const styleProfileSchema = {
  type: "object",
  additionalProperties: false,
  required: ["aesthetic", "keywords", ...STYLE_PROFILE_LIST_FIELDS, "status"],
  properties: {
    aesthetic: { type: "string" },
    keywords: styleTagSchema,
    colors: stringListSchema,
    silhouettes: stringListSchema,
    materials: stringListSchema,
    categories: stringListSchema,
    status: { type: "string", enum: ["pending_review"] },
  },
} as const;

export type StyleProfileParseResult =
  | { ok: true; profile: StyleProfile }
  | { ok: false; errors: string[] };

export function emptyStyleTags(): StyleTags {
  return { category: [], fit: [], color: [], material: [], aesthetic: [] };
}

export function styleTagCount(tags: StyleTags) {
  return STYLE_TAG_FIELDS.reduce((count, field) => count + tags[field].length, 0);
}

export function withoutStyleTag(tags: StyleTags, field: StyleTagField, value: string): StyleTags {
  return {
    ...tags,
    [field]: tags[field].filter((item) => item !== value),
  };
}

function parseStringList(value: unknown, field: StyleProfileListField, errors: string[]): string[] {
  if (!Array.isArray(value)) {
    errors.push(`${field} must be a list of text`);
    return [];
  }

  if (value.length > MAX_ITEMS) {
    errors.push(`${field} must contain at most ${MAX_ITEMS} items`);
  }

  const items: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") {
      errors.push(`${field} must contain only text`);
      return items;
    }

    const trimmed = item.trim();
    if (trimmed.length < 1 || trimmed.length > MAX_ITEM_LENGTH) {
      errors.push(`${field} items must be 1 to ${MAX_ITEM_LENGTH} characters`);
      return items;
    }

    if (!items.includes(trimmed)) items.push(trimmed);
  }

  return items;
}

function parseTagList(value: unknown, field: StyleTagField, errors: string[], strict: boolean): string[] {
  if (!Array.isArray(value)) {
    if (strict) errors.push(`keywords.${field} must be a list of text`);
    return [];
  }

  const allowed = new Set<string>(VOCAB[field]);
  const items: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") {
      if (strict) errors.push(`keywords.${field} must contain only text`);
      continue;
    }

    const normalized = item.trim().toLowerCase();
    if (!allowed.has(normalized)) {
      if (strict) errors.push(`keywords.${field} must use the product tag vocabulary`);
      continue;
    }

    if (!items.includes(normalized)) items.push(normalized);
  }

  return items;
}

function styleTagsFrom(record: Record<string, unknown>, errors: string[], strict: boolean): StyleTags {
  return {
    category: parseTagList(record.category, "category", errors, strict) as Category[],
    fit: parseTagList(record.fit, "fit", errors, strict) as Fit[],
    color: parseTagList(record.color, "color", errors, strict) as Color[],
    material: parseTagList(record.material, "material", errors, strict) as Material[],
    aesthetic: parseTagList(record.aesthetic, "aesthetic", errors, strict) as Aesthetic[],
  };
}

export function coerceStyleTags(value: unknown): StyleTags {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return emptyStyleTags();
  return styleTagsFrom(value as Record<string, unknown>, [], false);
}

function parseKeywords(value: unknown, errors: string[]): StyleTags {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    errors.push("keywords must be a tag object");
    return emptyStyleTags();
  }

  const record = value as Record<string, unknown>;
  const allowed = new Set<string>(STYLE_TAG_FIELDS);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) errors.push(`Unexpected keyword field: ${key}`);
  }

  return styleTagsFrom(record, errors, true);
}

export function parseStyleProfile(value: unknown): StyleProfileParseResult {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, errors: ["Profile must be an object"] };
  }

  const record = value as Record<string, unknown>;
  const errors: string[] = [];
  const allowed = new Set<string>(["aesthetic", "keywords", ...STYLE_PROFILE_LIST_FIELDS, "status"]);

  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) errors.push(`Unexpected field: ${key}`);
  }

  const lists = {} as Pick<StyleProfile, StyleProfileListField>;
  for (const field of STYLE_PROFILE_LIST_FIELDS) {
    lists[field] = parseStringList(record[field], field, errors);
  }

  const aesthetic = parseAestheticTitle(record.aesthetic, errors);
  const keywords = parseKeywords(record.keywords, errors);

  if (record.status !== "pending_review") {
    errors.push('status must be "pending_review"');
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    profile: {
      ...lists,
      aesthetic,
      keywords,
      status: "pending_review",
    },
  };
}

function parseAestheticTitle(value: unknown, errors: string[]): string {
  if (typeof value !== "string") {
    errors.push("aesthetic must be a single title");
    return "";
  }

  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > MAX_ITEM_LENGTH) {
    errors.push(`aesthetic must be 1 to ${MAX_ITEM_LENGTH} characters`);
  }
  return trimmed;
}

export function aestheticTitle(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (!Array.isArray(value)) return "";
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .join(" ");
}

export function styleTagVocabularyText() {
  return (Object.keys(VOCAB) as VocabKey[])
    .map((field) => `${field}: ${VOCAB[field].join(", ")}`)
    .join("\n");
}
