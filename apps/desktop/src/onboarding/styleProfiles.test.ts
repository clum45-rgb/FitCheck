import { describe, expect, it, vi } from "vitest";
import {
  addProfileTag,
  aestheticTitle,
  coerceProfileTags,
  coerceStyleTags,
  emptyProfileTags,
  emptyStyleTags,
  limitAestheticTitle,
  normalizeProfileTagKey,
  parseStyleProfile,
  withoutProfileTag,
  type ProfileTags,
  type StyleTags,
} from "../style-profile";
import {
  emptyProfilePreferenceState,
  mergeProfileTags,
  normalizeStyleProfile,
  persistConfirmedStyleProfile,
  persistEditedStyleProfile,
  profileAnalysisSignature,
  profileTagsFromPreferenceState,
  readProfilePreferenceState,
  type StyleProfileRepository,
} from "./styleProfiles";

function repository(overrides: Partial<StyleProfileRepository> = {}) {
  return {
    saveStyleProfile: vi.fn(async () => {}),
    markOnboardingComplete: vi.fn(async () => {}),
    ...overrides,
  } satisfies StyleProfileRepository;
}

function tags(partial: Partial<StyleTags> = {}): StyleTags {
  return { ...emptyStyleTags(), ...partial };
}

function profileTags(partial: Partial<ProfileTags> = {}): ProfileTags {
  return { ...emptyProfileTags(), ...partial };
}

function modelProfile(aesthetic: string) {
  return {
    aesthetic,
    keywords: emptyStyleTags(),
    colors: [],
    silhouettes: [],
    materials: [],
    categories: [],
    status: "pending_review",
  };
}

describe("confirmed style profile persistence", () => {
  it("turns a saved aesthetic list into one title", () => {
    expect(aestheticTitle(["minimalist streetwear", "androgynous tailoring"])).toBe("minimalist streetwear androgynous tailoring");
  });

  it("trims the aesthetic and keeps normalized free-text tags", () => {
    expect(normalizeStyleProfile("  Modern  ", {
      category: [" shirt ", "shirt", "not-a-category"],
      fit: [],
      color: ["Navy"],
      material: [],
      aesthetic: [],
    })).toEqual({
      aesthetic: "Modern",
      keywords: profileTags({ category: ["shirt", "not-a-category"], color: ["Navy"] }),
    });
  });

  it("saves the style profile before marking onboarding complete", async () => {
    const calls: string[] = [];
    const repo = repository({
      saveStyleProfile: vi.fn(async () => { calls.push("style"); }),
      markOnboardingComplete: vi.fn(async () => { calls.push("complete"); }),
    });

    await persistConfirmedStyleProfile(repo, " Modern ", tags({ fit: ["relaxed"] }));

    expect(calls).toEqual(["style", "complete"]);
    expect(repo.saveStyleProfile).toHaveBeenCalledWith("Modern", tags({ fit: ["relaxed"] }), expect.objectContaining({ version: 1 }));
  });

  it("does not mark onboarding complete if the style-profile write fails", async () => {
    const repo = repository({ saveStyleProfile: vi.fn(async () => { throw new Error("write failed"); }) });

    await expect(persistConfirmedStyleProfile(repo, "Modern", tags({ fit: ["relaxed"] }))).rejects.toThrow("write failed");
    expect(repo.markOnboardingComplete).not.toHaveBeenCalled();
  });

  it("keeps a saved profile retryable if completion status fails", async () => {
    const repo = repository({ markOnboardingComplete: vi.fn(async () => { throw new Error("update failed"); }) });

    await expect(persistConfirmedStyleProfile(repo, "Modern", tags({ fit: ["relaxed"] })))
      .rejects.toThrow("Your style profile was saved, but onboarding could not be completed");
    expect(repo.saveStyleProfile).toHaveBeenCalledTimes(1);
    expect(repo.markOnboardingComplete).toHaveBeenCalledTimes(1);
  });

  it("rejects an empty aesthetic or tag set before writing", async () => {
    const repo = repository();

    await expect(persistConfirmedStyleProfile(repo, " ", tags({ fit: ["relaxed"] }))).rejects.toThrow("aesthetic label");
    await expect(persistConfirmedStyleProfile(repo, "aesthetic title longer than twenty", tags({ fit: ["relaxed"] }))).rejects.toThrow("20 characters");
    await expect(persistConfirmedStyleProfile(repo, "Modern", emptyStyleTags())).rejects.toThrow("at least one");
    expect(repo.saveStyleProfile).not.toHaveBeenCalled();
  });

  it("saves profile edits without rerunning onboarding completion", async () => {
    const repo = repository();

    await persistEditedStyleProfile(repo, "Modern", tags({ material: ["cotton"] }));

    expect(repo.saveStyleProfile).toHaveBeenCalledWith("Modern", tags({ material: ["cotton"] }), expect.objectContaining({ version: 1 }), true);
    expect(repo.markOnboardingComplete).not.toHaveBeenCalled();
  });

  it("can persist preference metadata without changing confirmed profile fields", async () => {
    const repo = repository();
    const preferenceState = emptyProfilePreferenceState();

    await persistEditedStyleProfile(repo, "Modern", tags({ material: ["cotton"] }), preferenceState, false);

    expect(repo.saveStyleProfile).toHaveBeenCalledWith("Modern", tags({ material: ["cotton"] }), preferenceState, false);
  });

  it("leaves the caller's confirmed preference state untouched when a refresh save fails", async () => {
    const preferenceState = emptyProfilePreferenceState();
    preferenceState.manualTags = profileTags({ category: ["custom drape"] });
    const originalState = structuredClone(preferenceState);
    const repo = repository({ saveStyleProfile: vi.fn(async () => { throw new Error("write failed"); }) });

    await expect(persistEditedStyleProfile(repo, "Modern", profileTags({ category: ["custom drape"] }), preferenceState))
      .rejects.toThrow("write failed");
    expect(preferenceState).toEqual(originalState);
  });

  it("rejects phrases that are not product tags", () => {
    expect(() => normalizeStyleProfile("Modern", ["Clean lines", "Relaxed tailoring"])).toThrow("at least one");
  });

  it("keeps only vocabulary values when reading a saved tag object", () => {
    expect(coerceStyleTags(["Clean lines", "Relaxed tailoring"])).toEqual(emptyStyleTags());
    expect(coerceStyleTags({
      category: ["accessory"],
      fit: ["relaxed tailoring"],
      color: ["navy"],
      material: ["cotton"],
      aesthetic: [],
    })).toEqual(tags({ category: ["accessory"], color: ["navy"], material: ["cotton"] }));
  });
});

