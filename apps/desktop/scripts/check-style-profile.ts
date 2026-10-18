import assert from "node:assert/strict";
import { styleAnalysisPrompt } from "../src/style-prompt.ts";
import { STYLE_PROFILE_LIST_FIELDS, parseStyleProfile, type StyleProfile } from "../src/style-profile.ts";

const validProfile: StyleProfile = {
  aesthetic: "Minimal workwear",
  keywords: {
    category: ["shirt", "pants"],
    fit: ["relaxed", "boxy"],
    color: ["grey", "beige"],
    material: ["cotton"],
    aesthetic: ["minimal", "workwear"],
  },
  colors: ["charcoal", "cream", "black"],
  silhouettes: ["boxy", "loose", "wide-leg"],
  materials: ["denim", "knitwear", "cotton"],
  categories: ["tops", "pants", "outerwear"],
  status: "pending_review",
};

const valid = parseStyleProfile(validProfile);
assert.equal(valid.ok, true);
if (valid.ok) {
  assert.equal(valid.profile.aesthetic, "Minimal workwear");
  assert.deepEqual(valid.profile.colors, ["charcoal", "cream", "black"]);
  assert.deepEqual(valid.profile.keywords.fit, ["relaxed", "boxy"]);
}

const trimmedTitle = parseStyleProfile({
  ...validProfile,
  aesthetic: "  Minimal workwear  ",
});
assert.equal(trimmedTitle.ok, true);
if (trimmedTitle.ok) {
  assert.equal(trimmedTitle.profile.aesthetic, "Minimal workwear");
}

const aestheticList = parseStyleProfile({
  ...validProfile,
  aesthetic: ["minimal", "casual", "workwear"],
});
assert.equal(aestheticList.ok, false);

const trimmed = parseStyleProfile({
  ...validProfile,
  colors: [" charcoal ", "charcoal", "cream"],
  keywords: {
    ...validProfile.keywords,
    color: [" Grey ", "grey", "beige"],
  },
});
assert.equal(trimmed.ok, true);
if (trimmed.ok) {
  assert.deepEqual(trimmed.profile.colors, ["charcoal", "cream"]);
  assert.deepEqual(trimmed.profile.keywords.color, ["grey", "beige"]);
}

const missingStatus = parseStyleProfile({
  aesthetic: "Minimal workwear",
  keywords: validProfile.keywords,
  colors: ["black"],
  silhouettes: ["boxy"],
  materials: ["denim"],
  categories: ["tops"],
});
assert.equal(missingStatus.ok, false);

const extraField = parseStyleProfile({
  ...validProfile,
  score: 90,
});
assert.equal(extraField.ok, false);
if (!extraField.ok) {
  assert.ok(extraField.errors.some((error) => error.includes("score")));
}

const emptyList = parseStyleProfile({
  ...validProfile,
  materials: [],
});
assert.equal(emptyList.ok, true);

const invalidKeyword = parseStyleProfile({
  ...validProfile,
  keywords: {
    ...validProfile.keywords,
    fit: ["relaxed fit"],
  },
});
assert.equal(invalidKeyword.ok, false);

for (const field of STYLE_PROFILE_LIST_FIELDS) {
  assert.ok(styleAnalysisPrompt.includes(field));
}
assert.ok(styleAnalysisPrompt.includes("pending_review"));
assert.ok(styleAnalysisPrompt.includes("empty array"));
assert.ok(styleAnalysisPrompt.includes("category: t-shirt"));
assert.ok(styleAnalysisPrompt.includes("Minimal workwear"));

console.log("style profile checks passed");
