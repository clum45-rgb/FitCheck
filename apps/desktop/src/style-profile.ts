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

export type ProfileTags = Record<StyleTagField, string[]>;

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
export const MAX_AESTHETIC_LENGTH = 20;
export const MAX_PROFILE_TAGS_PER_CATEGORY = 10;
export const MAX_PROFILE_TAG_LENGTH = 30;

const stringListSchema = {
  type: "array",
  items: { type: "string" },
} as const;

function enumArray(values: readonly string[]) {
  return {
    type: "array" as const,
    maxItems: MAX_PROFILE_TAGS_PER_CATEGORY,
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
    aesthetic: { type: "string", maxLength: MAX_AESTHETIC_LENGTH },
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

export function emptyProfileTags(): ProfileTags {
  return { category: [], fit: [], color: [], material: [], aesthetic: [] };
}

export function normalizeProfileTagKey(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function coerceProfileTags(value: unknown): ProfileTags {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return emptyProfileTags();
  const record = value as Record<string, unknown>;
  const tags = emptyProfileTags();
  for (const field of STYLE_TAG_FIELDS) {
    if (!Array.isArray(record[field])) continue;
    for (const item of record[field] as unknown[]) {
      if (typeof item !== "string") continue;
      const trimmed = item.trim();
      if (!trimmed || trimmed.length > MAX_PROFILE_TAG_LENGTH) continue;
      if (tags[field].some((existing) => normalizeProfileTagKey(existing) === normalizeProfileTagKey(trimmed))) continue;
      if (tags[field].length >= MAX_PROFILE_TAGS_PER_CATEGORY) continue;
      tags[field].push(trimmed);
    }
  }
  return tags;
}

export type AddProfileTagResult =
  | { tags: ProfileTags; error: null }
  | { tags: ProfileTags; error: string };

export function addProfileTag(tags: ProfileTags, field: StyleTagField, rawValue: string): AddProfileTagResult {
  const value = rawValue.trim();
  if (!value) return { tags, error: "Enter a tag first." };
  if (value.length > MAX_PROFILE_TAG_LENGTH) return { tags, error: `Tags can be at most ${MAX_PROFILE_TAG_LENGTH} characters.` };
  if (tags[field].some((existing) => normalizeProfileTagKey(existing) === normalizeProfileTagKey(value))) {
    return { tags, error: "That tag is already in this category." };
  }
  if (tags[field].length >= MAX_PROFILE_TAGS_PER_CATEGORY) {
    return { tags, error: `Keep no more than ${MAX_PROFILE_TAGS_PER_CATEGORY} tags in each category.` };
  }
  return { tags: { ...tags, [field]: [...tags[field], value] }, error: null };
}

export function withoutProfileTag(tags: ProfileTags, field: StyleTagField, value: string): ProfileTags {
  const key = normalizeProfileTagKey(value);
  return { ...tags, [field]: tags[field].filter((item) => normalizeProfileTagKey(item) !== key) };
}

export function profileTagCount(tags: ProfileTags) {
  return STYLE_TAG_FIELDS.reduce((count, field) => count + tags[field].length, 0);
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

  if (strict && value.length > MAX_PROFILE_TAGS_PER_CATEGORY) {
    errors.push(`keywords.${field} must contain at most ${MAX_PROFILE_TAGS_PER_CATEGORY} tags`);
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
  if (trimmed.length < 1 || trimmed.length > MAX_AESTHETIC_LENGTH) {
    errors.push(`aesthetic must be 1 to ${MAX_AESTHETIC_LENGTH} characters`);
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

export function limitAestheticTitle(value: unknown): string {
  const title = aestheticTitle(value).replace(/\s+/g, " ").trim();
  if (title.length <= MAX_AESTHETIC_LENGTH) return title;
  const words = title.split(" ");
  let limited = "";
  for (const word of words) {
    const candidate = limited ? `${limited} ${word}` : word;
    if (candidate.length > MAX_AESTHETIC_LENGTH) break;
    limited = candidate;
  }
  return limited || title.slice(0, MAX_AESTHETIC_LENGTH);
}

export function styleTagVocabularyText() {
  return (Object.keys(VOCAB) as VocabKey[])
    .map((field) => `${field}: ${VOCAB[field].join(", ")}`)
    .join("\n");
}