describe("free-text profile tags", () => {
  it("trims tags and rejects blank or normalized duplicates", () => {
    const initial = profileTags({ category: ["Streetwear"] });
    expect(addProfileTag(initial, "category", "  ")).toMatchObject({ error: "Enter a tag first." });
    expect(addProfileTag(initial, "category", " streetWEAR ")).toMatchObject({ error: "That tag is already in this category." });
    expect(normalizeProfileTagKey("Cafe\u0301   style")).toBe(normalizeProfileTagKey("Café style"));
    expect(addProfileTag(initial, "category", " Tailoring ")).toEqual({
      tags: profileTags({ category: ["Streetwear", "Tailoring"] }),
      error: null,
    });
  });

  it("enforces five tags per category and a 30-character maximum", () => {
    const full = profileTags({ category: ["one", "two", "three", "four", "five"] });
    expect(addProfileTag(full, "category", "six").error).toContain("no more than 5");
    expect(addProfileTag(emptyProfileTags(), "fit", "x".repeat(31)).error).toContain("30 characters");
  });

  it("coerces saved free-text tags and removes by normalized value", () => {
    const coerced = coerceProfileTags({ category: ["  Minimal  ", "minimal", " ", "x".repeat(31)] });
    expect(coerced.category).toEqual(["Minimal"]);
    expect(withoutProfileTag(coerced, "category", " MINIMAL ").category).toEqual([]);
  });
});

describe("AI aesthetic title limit", () => {
  it("rejects generated titles longer than 20 characters", () => {
    const result = parseStyleProfile(modelProfile("aesthetic title longer than twenty"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toContain("1 to 20 characters");
  });

  it("keeps imported legacy titles within the limit at a word boundary", () => {
    const title = limitAestheticTitle("Grunge streetwear with sheer layering and statement accessories");
    expect(title).toBe("Grunge streetwear");
    expect(title.length).toBeLessThanOrEqual(20);
  });
});

describe("refresh preference persistence", () => {
  it("restores structured preference metadata nested in existing JSON keywords", () => {
    const legacy = readProfilePreferenceState({}, ["shirt", "navy", "custom drape"]);
    expect(legacy.aiTags).toEqual(profileTags({ category: ["shirt"], color: ["navy"], aesthetic: ["custom drape"] }));
    expect(legacy.lastAnalysisSignature).toBeNull();

    const state = emptyProfilePreferenceState();
    state.manualTags = profileTags({ category: ["Tailoring"] });
    state.keptTags = profileTags({ fit: ["boxy"] });
    state.dismissedTags = profileTags({ color: ["neon"] });
    state.aiTags = profileTags({ category: ["shirt"], color: ["neon", "navy"] });
    const restored = readProfilePreferenceState({}, {
      ...profileTags({ category: ["Tailoring"] }),
      __fitcheck: state,
    });
    expect(restored).toEqual(state);
  });

  it("keeps manual and selected tags while excluding deliberately dismissed AI tags", () => {
    const state = emptyProfilePreferenceState();
    state.manualTags = profileTags({ category: ["custom drape"] });
    state.keptTags = profileTags({ fit: ["boxy"] });
    state.dismissedTags = profileTags({ color: ["neon"] });
    state.aiTags = profileTags({ category: ["shirt"], color: ["neon", "navy"] });

    expect(profileTagsFromPreferenceState(state)).toEqual(profileTags({
      category: ["custom drape", "shirt"],
      fit: ["boxy"],
      color: ["navy"],
    }));
  });

  it("uses stable photo ordering and changes signature when saved preference inputs change", () => {
    const preferences = emptyProfilePreferenceState();
    const first = profileAnalysisSignature(["user/b.jpg", "user/a.jpg"], preferences);
    expect(profileAnalysisSignature(["user/a.jpg", "user/b.jpg"], preferences)).toBe(first);

    const changed = {
      ...preferences,
      manualTags: profileTags({ aesthetic: ["minimal"] }),
    };
    expect(profileAnalysisSignature(["user/a.jpg", "user/b.jpg"], changed)).not.toBe(first);
  });

  it("prioritizes user-kept tags and never exceeds the category maximum", () => {
    const merged = mergeProfileTags(
      profileTags({ fit: ["kept one", "kept two"] }),
      profileTags({ fit: ["ai one", "ai two", "ai three", "ai four"] }),
    );
    expect(merged.fit).toEqual(["kept one", "kept two", "ai one", "ai two", "ai three"]);
  });
});
