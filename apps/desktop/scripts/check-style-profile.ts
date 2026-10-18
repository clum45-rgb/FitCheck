import assert from "node:assert/strict";
import { styleAnalysisPrompt } from "../src/style-prompt.ts";
import { STYLE_PROFILE_LIST_FIELDS, parseStyleProfile, type StyleProfile } from "../src/style-profile.ts";

const validProfile: StyleProfile = {
  aesthetic: ["minimalist streetwear", "vintage-inspired"],
  keywords: ["oversized", "relaxed fit", "neutral tones", "wide-leg"],
  colors: ["charcoal", "cream", "black"],
  silhouettes: ["boxy", "loose", "wide-leg"],
  materials: ["denim", "knitwear", "cotton"],
  categories: ["tops", "pants", "outerwear"],
  status: "pending_review",
};

const valid = parseStyleProfile(validProfile);
assert.equal(valid.ok, true);
if (valid.ok) {
  assert.deepEqual(valid.profile.colors, ["charcoal", "cream", "black"]);
}

const trimmed = parseStyleProfile({
  ...validProfile,
  colors: [" charcoal ", "charcoal", "cream"],
});
assert.equal(trimmed.ok, true);
if (trimmed.ok) {
  assert.deepEqual(trimmed.profile.colors, ["charcoal", "cream"]);
}

const missingStatus = parseStyleProfile({
  aesthetic: ["minimalist streetwear"],
  keywords: ["oversized"],
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

const tooManyItems = parseStyleProfile({
  ...validProfile,
  keywords: Array.from({ length: 13 }, (_, index) => `keyword ${index}`),
});
assert.equal(tooManyItems.ok, false);

for (const field of STYLE_PROFILE_LIST_FIELDS) {
  assert.ok(styleAnalysisPrompt.includes(field));
}
assert.ok(styleAnalysisPrompt.includes("pending_review"));
assert.ok(styleAnalysisPrompt.includes("empty array"));

console.log("style profile checks passed");
