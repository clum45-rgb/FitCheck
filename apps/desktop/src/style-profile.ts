export const STYLE_PROFILE_LIST_FIELDS = [
  "aesthetic",
  "keywords",
  "colors",
  "silhouettes",
  "materials",
  "categories",
] as const;

export type StyleProfileListField = (typeof STYLE_PROFILE_LIST_FIELDS)[number];

export type StyleProfile = {
  aesthetic: string[];
  keywords: string[];
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

export const styleProfileSchema = {
  type: "object",
  additionalProperties: false,
  required: [...STYLE_PROFILE_LIST_FIELDS, "status"],
  properties: {
    aesthetic: stringListSchema,
    keywords: stringListSchema,
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

export function parseStyleProfile(value: unknown): StyleProfileParseResult {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, errors: ["Profile must be an object"] };
  }

  const record = value as Record<string, unknown>;
  const errors: string[] = [];
  const allowed = new Set<string>([...STYLE_PROFILE_LIST_FIELDS, "status"]);

  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) errors.push(`Unexpected field: ${key}`);
  }

  const lists = {} as Pick<StyleProfile, StyleProfileListField>;
  for (const field of STYLE_PROFILE_LIST_FIELDS) {
    lists[field] = parseStringList(record[field], field, errors);
  }

  if (record.status !== "pending_review") {
    errors.push('status must be "pending_review"');
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    profile: {
      ...lists,
      status: "pending_review",
    },
  };
}
